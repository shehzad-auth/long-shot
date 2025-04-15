const ccxt = require('ccxt');
const WebSocket = require('ws');
const LogisticRegression = require('ml-logistic-regression');
const { Matrix } = require('ml-matrix');
const express = require('express');

// Centralized Configuration
const config = {
  exchange: {
    apiKey: process.env.API_KEY,
    apiSecret: process.env.API_SECRET,
    rateLimit: true,
  },
  trading: {
    initialCash: 300,
    topPairs: 3,
    pairLimit: 120,
    minCashForTrade: 10,
    reassessInterval: 4 * 60 * 60 * 1000, // 4 hours
  },
  indicators: {
    shortMAPeriod: 5,
    longMAPeriod: 13,
    rsiPeriod: 14,
    bbandsPeriod: 20,
    bbandsStdDev: 2,
    macdFast: 12,
    macdSlow: 26,
    macdSignal: 9,
    atrPeriod: 14,
    adxPeriod: 14,
    volumeMAPeriod: 20,
  },
  signals: {
    buyThreshold: 2,
    sellThreshold: 2,
    rsiOversold: 30,
    rsiOverbought: 70,
    volumeSpikeMultiplier: 1.5,
    adxTrendThreshold: 25,
  },
  risk: {
    kellyMin: 0.01,
    kellyMax: 0.1,
    volatilityHigh: 1.5,
    volatilityExtreme: 2,
    sizeMultiplierNormal: 1,
    sizeMultiplierHigh: 0.8,
    sizeMultiplierExtreme: 0.6,
    stopLossMultiplier: 2.5,
    trailingStopMultiplier: 2,
    shortStopLossMultiplier: 2.5,
    takeProfitLevels: [
      { multiplier: 1, portion: 0.3 },
      { multiplier: 2, portion: 0.3 },
      { multiplier: 4, portion: 0.4 },
    ],
  },
  pairCriteria: {
    minWinRate: 0.5,
    minProfit: 0,
    minTradeCount: 10,
    minIndicatorScore: 0.3,
    minVolumeScore: 0.3,
    minSharpeRatio: 0.5,
    maxDrawdown: 0.4,
    correlationThreshold: 0.8,
    maxPairsPerGroup: 2,
  },
  backtest: {
    lookbackCandles: 1500,
    timeframe: '15m',
    performancePeriods: [10, 100, 250, 500, 1000],
    minDataLength: 500,
  },
  optimization: {
    shortMAPeriods: [3, 5, 8, 10],
    longMAPeriods: [8, 10, 13, 15, 20],
    rsiPeriods: [9, 14, 21],
    bbandsParams: [
      { period: 15, stdDev: 2 },
      { period: 20, stdDev: 2 },
      { period: 20, stdDev: 2.5 },
    ],
    minTradesForOptimization: 10,
    minWinRateForOptimization: 0.4,
  },
  websocket: {
    maxReconnectAttempts: 10,
    heartbeatInterval: 30000,
    maxDataLength: 200,
  },
  dynamicTimeframe: {
    atrVolatilityThreshold: 1.5,
    adxTrendThreshold: 30,
    defaultTimeframe: '15m',
  },
  rebalancing: {
    upperThreshold: 1.2,
    lowerThreshold: 0.8,
  },
  ml: {
    numSteps: 1000,
    learningRate: 0.1,
  },
};

// Global State
const exchange = new ccxt.binance({
  apiKey: config.exchange.apiKey,
  secret: config.exchange.apiSecret,
  enableRateLimit: config.exchange.rateLimit,
  timeout: 30000,
});
const app = express();
const logs = [];
let tradingPairs = [];
let portfolio = {};
let wsConnections = {};

// Capture Logs for API
const originalConsoleLog = console.log;
console.log = (...args) => {
  const message = args.map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : arg)).join(' ');
  logs.push({ timestamp: new Date().toISOString(), message });
  // originalConsoleLog.apply(console, args);
};

// API Endpoints
app.get('/logs', (req, res) => res.json(logs));
app.get('/', (req, res) => res.send('Trading Bot is running. Visit /logs to see logs.'));

// Start Server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  runBot();
});

// --- Indicator Functions ---
function calculateMA(values, period) {
  const ma = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) ma.push(null);
    else ma.push(values.slice(i - period + 1, i + 1).reduce((sum, val) => sum + val, 0) / period);
  }
  return ma;
}

function calculateEMA(values, period) {
  const k = 2 / (period + 1);
  const ema = [values[0]];
  for (let i = 1; i < values.length; i++) {
    ema.push(values[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

function calculateMACD(prices) {
  const emaFast = calculateEMA(prices, config.indicators.macdFast);
  const emaSlow = calculateEMA(prices, config.indicators.macdSlow);
  const macd = emaFast.map((v, i) => (i < config.indicators.macdSlow - 1 ? null : v - emaSlow[i]));
  const signalRaw = calculateEMA(macd.slice(config.indicators.macdSlow - 1), config.indicators.macdSignal);
  const signal = Array(config.indicators.macdSlow - 1).fill(null).concat(signalRaw);
  return { macd, signal };
}

function calculateRSI(prices, period = config.indicators.rsiPeriod) {
  const rsi = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period) rsi.push(null);
    else {
      const changes = prices.slice(i - period, i + 1).map((v, j, arr) => (j === 0 ? 0 : v - arr[j - 1]));
      const gains = changes.reduce((sum, ch) => sum + (ch > 0 ? ch : 0), 0) / period;
      const losses = Math.abs(changes.reduce((sum, ch) => sum + (ch < 0 ? ch : 0), 0)) / period;
      rsi.push(losses === 0 ? 100 : 100 - 100 / (1 + gains / losses));
    }
  }
  return rsi;
}

function calculateBollingerBands(prices, period = config.indicators.bbandsPeriod, stdDevMultiplier = config.indicators.bbandsStdDev) {
  const sma = calculateMA(prices, period);
  const bands = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) bands.push({ upper: null, middle: null, lower: null });
    else {
      const slice = prices.slice(i - period + 1, i + 1);
      const mean = sma[i];
      const stdDev = Math.sqrt(slice.reduce((sum, v) => sum + (v - mean) ** 2, 0) / period);
      bands.push({
        upper: mean + stdDevMultiplier * stdDev,
        middle: mean,
        lower: mean - stdDevMultiplier * stdDev,
      });
    }
  }
  return bands;
}

function calculateATR(highs, lows, closes, period = config.indicators.atrPeriod) {
  const tr = [];
  for (let i = 0; i < closes.length; i++) {
    if (i === 0) tr.push(highs[i] - lows[i]);
    else {
      const hl = highs[i] - lows[i];
      const hc = Math.abs(highs[i] - closes[i - 1]);
      const lc = Math.abs(lows[i] - closes[i - 1]);
      tr.push(Math.max(hl, hc, lc));
    }
  }
  return calculateMA(tr, period);
}

function calculateADX(highs, lows, closes, period = config.indicators.adxPeriod) {
  const tr = calculateATR(highs, lows, closes, period);
  const dmPlus = highs.map((h, i) => (i === 0 ? 0 : Math.max(h - highs[i - 1], 0)));
  const dmMinus = lows.map((l, i) => (i === 0 ? 0 : Math.max(lows[i - 1] - l, 0)));
  const atr = calculateMA(tr, period);
  const diPlus = calculateMA(dmPlus, period).map((v, i) => (atr[i] ? (100 * v) / atr[i] : 0));
  const diMinus = calculateMA(dmMinus, period).map((v, i) => (atr[i] ? (100 * v) / atr[i] : 0));
  const dx = diPlus.map((p, i) => (atr[i] ? (100 * Math.abs(p - diMinus[i])) / (p + diMinus[i]) : 0));
  return calculateMA(dx, period);
}

function calculateVolumeMA(candles, period = config.indicators.volumeMAPeriod) {
  return calculateMA(candles.map((c) => c.volume), period);
}

function calculateKellyCriterion(trades) {
  if (!trades?.length) return 0.1;
  const wins = trades.filter((t) => t.profit > 0).length;
  const winRate = wins / trades.length;
  const avgWin = wins ? trades.filter((t) => t.profit > 0).reduce((sum, t) => sum + t.profit, 0) / wins : 0;
  const avgLoss = trades.length - wins ? trades.filter((t) => t.profit < 0).reduce((sum, t) => sum + Math.abs(t.profit), 0) / (trades.length - wins) : 0;
  return avgLoss ? Math.max(0, Math.min(0.5, winRate - (1 - winRate) / (avgWin / avgLoss))) : 0.1;
}

// --- Utility Functions ---
async function selectTimeframe(pair) {
  if (!pair?.includes('/USDT')) {
    console.log(`⛔ Invalid pair: ${pair}`);
    return config.dynamicTimeframe.defaultTimeframe;
  }
  try {
    const [ohlcv5m, ohlcv1h] = await Promise.all([
      exchange.fetchOHLCV(pair, '5m', undefined, config.websocket.maxDataLength),
      exchange.fetchOHLCV(pair, '1h', undefined, config.websocket.maxDataLength),
    ]);
    const atr5m = calculateATR(ohlcv5m.map((c) => c[2]), ohlcv5m.map((c) => c[3]), ohlcv5m.map((c) => c[4])).slice(-1)[0];
    const atr1h = calculateATR(ohlcv1h.map((c) => c[2]), ohlcv1h.map((c) => c[3]), ohlcv1h.map((c) => c[4])).slice(-1)[0];
    const adx1h = calculateADX(ohlcv1h.map((c) => c[2]), ohlcv1h.map((c) => c[3]), ohlcv1h.map((c) => c[4])).slice(-1)[0];
    if (atr5m / atr1h > config.dynamicTimeframe.atrVolatilityThreshold) return '5m';
    if (adx1h > config.dynamicTimeframe.adxTrendThreshold) return '1h';
    return config.dynamicTimeframe.defaultTimeframe;
  } catch (error) {
    console.log(`[${pair}] ⛔ Timeframe selection error: ${error.message}`);
    return config.dynamicTimeframe.defaultTimeframe;
  }
}

async function fetchOHLCVWithRetry(pair, timeframe, limit, retries = 3, delayMs = 1000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const ohlcv = await exchange.fetchOHLCV(pair, timeframe, undefined, limit);
      if (!ohlcv?.length) throw new Error('Empty OHLCV data');
      return ohlcv;
    } catch (error) {
      console.warn(`[${pair}] ⚠️ Attempt ${attempt}/${retries} failed: ${error.message}`);
      if (attempt === retries) throw error;
      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }
}

// --- Signal and Model Training ---
function trainSignalModel(pair, trades, candleData) {
  if (!trades?.length || !candleData?.length) {
    console.log(`[${pair}] ⛔ Invalid data for model training`);
    return null;
  }
  const closes = candleData.map((c) => c.close);
  const shortMA = calculateMA(closes, config.indicators.shortMAPeriod);
  const longMA = calculateMA(closes, config.indicators.longMAPeriod);
  const { macd, signal } = calculateMACD(closes);
  const rsi = calculateRSI(closes);
  const adx = calculateADX(candleData.map((c) => c.high), candleData.map((c) => c.low), closes);

  const trainingData = trades
    .map((trade, i) => {
      if (i >= Math.min(shortMA.length, longMA.length, macd.length, signal.length, rsi.length, adx.length)) return null;
      return {
        inputs: [
          shortMA[i] > longMA[i] && (i === 0 || shortMA[i - 1] <= longMA[i - 1]) ? 1 : 0,
          macd[i] > signal[i] && (i === 0 || macd[i - 1] <= signal[i - 1]) ? 1 : 0,
          rsi[i] < config.signals.rsiOversold ? 1 : 0,
          adx[i] > config.signals.adxTrendThreshold ? 1 : 0,
        ],
        output: trade.profit > 0 ? 1 : 0,
      };
    })
    .filter(Boolean);

  if (!trainingData.length) {
    console.log(`[${pair}] ⛔ No valid training data`);
    return null;
  }

  const model = new LogisticRegression({ numSteps: config.ml.numSteps, learningRate: config.ml.learningRate });
  model.train(new Matrix(trainingData.map((t) => t.inputs)), Matrix.columnVector(trainingData.map((t) => t.output)));
  return model;
}

function generateSignals(candleData, pair, customParams = null) {
  const closes = candleData.map((c) => c.close);
  const highs = candleData.map((c) => c.high);
  const lows = candleData.map((c) => c.low);
  const volumes = candleData.map((c) => c.volume);
  const params = customParams || portfolio[pair]?.params || {
    shortMA: config.indicators.shortMAPeriod,
    longMA: config.indicators.longMAPeriod,
    rsiPeriod: config.indicators.rsiPeriod,
    bbandsPeriod: config.indicators.bbandsPeriod,
    bbandsStdDev: config.indicators.bbandsStdDev,
  };

  const indicators = {
    shortMA: calculateMA(closes, params.shortMA),
    longMA: calculateMA(closes, params.longMA),
    macd: calculateMACD(closes).macd,
    signal: calculateMACD(closes).signal,
    rsi: calculateRSI(closes, params.rsiPeriod),
    atr: calculateATR(highs, lows, closes),
    adx: calculateADX(highs, lows, closes),
    volumeMA: calculateVolumeMA(candleData),
    bbands: calculateBollingerBands(closes, params.bbandsPeriod, params.bbandsStdDev),
  };

  const mlModel = portfolio[pair]?.mlModel;

  return closes.map((_, i) => {
    if (i < config.indicators.macdSlow - 1) return { action: 0, strength: 0 };

    const maCross = indicators.shortMA[i] > indicators.longMA[i] && indicators.shortMA[i - 1] <= indicators.longMA[i - 1];
    const macdCross = indicators.macd[i] > indicators.signal[i] && indicators.macd[i - 1] <= indicators.signal[i - 1];
    const rsiOversold = indicators.rsi[i] < config.signals.rsiOversold;
    const volumeSpike = volumes[i] > indicators.volumeMA[i] * config.signals.volumeSpikeMultiplier;
    const priceBelowBB = closes[i] < indicators.bbands[i].lower;
    const strongTrend = indicators.adx[i] > config.signals.adxTrendThreshold;

    let buyStrength = 0;
    if (maCross) buyStrength += 1;
    if (macdCross) buyStrength += 1;
    if (rsiOversold) buyStrength += 0.8;
    if (volumeSpike) buyStrength += 0.5;
    if (priceBelowBB) buyStrength += 0.5;
    if (strongTrend) buyStrength += 0.5;

    const maSellCross = indicators.shortMA[i] < indicators.longMA[i] && indicators.shortMA[i - 1] >= indicators.longMA[i - 1];
    const macdSellCross = indicators.macd[i] < indicators.signal[i] && indicators.macd[i - 1] >= indicators.signal[i - 1];
    const rsiOverbought = indicators.rsi[i] > config.signals.rsiOverbought;
    const priceAboveBB = closes[i] > indicators.bbands[i].upper;

    let sellStrength = 0;
    if (maSellCross) sellStrength += 1;
    if (macdSellCross) sellStrength += 1;
    if (rsiOverbought) sellStrength += 0.8;
    if (priceAboveBB) sellStrength += 0.5;
    if (strongTrend) sellStrength += 0.5;

    if (mlModel) {
      const inputs = [maCross ? 1 : 0, macdCross ? 1 : 0, rsiOversold ? 1 : 0, strongTrend ? 1 : 0];
      const prob = mlModel.predict(new Matrix([inputs]));
      buyStrength *= prob;
      sellStrength *= 1 - prob;
    }

    if (buyStrength >= config.signals.buyThreshold) return { action: 1, strength: buyStrength / 4.3 };
    if (sellStrength >= config.signals.sellThreshold) return { action: -1, strength: sellStrength / 3.8 };
    return { action: 0, strength: 0 };
  });
}

// --- Trading Logic ---
function calculatePositionSize(pair, signalStrength, pairPortfolio) {
  const atr = pairPortfolio.atr[pairPortfolio.atr.length - 1];
  const atrMA = calculateMA(pairPortfolio.atr, 20)[pairPortfolio.atr.length - 1];
  const volatilityFactor =
    atr / atrMA < 0.8
      ? 1.2
      : atr / atrMA > config.risk.volatilityExtreme
      ? config.risk.sizeMultiplierExtreme
      : atr / atrMA > config.risk.volatilityHigh
      ? config.risk.sizeMultiplierHigh
      : config.risk.sizeMultiplierNormal;
  const kellyFraction = calculateKellyCriterion(pairPortfolio.trades);
  return Math.max(pairPortfolio.cash * kellyFraction * volatilityFactor * signalStrength, config.trading.minCashForTrade);
}

function calculateStopLoss(entryPrice, atr, trend, isShort = false) {
  let stopDistance = atr * (isShort ? config.risk.shortStopLossMultiplier : config.risk.stopLossMultiplier);
  if (trend === 'up') stopDistance *= isShort ? 0.9 : 1.1;
  else if (trend === 'down') stopDistance *= isShort ? 1.1 : 0.9;
  return isShort ? entryPrice + stopDistance : entryPrice - stopDistance;
}

function setupTakeProfitLevels(entryPrice, atr) {
  return config.risk.takeProfitLevels.map((level) => ({
    price: entryPrice + atr * level.multiplier,
    portion: level.portion,
  }));
}

function executeTradeLogic(pair, candleData, signal, price, volatility, pairPortfolio, isBacktest = false) {
  let { cash, position, entryPrice, highestPrice, lowestPrice, trades, takeProfitLevels, trend } = pairPortfolio;

  // Handle existing position
  if (position !== 0) {
    highestPrice = Math.max(highestPrice, price);
    lowestPrice = Math.min(lowestPrice, price);
    const isShort = position < 0;
    const stopLossPrice = calculateStopLoss(entryPrice, volatility, trend, isShort);
    const trailingStopPrice = isShort ? lowestPrice + volatility * config.risk.trailingStopMultiplier : highestPrice - volatility * config.risk.trailingStopMultiplier;

    // Check take-profit levels
    if (takeProfitLevels?.length) {
      const nextTP = takeProfitLevels[0];
      const tpHit = isShort ? price <= nextTP.price : price >= nextTP.price;
      if (tpHit) {
        const sellAmount = Math.abs(position) * nextTP.portion;
        const profit = isShort ? sellAmount * (entryPrice - price) : sellAmount * (price - entryPrice);
        if (isFinite(profit)) {
          cash += sellAmount * price * (isShort ? -1 : 1);
          position -= sellAmount * (isShort ? -1 : 1);
          trades.push({ price, profit });
          if (!isBacktest) console.log(`[${pair}] 🎯 Take Profit: Sold ${sellAmount.toFixed(6)} at $${price}`);
          takeProfitLevels.shift();
          if (!takeProfitLevels.length) takeProfitLevels = null;
        }
      }
    }

    // Check exit conditions
    const exitCondition =
      (isShort && (signal.action === 1 || price >= stopLossPrice || price >= trailingStopPrice)) ||
      (!isShort && (signal.action === -1 || price <= stopLossPrice || price <= trailingStopPrice));
    if (exitCondition) {
      const profit = isShort ? Math.abs(position) * (entryPrice - price) : position * (price - entryPrice);
      if (isFinite(profit)) {
        cash += Math.abs(position) * price * (isShort ? -1 : 1);
        trades.push({ price, profit });
        if (!isBacktest) console.log(`[${pair}] 📉 ${isShort ? 'Close Short' : 'Sell'}: ${Math.abs(position).toFixed(6)} at $${price}`);
        position = 0;
        highestPrice = 0;
        lowestPrice = Infinity;
        takeProfitLevels = null;
      }
    }
  }

  // Handle new trades
  if (signal.action === 1 && cash >= config.trading.minCashForTrade && position === 0) {
    const quantity = Math.min(calculatePositionSize(pair, signal.strength, pairPortfolio), cash / price);
    if (quantity * price <= cash && isFinite(quantity) && quantity > 0) {
      position += quantity;
      entryPrice = price;
      highestPrice = price;
      lowestPrice = price;
      cash -= Number((quantity * price).toFixed(8));
      takeProfitLevels = setupTakeProfitLevels(entryPrice, volatility);
      trades.push({ price, profit: 0 });
      if (!isBacktest) console.log(`[${pair}] 📈 Buy: ${quantity.toFixed(6)} at $${price}`);
    } else if (!isBacktest) {
      console.warn(`[${pair}] ⚠️ Insufficient cash (${cash.toFixed(2)}) for buy: ${quantity.toFixed(6)} at $${price}`);
    }
  } else if (signal.action === -1 && cash >= config.trading.minCashForTrade && position === 0) {
    const quantity = calculatePositionSize(pair, signal.strength, pairPortfolio);
    if (isFinite(quantity) && quantity > 0) {
      position -= quantity;
      entryPrice = price;
      highestPrice = price;
      lowestPrice = price;
      cash = Number((parseFloat(cash) + parseFloat(quantity * price)).toFixed(8));
      takeProfitLevels = setupTakeProfitLevels(entryPrice, volatility).map((tp) => ({
        price: entryPrice - (tp.price - entryPrice),
        portion: tp.portion,
      }));
      trades.push({ price, profit: 0 });
      if (!isBacktest) console.log(`[${pair}] 📉 Short: ${quantity.toFixed(6)} at $${price}`);
    } else if (!isBacktest) {
      console.warn(`[${pair}] ⚠️ Invalid quantity for short: ${quantity}`);
    }
  }

  // Update portfolio and prevent negative cash
  pairPortfolio.cash = cash;
  pairPortfolio.position = position;
  pairPortfolio.entryPrice = entryPrice;
  pairPortfolio.highestPrice = highestPrice;
  pairPortfolio.lowestPrice = lowestPrice;
  pairPortfolio.trades = trades;
  pairPortfolio.takeProfitLevels = takeProfitLevels;

  if (pairPortfolio.cash < 0 && !isBacktest) {
    console.log(`[${pair}] ⚠️ Negative cash detected: ${pairPortfolio.cash.toFixed(2)}. Resetting to 0.`);
    pairPortfolio.cash = 0;
  }

  if (!isBacktest) {
    console.log(`[${pair}] 💼 Portfolio: 💵 Cash=${cash.toFixed(2)} | 📊 Position=${position.toFixed(6)} | 💰 Value=${(cash + position * price).toFixed(2)}`);
  }

  return pairPortfolio;
}

// --- Analysis Functions ---
function calculateIndicatorAlignmentScore(candleData) {
  const closes = candleData.map((c) => c.close);
  const highs = candleData.map((c) => c.high);
  const lows = candleData.map((c) => c.low);
  const volumes = candleData.map((c) => c.volume);
  const shortMA = calculateMA(closes, config.indicators.shortMAPeriod);
  const longMA = calculateMA(closes, config.indicators.longMAPeriod);
  const { macd, signal } = calculateMACD(closes);
  const rsi = calculateRSI(closes);
  const bbands = calculateBollingerBands(closes);

  let totalMACrosses = 0,
    successfulMACrosses = 0;
  let totalMACDCrosses = 0,
    successfulMACDCrosses = 0;
  let totalRSIOversold = 0,
    successfulRSIOversold = 0;
  let totalBBOverextensions = 0,
    successfulBBOverextensions = 0;

  for (let i = config.indicators.macdSlow - 1; i < closes.length - 10; i++) {
    if (shortMA[i] > longMA[i] && shortMA[i - 1] <= longMA[i - 1]) {
      totalMACrosses++;
      if ((closes[i + 10] - closes[i]) / closes[i] > 0.01) successfulMACrosses++;
    }
    if (macd[i] > signal[i] && macd[i - 1] <= signal[i - 1]) {
      totalMACDCrosses++;
      if ((closes[i + 10] - closes[i]) / closes[i] > 0.01) successfulMACDCrosses++;
    }
    if (rsi[i] < config.signals.rsiOversold) {
      totalRSIOversold++;
      if ((closes[i + 5] - closes[i]) / closes[i] > 0.005) successfulRSIOversold++;
    }
    if (closes[i] < bbands[i].lower) {
      totalBBOverextensions++;
      if ((closes[i + 5] - closes[i]) / closes[i] > 0.005) successfulBBOverextensions++;
    }
  }

  const maCrossSuccessRate = totalMACrosses ? successfulMACrosses / totalMACrosses : 0;
  const macdCrossSuccessRate = totalMACDCrosses ? successfulMACDCrosses / totalMACDCrosses : 0;
  const rsiReversalSuccessRate = totalRSIOversold ? successfulRSIOversold / totalRSIOversold : 0;
  const bbReversalSuccessRate = totalBBOverextensions ? successfulBBOverextensions / totalBBOverextensions : 0;
  const signalFrequency = (totalMACrosses + totalMACDCrosses + totalRSIOversold + totalBBOverextensions) / closes.length;

  return {
    score: (maCrossSuccessRate * 0.25 + macdCrossSuccessRate * 0.25 + rsiReversalSuccessRate * 0.25 + bbReversalSuccessRate * 0.25) * (1 + Math.min(signalFrequency * 5, 1)),
    details: { maCrossSuccessRate, macdCrossSuccessRate, rsiReversalSuccessRate, bbReversalSuccessRate, signalFrequency },
  };
}

async function analyzeMultipleTimeframes(pair) {
  const timeframes = ['1h', '15m', '5m'];
  const analysis = {};
  const alignmentScore = { value: 0, maxPossible: 0 };

  for (const tf of timeframes) {
    try {
      const ohlcv = await fetchOHLCVWithRetry(pair, tf, config.websocket.maxDataLength);
      const candles = ohlcv.map((c) => ({
        timestamp: new Date(c[0]),
        open: c[1],
        high: c[2],
        low: c[3],
        close: c[4],
        volume: c[5],
      }));
      const closes = candles.map((c) => c.close);
      const shortMA = calculateMA(closes, config.indicators.shortMAPeriod);
      const longMA = calculateMA(closes, config.indicators.longMAPeriod);
      const { macd, signal } = calculateMACD(closes);
      const rsi = calculateRSI(closes);
      analysis[tf] = {
        trend: closes[closes.length - 1] > shortMA[shortMA.length - 1] ? 'up' : 'down',
        macdTrend: macd[macd.length - 1] > signal[signal.length - 1] ? 'up' : 'down',
        rsiTrend: rsi[rsi.length - 1] > 50 ? 'up' : 'down',
        maTrendStrength: Math.abs(closes[closes.length - 1] - longMA[longMA.length - 1]) / closes[closes.length - 1],
      };
    } catch (error) {
      console.log(`[${pair}] ⛔ Error analyzing ${tf}: ${error.message}`);
      analysis[tf] = { error: true };
    }
  }

  const validTimeframes = timeframes.filter((tf) => !analysis[tf].error);
  if (validTimeframes.length >= 2) {
    for (let i = 0; i < validTimeframes.length - 1; i++) {
      for (let j = i + 1; j < validTimeframes.length; j++) {
        const tf1 = validTimeframes[i];
        const tf2 = validTimeframes[j];
        alignmentScore.maxPossible += 3;
        if (analysis[tf1].trend === analysis[tf2].trend) alignmentScore.value++;
        if (analysis[tf1].macdTrend === analysis[tf2].macdTrend) alignmentScore.value++;
        if (analysis[tf1].rsiTrend === analysis[tf2].rsiTrend) alignmentScore.value++;
      }
    }
  }

  const normalizedAlignmentScore = alignmentScore.maxPossible ? alignmentScore.value / alignmentScore.maxPossible : 0;
  const primaryTrend = analysis['1h']?.error ? 'unknown' : analysis['1h'].trend;
  const intermediateConfirmation = analysis['15m']?.error ? false : analysis['15m'].trend === primaryTrend;
  const shortTermConfirmation = analysis['5m']?.error ? false : analysis['5m'].trend === primaryTrend;
  const trendStrength = analysis['1h']?.error ? 0 : analysis['1h'].maTrendStrength;

  const recentOHLCV = await fetchOHLCVWithRetry(pair, '15m', 20);
  return {
    primaryTrend,
    intermediateCorrection: analysis['15m']?.trend !== primaryTrend,
    entryOpportunity: intermediateConfirmation && shortTermConfirmation,
    keyLevels: {
      support: Math.min(...recentOHLCV.map((c) => c[3])),
      resistance: Math.max(...recentOHLCV.map((c) => c[2])),
    },
    alignmentScore: normalizedAlignmentScore * (1 + trendStrength) * (intermediateConfirmation && shortTermConfirmation ? 1.5 : 1),
  };
}

function analyzeVolumeProfile(candleData) {
  const volumes = candleData.map((c) => c.volume);
  const closes = candleData.map((c) => c.close);
  const volumeMA = calculateVolumeMA(candleData);

  const recentVolAvg = volumes.slice(-20).reduce((sum, vol) => sum + vol, 0) / 20;
  const previousVolAvg = volumes.slice(-40, -20).reduce((sum, vol) => sum + vol, 0) / 20;
  const volumeTrend = recentVolAvg / previousVolAvg;

  const recentVols = volumes.slice(-20);
  const volMean = recentVols.reduce((sum, vol) => sum + vol, 0) / recentVols.length;
  const volVariance = recentVols.reduce((sum, vol) => sum + (vol - volMean) ** 2, 0) / recentVols.length;
  const volumeConsistency = 1 - Math.min(Math.sqrt(volVariance) / volMean, 1);

  const priceChanges = closes.map((p, i) => (i === 0 ? 0 : Math.abs(p - closes[i - 1])));
  let sumXY = 0,
    sumX = 0,
    sumY = 0,
    sumX2 = 0,
    sumY2 = 0;
  const n = Math.min(30, volumes.length);
  for (let i = Math.max(0, volumes.length - n); i < volumes.length; i++) {
    sumXY += volumes[i] * priceChanges[i];
    sumX += volumes[i];
    sumY += priceChanges[i];
    sumX2 += volumes[i] * volumes[i];
    sumY2 += priceChanges[i] * priceChanges[i];
  }
  const volumePriceCorrelation = (n * sumXY - sumX * sumY) / Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)) || 0;

  let volumeSpikes = 0;
  for (let i = 1; i < volumes.length; i++) {
    if (volumes[i] > volumeMA[i] * config.signals.volumeSpikeMultiplier && Math.abs((closes[i] - closes[i - 1]) / closes[i - 1]) > 0.01) {
      volumeSpikes++;
    }
  }
  const normalizedVolumeSpikes = Math.min(volumeSpikes / 10, 1);

  return {
    volumeQualityScore: (volumeConsistency * 0.3 + Math.max(0, Math.min(volumePriceCorrelation, 1)) * 0.4 + normalizedVolumeSpikes * 0.3) * Math.min(volumeTrend, 1.5),
    details: { volumeTrend, volumeConsistency, volumePriceCorrelation, volumeSpikes, averageDailyVolume: recentVolAvg },
  };
}

async function analyzeMarketCorrelations(pairs) {
  const correlationMatrix = {};
  const pairData = {};

  for (const pair of pairs) {
    try {
      const ohlcv = await fetchOHLCVWithRetry(pair, '1h', config.websocket.maxDataLength);
      const closes = ohlcv.map((c) => c[4]);
      pairData[pair] = closes.map((v, i) => (i === 0 ? 0 : (v - closes[i - 1]) / closes[i - 1]));
    } catch (error) {
      console.log(`[${pair}] ⛔ Error fetching correlation data: ${error.message}`);
      pairData[pair] = [];
    }
  }

  for (const pair1 of pairs) {
    correlationMatrix[pair1] = {};
    for (const pair2 of pairs) {
      if (pair1 === pair2) {
        correlationMatrix[pair1][pair2] = 1;
        continue;
      }
      const returns1 = pairData[pair1];
      const returns2 = pairData[pair2];
      const minLength = Math.min(returns1.length, returns2.length);
      if (minLength < 30) {
        correlationMatrix[pair1][pair2] = 0;
        continue;
      }
      let sumX = 0,
        sumY = 0,
        sumXY = 0,
        sumX2 = 0,
        sumY2 = 0;
      for (let k = 0; k < minLength; k++) {
        const x = returns1[k];
        const y = returns2[k];
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumX2 += x * x;
        sumY2 += y * y;
      }
      const n = minLength;
      const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
      correlationMatrix[pair1][pair2] = denominator ? (n * sumXY - sumX * sumY) / denominator : 0;
    }
  }
  return correlationMatrix;
}

function groupPairsByCorrelation(correlationMatrix) {
  const pairs = Object.keys(correlationMatrix);
  const groups = [];
  const assignedPairs = new Set();

  for (const pair of pairs) {
    if (assignedPairs.has(pair)) continue;
    const group = [pair];
    assignedPairs.add(pair);
    for (const otherPair of pairs) {
      if (pair !== otherPair && !assignedPairs.has(otherPair) && Math.abs(correlationMatrix[pair][otherPair]) >= config.pairCriteria.correlationThreshold) {
        group.push(otherPair);
        assignedPairs.add(otherPair);
      }
    }
    groups.push(group);
  }
  return groups;
}

function selectDiversePairs(groups, pairScores) {
  const selectedPairs = [];
  for (const group of groups) {
    const validPairs = group.filter((pair) => pairScores[pair] !== undefined);
    if (!validPairs.length) continue;
    const topPair = validPairs.sort((a, b) => pairScores[b] - pairScores[a])[0];
    if (topPair && selectedPairs.length < config.trading.topPairs) selectedPairs.push(topPair);
  }
  return selectedPairs;
}

// --- Optimization and Backtesting ---
async function optimizeIndicatorParameters(pair) {
  try {
    const ohlcv = await fetchOHLCVWithRetry(pair, config.backtest.timeframe, config.backtest.lookbackCandles);
    const candleData = ohlcv.map((c) => ({
      timestamp: new Date(c[0]),
      open: c[1],
      high: c[2],
      low: c[3],
      close: c[4],
      volume: c[5],
    }));

    if (candleData.length < config.backtest.minDataLength) {
      throw new Error(`Insufficient data: ${candleData.length} candles`);
    }

    let bestParams = null;
    let bestScore = -Infinity;

    for (const shortMA of config.optimization.shortMAPeriods) {
      for (const longMA of config.optimization.longMAPeriods) {
        if (shortMA >= longMA) continue;
        for (const rsiPeriod of config.optimization.rsiPeriods) {
          for (const bbParam of config.optimization.bbandsParams) {
            const testParams = { shortMA, longMA, rsiPeriod, bbandsPeriod: bbParam.period, bbandsStdDev: bbParam.stdDev };
            const pairPortfolio = initializePortfolio(pair, config.trading.initialCash / config.trading.topPairs, candleData);
            const signals = generateSignals(candleData, pair, testParams);
            const result = backtestPair(pair, candleData, signals, pairPortfolio);
            const profit = result.finalValue - pairPortfolio.initialCash;
            const score = profit * (1 + Math.min(result.trades.length, 50) / 50) * (0.5 + result.winRate);
            if (
              score > bestScore &&
              result.trades.length >= config.optimization.minTradesForOptimization &&
              result.winRate >= config.optimization.minWinRateForOptimization
            ) {
              bestScore = score;
              bestParams = testParams;
            }
          }
        }
      }
    }
    return bestParams;
  } catch (error) {
    console.log(`[${pair}] ⛔ Optimization error: ${error.message}`);
    return null;
  }
}

function calculateRiskAdjustedMetrics(result) {
  const returns = result.trades.map((t) => t.profit / result.initialCash);
  const meanReturn = returns.reduce((sum, r) => sum + r, 0) / (returns.length || 1);
  const variance = returns.reduce((sum, r) => sum + (r - meanReturn) ** 2, 0) / (returns.length || 1);
  const stdDev = Math.sqrt(variance);
  const sharpe = stdDev ? (meanReturn / stdDev) * Math.sqrt(365 * 24) : 0;

  const equityCurve = result.trades.reduce(
    (curve, t, i) => {
      curve.push(curve[i] + t.profit);
      return curve;
    },
    [result.initialCash]
  );
  const peak = Math.max(...equityCurve);
  const drawdown = peak ? (peak - equityCurve[equityCurve.length - 1]) / peak : 0;

  return { trades: result.trades.length, sharpe, drawdown };
}

function backtestPair(pair, candleData, signals, pairPortfolio) {
  for (let i = 0; i < Math.min(candleData.length, signals.length); i++) {
    const price = candleData[i].close;
    if (!isFinite(price) || price <= 0) continue;
    const volatility = pairPortfolio.atr[i] || 0;
    executeTradeLogic(pair, candleData, signals[i], price, volatility, pairPortfolio, true);
  }

  const finalPrice = candleData[candleData.length - 1].close;
  const finalValue = isFinite(pairPortfolio.cash + pairPortfolio.position * finalPrice * (pairPortfolio.position < 0 ? -1 : 1))
    ? pairPortfolio.cash + pairPortfolio.position * finalPrice * (pairPortfolio.position < 0 ? -1 : 1)
    : pairPortfolio.initialCash;
  const winRate = pairPortfolio.trades.length ? pairPortfolio.trades.filter((t) => t.profit > 0).length / pairPortfolio.trades.length : 0;

  const result = {
    finalValue,
    profit: finalValue - pairPortfolio.initialCash,
    winRate,
    trades: pairPortfolio.trades,
    initialCash: pairPortfolio.initialCash,
  };
  const metrics = calculateRiskAdjustedMetrics(result);

  if (pairPortfolio.trades.length >= 10) {
    pairPortfolio.mlModel = trainSignalModel(pair, pairPortfolio.trades, candleData);
  }

  return { ...result, ...metrics };
}

// --- Pair Selection ---
async function analyzePairPerformance(pair, analysisResult) {
  const { candleData } = analysisResult;
  if (!candleData?.length) {
    console.log(`[${pair}] ⛔ Invalid analysis data`);
    return false;
  }

  const signals = generateSignals(candleData, pair);
  const indicatorScore = calculateIndicatorAlignmentScore(candleData);
  const volumeProfile = analyzeVolumeProfile(candleData);

  const performance = [];
  for (const count of config.backtest.performancePeriods) {
    if (count > candleData.length) continue;
    const slicedData = candleData.slice(-count);
    const slicedSignals = signals.slice(-count);
    const pairPortfolio = initializePortfolio(pair, config.trading.initialCash / config.trading.topPairs, slicedData);
    const result = backtestPair(pair, slicedData, slicedSignals, pairPortfolio);
    performance.push({ count, ...result });
  }

  if (!performance.length) {
    console.log(`[${pair}] ⛔ No performance data`);
    return false;
  }

  const longTerm = performance.find((p) => p.count === 1000) || performance[performance.length - 1];
  const keyMetrics = performance.filter((p) => [250, 500, 1000].includes(p.count));

  return (
    keyMetrics.every((p) => p.profit > 0) &&
    longTerm.winRate >= config.pairCriteria.minWinRate &&
    longTerm.profit >= config.pairCriteria.minProfit &&
    longTerm.trades.length >= config.pairCriteria.minTradeCount &&
    indicatorScore.score >= config.pairCriteria.minIndicatorScore &&
    volumeProfile.volumeQualityScore >= config.pairCriteria.minVolumeScore &&
    longTerm.sharpe >= config.pairCriteria.minSharpeRatio &&
    longTerm.drawdown <= config.pairCriteria.maxDrawdown
  );
}

async function findBestPairs() {
  const markets = await exchange.loadMarkets();
  const usdtPairs = Object.keys(markets)
    .filter((s) => s.endsWith('/USDT') && markets[s].active)
    .slice(0, config.trading.pairLimit);
  const results = [];

  for (const pair of usdtPairs) {
    try {
      const timeframe = await selectTimeframe(pair);
      const ohlcv = await fetchOHLCVWithRetry(pair, timeframe, config.backtest.lookbackCandles);
      const candleData = ohlcv.map((c) => ({
        timestamp: new Date(c[0]),
        open: c[1],
        high: c[2],
        low: c[3],
        close: c[4],
        volume: c[5],
      }));
      const pairPortfolio = initializePortfolio(pair, config.trading.initialCash / config.trading.topPairs, candleData);
      const optimizedParams = await optimizeIndicatorParameters(pair);
      if (optimizedParams) {
        pairPortfolio.params = optimizedParams;
        const signals = generateSignals(candleData, pair);
        const backtestResult = backtestPair(pair, candleData, signals, pairPortfolio);
        const multiTf = await analyzeMultipleTimeframes(pair);
        results.push({ pair, profit: backtestResult.profit, winRate: backtestResult.winRate, trades: backtestResult.trades.length, candleData, alignmentScore: multiTf.alignmentScore });
      }
    } catch (error) {
      console.log(`[${pair}] ⛔ Error: ${error.message}`);
    }
  }

  const candidates = results.filter(
    (r) => r.trades >= config.pairCriteria.minTradeCount && r.winRate >= config.pairCriteria.minWinRate && r.profit >= config.pairCriteria.minProfit
  );
  const validPairs = [];
  for (const candidate of candidates) {
    if (await analyzePairPerformance(candidate.pair, candidate)) {
      validPairs.push(candidate);
    }
  }

  const correlationMatrix = await analyzeMarketCorrelations(validPairs.map((r) => r.pair));
  const groups = groupPairsByCorrelation(correlationMatrix);
  const pairScores = Object.fromEntries(validPairs.map((r) => [r.pair, r.profit]));
  const finalPairs = selectDiversePairs(groups, pairScores).filter(Boolean);
  console.log(`🏆 Final Pairs: ${finalPairs.join(', ') || 'None'}`);
  return finalPairs;
}

// --- Portfolio Management ---
function initializePortfolio(pair, initialCash, candleData = []) {
  return {
    initialCash,
    cash: initialCash,
    position: 0,
    entryPrice: 0,
    highestPrice: 0,
    lowestPrice: Infinity,
    trades: [],
    takeProfitLevels: null,
    atr: candleData.length ? calculateATR(candleData.map((c) => c.high), candleData.map((c) => c.low), candleData.map((c) => c.close)) : [],
    trend: null,
    params: null,
    timeframe: null,
    mlModel: null,
  };
}

async function monitorPair(pair) {
  const timeframe = portfolio[pair]?.timeframe || (await selectTimeframe(pair));
  portfolio[pair].timeframe = timeframe;
  const wsSymbol = pair.replace('/', '').toLowerCase();
  let candleData = [];

  try {
    const ohlcv = await fetchOHLCVWithRetry(pair, timeframe, config.websocket.maxDataLength);
    candleData = ohlcv.map((c) => ({
      timestamp: new Date(c[0]),
      open: parseFloat(c[1]),
      high: parseFloat(c[2]),
      low: parseFloat(c[3]),
      close: parseFloat(c[4]),
      volume: parseFloat(c[5]),
    }));
  } catch (error) {
    console.log(`[${pair}] ⛔ Error fetching initial data: ${error.message}`);
    return;
  }

  const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${wsSymbol}@kline_${timeframe}`);
  wsConnections[pair] = ws;
  let reconnectAttempts = 0;
  let heartbeatInterval;

  const setupHandlers = () => {
    ws.on('open', () => {
      console.log(`[${pair}] 🌐 WebSocket connected (${timeframe})`);
      reconnectAttempts = 0;
      heartbeatInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.ping('heartbeat');
      }, config.websocket.heartbeatInterval);
    });

    ws.on('message', (msg) => {
      const parsed = JSON.parse(msg);
      const candle = parsed.k;
      if (!candle?.x) return;

      const newCandle = {
        timestamp: new Date(candle.t),
        open: parseFloat(candle.o),
        high: parseFloat(candle.h),
        low: parseFloat(candle.l),
        close: parseFloat(candle.c),
        volume: parseFloat(candle.v),
      };
      candleData.push(newCandle);
      if (candleData.length > config.websocket.maxDataLength) candleData.shift();

      portfolio[pair].atr = calculateATR(candleData.map((c) => c.high), candleData.map((c) => c.low), candleData.map((c) => c.close));
      const signals = generateSignals(candleData, pair);
      const signal = signals[signals.length - 1];
      const price = newCandle.close;
      const volatility = portfolio[pair].atr[portfolio[pair].atr.length - 1];

      console.log(
        `[${pair}] ${signal.action === 1 ? '📈 Buy' : signal.action === -1 ? '📉 Sell' : '🛑 No'} Signal: Strength=${signal.strength.toFixed(2)} at $${price}`
      );

      executeTradeLogic(pair, candleData, signal, price, volatility, portfolio[pair]);
    });

    ws.on('error', (error) => console.log(`[${pair}] ⛔ WebSocket error: ${error.message}`));
    ws.on('close', () => {
      console.log(`[${pair}] 🔌 WebSocket closed, reconnecting...`);
      clearInterval(heartbeatInterval);
      if (reconnectAttempts < config.websocket.maxReconnectAttempts) {
        setTimeout(() => {
          wsConnections[pair] = new WebSocket(`wss://stream.binance.com:9443/ws/${wsSymbol}@kline_${timeframe}`);
          setupHandlers();
          reconnectAttempts++;
        }, Math.min(1000 * Math.pow(2, reconnectAttempts), 60000));
      }
    });
  };

  setupHandlers();
}

async function rebalancePortfolio() {
  const totalValue = await tradingPairs.reduce(async (sum, pair) => {
    const ticker = await exchange.fetchTicker(pair);
    return (await sum) + portfolio[pair].cash + portfolio[pair].position * ticker.last;
  }, Promise.resolve(0));
  const targetPerPair = totalValue / tradingPairs.length;

  for (const pair of tradingPairs) {
    const ticker = await exchange.fetchTicker(pair);
    const currentValue = portfolio[pair].cash + portfolio[pair].position * ticker.last;
    if (currentValue > targetPerPair * config.rebalancing.upperThreshold) {
      const excess = currentValue - targetPerPair;
      portfolio[pair].cash -= excess;
      console.log(`[${pair}] 💸 Withdrawing ${excess.toFixed(2)} for rebalancing`);
    } else if (currentValue < targetPerPair * config.rebalancing.lowerThreshold) {
      const deficit = targetPerPair - currentValue;
      portfolio[pair].cash += deficit;
      console.log(`[${pair}] ➕ Adding ${deficit.toFixed(2)} for rebalancing`);
    }
  }
}

async function reassessPairsPerformance() {
  console.log('🔄 Reassessing pairs...');
  const newBestPairs = await findBestPairs();
  const pairsToRemove = tradingPairs.filter((p) => !newBestPairs.includes(p));
  const pairsToAdd = newBestPairs.filter((p) => !tradingPairs.includes(p));

  if (!pairsToRemove.length && !pairsToAdd.length) {
    console.log('✅ No changes to trading pairs.');
    return;
  }

  let totalAvailableCapital = 0;
  for (const pair of pairsToRemove) {
    if (portfolio[pair]?.position !== 0) {
      const ticker = await exchange.fetchTicker(pair);
      const price = ticker.last;
      const isShort = portfolio[pair].position < 0;
      const quantity = Math.abs(portfolio[pair].position);
      const profit = isShort ? quantity * (portfolio[pair].entryPrice - price) : quantity * (price - portfolio[pair].entryPrice);
      portfolio[pair].cash = Number((parseFloat(portfolio[pair].cash) + parseFloat((isShort ? 1 : -1) * quantity * price)).toFixed(8));
      if (portfolio[pair].cash < 0) {
        console.log(`[${pair}] ⚠️ Negative cash after closing: ${portfolio[pair].cash}. Resetting to 0.`);
        portfolio[pair].cash = 0;
      }
      portfolio[pair].trades.push({ price, profit });
      console.log(`[${pair}] 📉 ${isShort ? 'Close Short' : 'Sell'}: ${quantity.toFixed(6)} at $${price}`);
      if (wsConnections[pair]?.readyState === WebSocket.OPEN) wsConnections[pair].close();
      delete wsConnections[pair];
    }
    totalAvailableCapital += portfolio[pair]?.cash || 0;
    console.log(`[${pair}] 🗑️ Removed from portfolio.`);
    delete portfolio[pair];
  }

  const retainedPairs = tradingPairs.filter((p) => newBestPairs.includes(p));
  for (const pair of retainedPairs) {
    const redistributionAmount = portfolio[pair].cash * 0.3;
    portfolio[pair].cash -= redistributionAmount;
    totalAvailableCapital += redistributionAmount;
  }

  if (totalAvailableCapital < config.trading.minCashForTrade * newBestPairs.length) {
    console.warn(`⚠️ Insufficient capital (${totalAvailableCapital.toFixed(2)}) for ${newBestPairs.length} pairs.`);
    return;
  }

  const capitalPerPair = totalAvailableCapital / newBestPairs.length;
  for (const pair of newBestPairs) {
    if (retainedPairs.includes(pair)) {
      portfolio[pair].cash += capitalPerPair - portfolio[pair].cash * 0.7;
      console.log(`[${pair}] 🔄 Retained, adjusted cash to ${portfolio[pair].cash.toFixed(2)}`);
    } else {
      const timeframe = await selectTimeframe(pair);
      const ohlcv = await fetchOHLCVWithRetry(pair, timeframe, config.websocket.maxDataLength);
      const candleData = ohlcv.map((c) => ({ timestamp: new Date(c[0]), open: c[1], high: c[2], low: c[3], close: c[4], volume: c[5] }));
      portfolio[pair] = initializePortfolio(pair, capitalPerPair, candleData);
      portfolio[pair].trend = (await analyzeMultipleTimeframes(pair)).primaryTrend;
      portfolio[pair].timeframe = timeframe;
      console.log(`[${pair}] ➕ Added to portfolio with cash ${capitalPerPair.toFixed(2)}`);
      await monitorPair(pair);
    }
  }

  tradingPairs = newBestPairs;
  console.log(`🏆 Updated trading pairs: ${tradingPairs.join(', ') || 'None'}`);
}

// --- Main Logic ---
async function runBot() {
  let bestPairs = [];

  while (!bestPairs.length) {
    bestPairs = await findBestPairs();

    if (!bestPairs.length) {
      console.log('🔁 No suitable pairs found. Retrying...');
      await new Promise(res => setTimeout(res, 3000)); // optional delay before retry
    }
  }

  tradingPairs = bestPairs;
  const cashPerPair = config.trading.initialCash / tradingPairs.length;
  console.log(`🌟 Selected pairs: ${tradingPairs.join(', ')}`);

  for (const pair of tradingPairs) {
    const timeframe = await selectTimeframe(pair);
    const ohlcv = await fetchOHLCVWithRetry(pair, timeframe, config.backtest.lookbackCandles);
    const candleData = ohlcv.map((c) => ({
      timestamp: new Date(c[0]),
      open: c[1],
      high: c[2],
      low: c[3],
      close: c[4],
      volume: c[5],
    }));
    portfolio[pair] = initializePortfolio(pair, cashPerPair, candleData);
    portfolio[pair].trend = (await analyzeMultipleTimeframes(pair)).primaryTrend;
    portfolio[pair].timeframe = timeframe;
    const signals = generateSignals(candleData, pair);
    const backtestResult = backtestPair(pair, candleData, signals, portfolio[pair]);
    console.log(`[${pair}] 🔍 Pre-Monitoring Backtest: 💰 Profit=${backtestResult.profit.toFixed(2)}`);
    await monitorPair(pair);
  }

  setInterval(async () => {
    await reassessPairsPerformance();
    await rebalancePortfolio();
  }, config.trading.reassessInterval);
}