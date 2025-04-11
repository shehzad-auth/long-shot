// start v7
const ccxt = require('ccxt');
const WebSocket = require('ws');
const LogisticRegression = require('ml-logistic-regression');
const { Matrix } = require('ml-matrix');

const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

const logs = [];

// Override console.log to capture logs
const originalConsoleLog = console.log;
console.log = function (...args) {
  const logMessage = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
  logs.push({
    timestamp: new Date().toISOString(),
    message: logMessage
  });
  originalConsoleLog.apply(console, args); // Still print to terminal
};

// API endpoint to get logs
app.get('/logs', (req, res) => {
    res.json(logs); // Return logs as JSON
});

// Basic health check endpoint
app.get('/', (req, res) => {
    res.send('Trading Bot is running. Visit /logs to see logs.');
});

// Start the server and bot
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    runBot(); // Start your bot after server is up
});

// Centralized Configuration (Adjustable via UI)
const config = {
    exchange: {
        apiKey: process.env.API_KEY,
        apiSecret: process.env.API_SECRET,
        rateLimit: true
    },
    trading: {
        initialCash: 300,
        topPairs: 3,  // Focus on top 3 performing pairs
        pairLimit: 50,
        minCashForTrade: 10,  // Increased to avoid dust trades
        reassessInterval: 4 * 60 * 60 * 1000  // Every 4 hours
    },
    indicators: {
        shortMAPeriod: 5,
        longMAPeriod: 13,  // Adjusted based on performance data
        rsiPeriod: 14,
        bbandsPeriod: 20,
        bbandsStdDev: 2,
        macdFast: 12,
        macdSlow: 26,
        macdSignal: 9,
        atrPeriod: 14,
        adxPeriod: 14,
        volumeMAPeriod: 20
    },
    signals: {
        buyThreshold: 2,
        sellThreshold: 2,
        rsiOversold: 30,
        rsiOverbought: 70,
        volumeSpikeMultiplier: 1.5,
        adxTrendThreshold: 25
    },
    risk: {
        kellyMin: 0.01,
        kellyMax: 0.1,  // Reduced from 0.2 for safer position sizing
        volatilityHigh: 1.5,
        volatilityExtreme: 2,
        sizeMultiplierNormal: 1,
        sizeMultiplierHigh: 0.8,
        sizeMultiplierExtreme: 0.6,
        stopLossMultiplier: 2.5,
        trailingStopMultiplier: 2,
        shortStopLossMultiplier: 2.5,
        takeProfitLevels: [{
            multiplier: 1,
            portion: 0.3
        }, {
            multiplier: 2,
            portion: 0.3
        }, {
            multiplier: 4,
            portion: 0.4
        }],
    },
    pairCriteria: {
        minWinRate: 0.5,          // Adjusted based on results data
        minProfit: 0,             // Modified to include break-even pairs
        minTradeCount: 10,        
        minIndicatorScore: 0.3,   
        minVolumeScore: 0.3,      
        minSharpeRatio: 0.5,      
        maxDrawdown: 0.4,         
        correlationThreshold: 0.8,
        maxPairsPerGroup: 2       
    },
    backtest: {
        lookbackCandles: 1500,
        timeframe: '15m',         // Changed from 5m to reduce noise
        performancePeriods: [10, 100, 250, 500, 1000],
        minDataLength: 500        // Added missing parameter
    },
    optimization: {
        shortMAPeriods: [3, 5, 8, 10],
        longMAPeriods: [8, 10, 13, 15, 20],
        rsiPeriods: [9, 14, 21],
        bbandsParams: [{
            period: 15,
            stdDev: 2
        }, {
            period: 20,
            stdDev: 2
        }, {
            period: 20,
            stdDev: 2.5
        }],
        minTradesForOptimization: 10,
        minWinRateForOptimization: 0.4  // Lowered to find more parameter sets
    },
    websocket: {
        maxReconnectAttempts: 10,
        heartbeatInterval: 30000,
        maxDataLength: 200  // Increased for better analysis
    },
    dynamicTimeframe: {
        atrVolatilityThreshold: 1.5,
        adxTrendThreshold: 30,
        defaultTimeframe: '15m'
    },
    rebalancing: {
        upperThreshold: 1.2,
        lowerThreshold: 0.8
    },
    ml: {
        numSteps: 1000,
        learningRate: 0.1
    },
};

const exchange = new ccxt.binance({
    apiKey: config.exchange.apiKey,
    secret: config.exchange.apiSecret,
    enableRateLimit: config.exchange.rateLimit,
    timeout: 30000
});

let tradingPairs = [];
let portfolio = {};
let wsConnections = {};

// Indicator Functions
function calculateMA(prices, period) {
    const ma = [];
    for (let i = 0; i < prices.length; i++) {
        if (i < period - 1) ma.push(null);
        else ma.push(prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period);
    }
    return ma;
}

function calculateEMA(prices, period) {
    const k = 2 / (period + 1);
    const ema = [prices[0]];
    for (let i = 1; i < prices.length; i++) {
        ema.push(prices[i] * k + ema[i - 1] * (1 - k));
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
            const rs = losses === 0 ? 100 : gains / losses;
            rsi.push(losses === 0 ? 100 : 100 - (100 / (1 + rs)));
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

function calculateVolumeMA(data, period = config.indicators.volumeMAPeriod) {
    const volumes = data.map(d => d.volume);
    return calculateMA(volumes, period);
}

function calculateKellyCriterion(trades) { // Change parameter name to clarify it’s an array
    if (!trades || trades.length === 0) return 0.1; // Default fraction
    const wins = trades.filter(t => t.profit > 0).length;
    const losses = trades.length - wins;
    const winRate = wins / trades.length;
    const avgWin = wins > 0 ? trades.filter(t => t.profit > 0).reduce((sum, t) => sum + t.profit, 0) / wins : 0;
    const avgLoss = losses > 0 ? trades.filter(t => t.profit < 0).reduce((sum, t) => sum + Math.abs(t.profit), 0) / losses : 0;
    return avgLoss ? Math.max(0, Math.min(0.5, winRate - (1 - winRate) / (avgWin / avgLoss))) : 0.1;
}

async function timeframeSelector(pair) {
    if (!pair || typeof pair !== 'string' || !pair.includes('/USDT')) {
        console.error(`⛔ timeframeSelector Error: Invalid pair provided - ${pair}`);
        return config.dynamicTimeframe.defaultTimeframe; // Fallback to default
    }

    try {
        const ohlcv5m = await exchange.fetchOHLCV(pair, '5m', undefined, config.websocket.maxDataLength);
        const ohlcv1h = await exchange.fetchOHLCV(pair, '1h', undefined, config.websocket.maxDataLength);
        const atr5m = calculateATR(ohlcv5m.map(c => c[2]), ohlcv5m.map(c => c[3]), ohlcv5m.map(c => c[4])).slice(-1)[0];
        const atr1h = calculateATR(ohlcv1h.map(c => c[2]), ohlcv1h.map(c => c[3]), ohlcv1h.map(c => c[4])).slice(-1)[0];
        const adx1h = calculateADX(ohlcv1h.map(c => c[2]), ohlcv1h.map(c => c[3]), ohlcv1h.map(c => c[4])).slice(-1)[0];
        
        if (atr5m / atr1h > config.dynamicTimeframe.atrVolatilityThreshold) return '5m';
        if (adx1h > config.dynamicTimeframe.adxTrendThreshold) return '1h';
        return config.dynamicTimeframe.defaultTimeframe;
    } catch (error) {
        console.error(`[${pair}] timeframeSelector Error: ${error.message}`);
        return config.dynamicTimeframe.defaultTimeframe; // Fallback on error
    }
}

function trainSignalModel(pair, trades, historicalData) {
    if (!trades || !Array.isArray(trades) || trades.length === 0 || !historicalData || !Array.isArray(historicalData)) {
        console.error(`[ERROR] trainSignalModel: Invalid trades or historicalData for ${pair}`, { trades, historicalData });
        return null;
    }

    const closes = historicalData.map(d => d.close);
    const shortMA = calculateMA(closes, config.indicators.shortMAPeriod);
    const longMA = calculateMA(closes, config.indicators.longMAPeriod);
    const macdResults = calculateMACD(closes);
    const macd = macdResults.macd;
    const signal = macdResults.signal;
    const rsi = calculateRSI(closes);
    const adx = calculateADX(historicalData.map(d => d.high), historicalData.map(d => d.low), closes);

    const trainingData = trades.map((t, i) => {
        if (i >= shortMA.length || i >= longMA.length || i >= macd.length || i >= signal.length || i >= rsi.length || i >= adx.length) {
            return null;
        }
        return {
            inputs: [
                shortMA[i] > longMA[i] && (i === 0 || shortMA[i - 1] <= longMA[i - 1]) ? 1 : 0,
                macd[i] > signal[i] && (i === 0 || macd[i - 1] <= signal[i - 1]) ? 1 : 0,
                rsi[i] < config.signals.rsiOversold ? 1 : 0,
                adx[i] > config.signals.adxTrendThreshold ? 1 : 0,
            ],
            output: t.profit > 0 ? 1 : 0,
        };
    }).filter(data => data !== null);

    if (trainingData.length === 0) {
        console.error(`[ERROR] trainSignalModel: No valid training data for ${pair}`);
        return null;
    }

    // Convert to Matrix objects
    const X = new Matrix(trainingData.map(t => t.inputs)); // 2D matrix of inputs
    const Y = Matrix.columnVector(trainingData.map(t => t.output)); // Column vector of outputs

    const model = new LogisticRegression({ numSteps: config.ml.numSteps, learningRate: config.ml.learningRate });
    model.train(X, Y); // Pass Matrix objects
    // console.log(`[DEBUG] Trained model for ${pair} with ${trainingData.length} trades`);
    return model;
}

// Signal Generation
function generateSignals(data, pair, customParams = null) {
    const closes = data.map(d => d.close);
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    const volumes = data.map(d => d.volume);
    const params = customParams || portfolio[pair]?.params || { shortMA: config.indicators.shortMAPeriod, longMA: config.indicators.longMAPeriod, rsiPeriod: config.indicators.rsiPeriod, bbandsPeriod: config.indicators.bbandsPeriod, bbandsStdDev: config.indicators.bbandsStdDev };

    const indicators = {
        shortMA: calculateMA(closes, params.shortMA), longMA: calculateMA(closes, params.longMA),
        macd: calculateMACD(closes).macd, signal: calculateMACD(closes).signal,
        rsi: calculateRSI(closes, params.rsiPeriod), atr: calculateATR(highs, lows, closes),
        adx: calculateADX(highs, lows, closes), volumeMA: calculateVolumeMA(data),
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
            const inputArray = [maCross ? 1 : 0, macdCross ? 1 : 0, rsiOversold ? 1 : 0, strongTrend ? 1 : 0];
            const inputMatrix = new Matrix([inputArray]);  // Create a Matrix with a single row
            const prob = mlModel.predict(inputMatrix);
            buyStrength *= prob;
            sellStrength *= (1 - prob);
        }

        if (buyStrength >= config.signals.buyThreshold) return { action: 1, strength: buyStrength / 4.3 };
        if (sellStrength >= config.signals.sellThreshold) return { action: -1, strength: sellStrength / 3.8 };
        return { action: 0, strength: 0 };
    });
}

// Risk Management
// function calculatePositionSize(pair, signalStrength, tempPortfolio) {
//     const kellyFraction = calculateKellyCriterion(tempPortfolio.trades || []);
//     const volatilityRatio = tempPortfolio.atr[tempPortfolio.atr.length - 1] / calculateMA(tempPortfolio.atr, 20)[tempPortfolio.atr.length - 1];
//     const sizeMultiplier = volatilityRatio > config.risk.volatilityExtreme ? config.risk.sizeMultiplierExtreme :
//                            volatilityRatio > config.risk.volatilityHigh ? config.risk.sizeMultiplierHigh :
//                            config.risk.sizeMultiplierNormal;
//     const positionSize = tempPortfolio.cash * kellyFraction * sizeMultiplier * signalStrength;
//     return Math.max(positionSize, config.trading.minCashForTrade);
// }

function calculatePositionSize(pair, signalStrength, tempPortfolio) {
    const atr = tempPortfolio.atr[tempPortfolio.atr.length - 1];
    const atrMA = calculateMA(tempPortfolio.atr, 20)[tempPortfolio.atr.length - 1];
    const volatilityFactor = atr / atrMA < 0.8 ? 1.2 : atr / atrMA > config.risk.volatilityExtreme ? config.risk.sizeMultiplierExtreme : atr / atrMA > config.risk.volatilityHigh ? config.risk.sizeMultiplierHigh : config.risk.sizeMultiplierNormal;
    const kellyFraction = calculateKellyCriterion(tempPortfolio.trades); // Pass trades array
    const positionSize = tempPortfolio.cash * kellyFraction * volatilityFactor * signalStrength;
    return Math.max(positionSize, config.trading.minCashForTrade);
}

function calculateStopLoss(entryPrice, atr, trend, isShort = false) {
    let stopDistance = atr * (isShort ? config.risk.shortStopLossMultiplier : config.risk.stopLossMultiplier);
    if (trend === 'up') stopDistance *= isShort ? 0.9 : 1.1;
    else if (trend === 'down') stopDistance *= isShort ? 1.1 : 0.9;
    return isShort ? entryPrice + stopDistance : entryPrice - stopDistance;
}

// Trade Logging
function logTrade(pair, type, price, quantity, profit, targetPortfolio = portfolio[pair], timestamp) {
    // targetPortfolio.tradeLog = targetPortfolio.tradeLog || [];
    // targetPortfolio.tradeLog.push({ type, price, quantity, profit, timestamp });
    // const stats = {
    //     totalProfit: targetPortfolio.tradeLog.reduce((sum, t) => sum + t.profit, 0),
    //     avgProfit: targetPortfolio.tradeLog.reduce((sum, t) => sum + t.profit, 0) / targetPortfolio.tradeLog.length,
    //     winRate: targetPortfolio.tradeLog.filter(t => t.profit > 0).length / targetPortfolio.tradeLog.length,
    //     tradesPerHour: targetPortfolio.tradeLog.length > 1 ? targetPortfolio.tradeLog.length / ((targetPortfolio.tradeLog[targetPortfolio.tradeLog.length - 1].timestamp - targetPortfolio.tradeLog[0].timestamp) / 3600000 || 1) : 0,
    // };
    // console.log(`[${pair}] Stats: Total Profit=${stats.totalProfit.toFixed(2)}, Avg Profit=${stats.avgProfit.toFixed(2)}, Win Rate=${(stats.winRate * 100).toFixed(2)}%, Trades/Hour=${stats.tradesPerHour.toFixed(2)}`);
}

function setupTakeProfitLevels(entryPrice, atr) {
    return config.risk.takeProfitLevels.map(level => ({
        price: entryPrice + atr * level.multiplier,
        portion: level.portion,
    }));
}

// Indicator Alignment Score
function calculateIndicatorAlignmentScore(data) {
    const closes = data.map(d => d.close);
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    const volumes = data.map(d => d.volume);

    const shortMA = calculateMA(closes, config.indicators.shortMAPeriod);
    const longMA = calculateMA(closes, config.indicators.longMAPeriod);
    const macd = calculateMACD(closes).macd;
    const signal = calculateMACD(closes).signal;
    const rsi = calculateRSI(closes, config.indicators.rsiPeriod);
    const bbands = calculateBollingerBands(closes, config.indicators.bbandsPeriod, config.indicators.bbandsStdDev);
    const atr = calculateATR(highs, lows, closes);

    let totalMACrosses = 0, successfulMACrosses = 0;
    let totalMACDCrosses = 0, successfulMACDCrosses = 0;
    let totalRSIOversold = 0, successfulRSIOversold = 0;
    let totalBBOverextensions = 0, successfulBBOverextensions = 0;

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

    const maCrossSuccessRate = totalMACrosses > 0 ? successfulMACrosses / totalMACrosses : 0;
    const macdCrossSuccessRate = totalMACDCrosses > 0 ? successfulMACDCrosses / totalMACDCrosses : 0;
    const rsiReversalSuccessRate = totalRSIOversold > 0 ? successfulRSIOversold / totalRSIOversold : 0;
    const bbReversalSuccessRate = totalBBOverextensions > 0 ? successfulBBOverextensions / totalBBOverextensions : 0;
    const signalFrequency = (totalMACrosses + totalMACDCrosses + totalRSIOversold + totalBBOverextensions) / closes.length;

    const score = (maCrossSuccessRate * 0.25 + macdCrossSuccessRate * 0.25 + rsiReversalSuccessRate * 0.25 + bbReversalSuccessRate * 0.25) * 
                  (1 + Math.min(signalFrequency * 5, 1));

    return { score, details: { maCrossSuccessRate, macdCrossSuccessRate, rsiReversalSuccessRate, bbReversalSuccessRate, signalFrequency } };
}

// Multi-Timeframe Analysis
async function enhancedMultiTimeframeAnalysis(pair) {
    const timeframes = ['1h', '15m', '5m'];
    const analysis = {};
    const alignmentScore = { value: 0, maxPossible: 0 };

    for (const tf of timeframes) {
        try {
            const ohlcv = await exchange.fetchOHLCV(pair, tf, undefined, config.websocket.maxDataLength);
            const data = ohlcv.map(candle => ({
                timestamp: new Date(candle[0]),
                open: candle[1],
                high: candle[2],
                low: candle[3],
                close: candle[4],
                volume: candle[5],
            }));
            const closes = data.map(d => d.close);
            const shortMA = calculateMA(closes, config.indicators.shortMAPeriod);
            const longMA = calculateMA(closes, config.indicators.longMAPeriod);
            const macd = calculateMACD(closes).macd;
            const signal = calculateMACD(closes).signal;
            const rsi = calculateRSI(closes, config.indicators.rsiPeriod);

            analysis[tf] = {
                trend: closes[closes.length - 1] > shortMA[shortMA.length - 1] ? 'up' : 'down',
                macdTrend: macd[macd.length - 1] > signal[signal.length - 1] ? 'up' : 'down',
                rsiTrend: rsi[rsi.length - 1] > 50 ? 'up' : 'down',
                maTrendStrength: Math.abs(closes[closes.length - 1] - longMA[longMA.length - 1]) / closes[closes.length - 1],
            };
        } catch (error) {
            console.error(`Error analyzing ${pair} on ${tf}: ${error.message}`);
            analysis[tf] = { error: true };
        }
    }

    const validTimeframes = timeframes.filter(tf => !analysis[tf].error);
    if (validTimeframes.length >= 2) {
        for (let i = 0; i < validTimeframes.length - 1; i++) {
            for (let j = i + 1; j < validTimeframes.length; j++) {
                const tf1 = validTimeframes[i];
                const tf2 = validTimeframes[j];
                alignmentScore.maxPossible += 3;
                if (analysis[tf1].trend === analysis[tf2].trend) alignmentScore.value += 1;
                if (analysis[tf1].macdTrend === analysis[tf2].macdTrend) alignmentScore.value += 1;
                if (analysis[tf1].rsiTrend === analysis[tf2].rsiTrend) alignmentScore.value += 1;
            }
        }
    }

    const normalizedAlignmentScore = alignmentScore.maxPossible > 0 ? alignmentScore.value / alignmentScore.maxPossible : 0;
    const primaryTrend = analysis['1h'] && !analysis['1h'].error ? analysis['1h'].trend : 'unknown';
    const intermediateConfirmation = analysis['15m'] && !analysis['15m'].error && analysis['15m'].trend === primaryTrend;
    const shortTermConfirmation = analysis['5m'] && !analysis['5m'].error && analysis['5m'].trend === primaryTrend;
    const trendStrength = analysis['1h'] && !analysis['1h'].error ? analysis['1h'].maTrendStrength : 0;

    return {
        timeframeAnalysis: analysis,
        alignmentScore: normalizedAlignmentScore,
        primaryTrend,
        trendConfirmation: intermediateConfirmation && shortTermConfirmation,
        trendStrength,
        overallScore: normalizedAlignmentScore * (1 + trendStrength) * (intermediateConfirmation && shortTermConfirmation ? 1.5 : 1),
    };
}

async function analyzeMultipleTimeframes(pair) {
    const result = await enhancedMultiTimeframeAnalysis(pair);
    return {
        primaryTrend: result.primaryTrend,
        intermediateCorrection: result.timeframeAnalysis['15m']?.trend !== result.primaryTrend,
        entryOpportunity: result.trendConfirmation,
        keyLevels: {
            support: Math.min(...(await exchange.fetchOHLCV(pair, '15m', undefined, 20)).map(c => c[3])),
            resistance: Math.max(...(await exchange.fetchOHLCV(pair, '15m', undefined, 20)).map(c => c[2])),
        },
        alignmentScore: result.overallScore,
    };
}

// Volume Profile Analysis
function analyzeVolumeProfile(data) {
    const volumes = data.map(d => d.volume);
    const closes = data.map(d => d.close);
    const volumeMA = calculateMA(volumes, config.indicators.volumeMAPeriod);

    const recentVolAvg = volumes.slice(-20).reduce((sum, vol) => sum + vol, 0) / 20;
    const previousVolAvg = volumes.slice(-40, -20).reduce((sum, vol) => sum + vol, 0) / 20;
    const volumeTrend = recentVolAvg / previousVolAvg;

    const recentVols = volumes.slice(-20);
    const volMean = recentVols.reduce((sum, vol) => sum + vol, 0) / recentVols.length;
    const volVariance = recentVols.reduce((sum, vol) => sum + Math.pow(vol - volMean, 2), 0) / recentVols.length;
    const volumeConsistency = 1 - Math.min(Math.sqrt(volVariance) / volMean, 1);

    const priceChanges = closes.map((price, i) => i === 0 ? 0 : Math.abs(price - closes[i - 1]));
    let sumXY = 0, sumX = 0, sumY = 0, sumX2 = 0, sumY2 = 0;
    for (let i = Math.max(0, volumes.length - 30); i < volumes.length; i++) {
        sumXY += volumes[i] * priceChanges[i];
        sumX += volumes[i];
        sumY += priceChanges[i];
        sumX2 += volumes[i] * volumes[i];
        sumY2 += priceChanges[i] * priceChanges[i];
    }
    const n = Math.min(30, volumes.length);
    const volumePriceCorrelation = (n * sumXY - sumX * sumY) / Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)) || 0;

    let volumeSpikes = 0;
    for (let i = 1; i < volumes.length; i++) {
        if (volumes[i] > volumeMA[i] * config.signals.volumeSpikeMultiplier && 
            Math.abs((closes[i] - closes[i - 1]) / closes[i - 1]) > 0.01) {
            volumeSpikes++;
        }
    }
    const normalizedVolumeSpikes = Math.min(volumeSpikes / 10, 1);

    const volumeQualityScore = (volumeConsistency * 0.3 + Math.max(0, Math.min(volumePriceCorrelation, 1)) * 0.4 + normalizedVolumeSpikes * 0.3) * 
                               Math.min(volumeTrend, 1.5);

    return { volumeQualityScore, details: { volumeTrend, volumeConsistency, volumePriceCorrelation, volumeSpikes, averageDailyVolume: recentVolAvg } };
}

// Market Correlation Analysis
async function analyzeMarketCorrelations(candidatePairs) {
    const correlationMatrix = {};
    const pairData = {};

    for (const pair of candidatePairs) {
        try {
            const ohlcv = await exchange.fetchOHLCV(pair, '1h', undefined, config.websocket.maxDataLength);
            const closes = ohlcv.map(candle => candle[4]);
            pairData[pair] = closes.map((v, i) => i === 0 ? 0 : (v - closes[i - 1]) / closes[i - 1]);
        } catch (error) {
            console.error(`Error fetching data for ${pair}: ${error.message}`);
            pairData[pair] = [];
        }
    }

    for (const pair1 of candidatePairs) {
        correlationMatrix[pair1] = {};
        for (const pair2 of candidatePairs) {
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
            let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
            for (let k = 0; k < minLength; k++) {
                const x = returns1[k];
                const y = returns2[k];
                sumX += x; sumY += y; sumXY += x * y; sumX2 += x * x; sumY2 += y * y;
            }
            const n = minLength;
            const numerator = n * sumXY - sumX * sumY;
            const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
            correlationMatrix[pair1][pair2] = denominator === 0 ? 0 : numerator / denominator;
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
            if (pair !== otherPair && !assignedPairs.has(otherPair) && 
                Math.abs(correlationMatrix[pair][otherPair]) >= config.pairCriteria.correlationThreshold) {
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
    for (const group of Object.values(groups)) {
        const pairsInGroup = group.filter(pair => pairScores[pair] !== undefined);
        if (pairsInGroup.length === 0) continue;
        const sortedPairs = pairsInGroup.sort((a, b) => pairScores[b] - pairScores[a]);
        const topPair = sortedPairs[0]; // Take the highest-scoring pair
        if (topPair && selectedPairs.length < config.trading.topPairs) {
            selectedPairs.push(topPair);
        }
    }
    return selectedPairs;
}

async function fetchOHLCVWithRetry(exchange, pair, timeframe, limit, retries = 3, delayMs = 1000) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const ohlcv = await exchange.fetchOHLCV(pair, timeframe, undefined, limit);
            if (!ohlcv || !Array.isArray(ohlcv) || ohlcv.length === 0) {
                throw new Error(`Invalid OHLCV data: ${JSON.stringify(ohlcv)}`);
            }
            return ohlcv;
        } catch (err) {
            console.warn(`[WARN] Attempt ${attempt}/${retries} failed for ${pair}: ${err.message}`);
            if (attempt === retries) throw err;
            await new Promise(resolve => setTimeout(resolve, delayMs * attempt)); // Exponential backoff
        }
    }
}

// Parameter Optimization
async function optimizeIndicatorParameters(pair) {
    try {
        const ohlcv = await fetchOHLCVWithRetry(exchange, pair, config.backtest.timeframe, config.backtest.lookbackCandles);
        const data = ohlcv.map(candle => ({
            timestamp: new Date(candle[0]),
            open: candle[1],
            high: candle[2],
            low: candle[3],
            close: candle[4],
            volume: candle[5],
        }));

        if (data.length < config.backtest.minDataLength) {
            throw new Error(`Insufficient data: ${data.length} candles received, minimum ${config.backtest.minDataLength} required`);
        }

        let bestParams = null;
        let bestScore = -Infinity;

        for (const shortMA of config.optimization.shortMAPeriods) {
            for (const longMA of config.optimization.longMAPeriods) {
                if (shortMA >= longMA) continue;
                for (const rsiPeriod of config.optimization.rsiPeriods) {
                    for (const bbParam of config.optimization.bbandsParams) {
                        const testParams = { shortMA, longMA, rsiPeriod, bbandsPeriod: bbParam.period, bbandsStdDev: bbParam.stdDev };
                        const signals = generateSignals(data, pair, testParams);
                        const tempPortfolio = {
                            initialCash: 100,
                            cash: 100,
                            position: 0,
                            entryPrice: 0,
                            highestPrice: 0,
                            lowestPrice: Infinity,
                            trades: [],
                            atr: calculateATR(data.map(d => d.high), data.map(d => d.low), data.map(d => d.close)),
                            historicalData: data,
                            tradeLog: []
                        };
                        try {
                            const backtestResult = backtest(data, signals, pair, tempPortfolio);
                            if (!backtestResult || typeof backtestResult.trades === 'undefined') {
                                console.error(`[ERROR] ${pair} backtest returned invalid result for params:`, testParams, "Result:", backtestResult);
                                continue;
                            }
                            // console.log(`[DEBUG] ${pair} params:`, testParams, "Result trades:", backtestResult.trades.length);
                            const profit = backtestResult.finalValue - tempPortfolio.initialCash;
                            const score = profit * (1 + Math.min(backtestResult.tradeCount, 50) / 50) * (0.5 + backtestResult.winRate);
                            if (score > bestScore && backtestResult.tradeCount >= config.optimization.minTradesForOptimization && 
                                backtestResult.winRate >= config.optimization.minWinRateForOptimization) {
                                bestScore = score;
                                bestParams = testParams;
                            }
                        } catch (err) {
                            console.error(`[ERROR] ${pair} backtest failed for params:`, testParams, "Error:", err.message, "Stack:", err.stack);
                        }
                    }
                }
            }
        }
        console.log(`Best parameters for ${pair}:`, bestParams);
        return bestParams;
    } catch (error) {
        console.error(`Error optimizing ${pair}: ${error.message}`, "Stack:", error.stack);
        return null;
    }
}
// Risk-Adjusted Metrics
function calculateRiskAdjustedMetrics(result, data) {
    // Convert trade profits to returns
    const returnsArray = result.trades.map(t => t.profit / result.initialCash);
    const returns = new Matrix([returnsArray]); // 1 x n matrix

    // Calculate mean return
    const meanReturn = returns.mean();

    // Calculate standard deviation
    const centeredReturns = returns.sub(meanReturn); // Subtract mean from each element
    const variance = centeredReturns.pow(2).mean(); // Mean of squared differences
    const stdDev = Math.sqrt(variance);

    // Sharpe ratio (annualized, assuming hourly data)
    const sharpe = stdDev === 0 ? 0 : (meanReturn / stdDev) * Math.sqrt(365 * 24);

    // Equity curve and drawdown
    const equityCurveArray = data.map((_, i) => 
        result.initialCash + result.trades.slice(0, i + 1).reduce((sum, t) => sum + t.profit, 0)
    );
    const equityCurve = new Matrix([equityCurveArray]); // 1 x n matrix
    const peak = equityCurve.max();
    const current = equityCurve.get(0, equityCurve.columns - 1);
    const drawdown = peak === 0 ? 0 : (peak - current) / peak;

    // console.log(`[DEBUG] ${result.pair} metrics: trades=${result.tradeCount}, sharpe=${sharpe}, drawdown=${drawdown}`);
    return { trades: result.tradeCount, sharpe, drawdown };
}

// Backtest
function backtest(data, signals, pair, tempPortfolio) {
    let { cash, position, entryPrice, highestPrice, lowestPrice, trades, takeProfitLevels, trend, atr, historicalData, tradeLog } = tempPortfolio;
    cash = cash || tempPortfolio.initialCash;
    position = position || 0;
    entryPrice = entryPrice || 0;
    highestPrice = highestPrice || 0;
    lowestPrice = lowestPrice || Infinity;
    trades = trades || [];
    takeProfitLevels = takeProfitLevels || null;
    trend = trend || 'up';
    atr = atr || calculateATR(data.map(d => d.high), data.map(d => d.low), data.map(d => d.close));
    historicalData = historicalData || data;
    tradeLog = tradeLog || [];

    const loopLength = Math.min(signals.length, data.length);
    for (let i = 0; i < loopLength; i++) {
        const price = data[i].close;
        if (!isFinite(price) || price <= 0) continue;
        const volatility = atr[i] || 0;
        const signal = signals[i];
        const timestamp = data[i].timestamp.getTime();

        if (position !== 0) {
            highestPrice = Math.max(highestPrice, price);
            lowestPrice = Math.min(lowestPrice, price);
            const isShort = position < 0;
            const stopLossPrice = calculateStopLoss(entryPrice, volatility, trend, isShort);
            const trailingStopPrice = isShort ? lowestPrice + volatility * config.risk.trailingStopMultiplier : highestPrice - volatility * config.risk.trailingStopMultiplier;

            if (takeProfitLevels?.length > 0) {
                const nextTP = takeProfitLevels[0];
                const tpHit = isShort ? price <= nextTP.price : price >= nextTP.price;
                if (tpHit) {
                    const sellAmount = Math.abs(position) * nextTP.portion;
                    const profit = isShort ? sellAmount * (entryPrice - price) : sellAmount * (price - entryPrice);
                    if (!isFinite(profit)) continue;
                    cash += sellAmount * price * (isShort ? -1 : 1);
                    position -= sellAmount * (isShort ? -1 : 1);
                    trades.push({ price, profit });
                    logTrade(pair, isShort ? 'close_short' : 'take_profit', price, sellAmount, profit, tempPortfolio, timestamp);
                    takeProfitLevels.shift();
                    if (takeProfitLevels.length === 0) takeProfitLevels = null;
                    continue;
                }
            }

            const exitCondition = (isShort && (signal.action === 1 || price >= stopLossPrice || price >= trailingStopPrice)) ||
                                  (!isShort && (signal.action === -1 || price <= stopLossPrice || price <= trailingStopPrice));
            if (exitCondition) {
                const profit = isShort ? Math.abs(position) * (entryPrice - price) : position * (price - entryPrice);
                if (!isFinite(profit)) continue;
                cash += Math.abs(position) * price * (isShort ? -1 : 1);
                trades.push({ price, profit });
                logTrade(pair, isShort ? 'close_short' : 'sell', price, Math.abs(position), profit, tempPortfolio, timestamp);
                position = 0;
                highestPrice = 0;
                lowestPrice = Infinity;
                takeProfitLevels = null;
            }
        }

        if (signal.action === 1 && cash >= config.trading.minCashForTrade && position === 0) {
            const quantity = Math.min(calculatePositionSize(pair, signal.strength, { ...tempPortfolio, cash, trades, atr }), cash / price);
            if (!isFinite(quantity) || quantity <= 0) continue;
            position += quantity;
            entryPrice = price;
            highestPrice = price;
            lowestPrice = price;
            cash -= quantity * price;
            takeProfitLevels = setupTakeProfitLevels(entryPrice, volatility);
            trades.push({ price, profit: 0 });
            logTrade(pair, 'buy', price, quantity, 0, tempPortfolio, timestamp);
        } else if (signal.action === -1 && cash >= config.trading.minCashForTrade && position === 0) {
            const quantity = Math.min(calculatePositionSize(pair, signal.strength, { ...tempPortfolio, cash, trades, atr }), cash / price);
            if (!isFinite(quantity) || quantity <= 0) continue;
            position -= quantity;
            entryPrice = price;
            highestPrice = price;
            lowestPrice = price;
            cash += quantity * price;
            takeProfitLevels = setupTakeProfitLevels(entryPrice, volatility).map(tp => ({ price: entryPrice - (tp.price - entryPrice), portion: tp.portion }));
            trades.push({ price, profit: 0 });
            logTrade(pair, 'short', price, quantity, 0, tempPortfolio, timestamp);
        }
    }

    const finalPrice = data[data.length - 1].close;
    const finalValue = isFinite(cash + (position * finalPrice * (position < 0 ? -1 : 1))) 
        ? cash + (position * finalPrice * (position < 0 ? -1 : 1)) 
        : tempPortfolio.initialCash;
    const winRate = trades.length > 0 ? trades.filter(t => t.profit > 0).length / trades.length : 0;
    const result = { 
        finalValue, 
        profit: finalValue - tempPortfolio.initialCash, 
        winRate, 
        tradeCount: trades.length, 
        cash, 
        position, 
        trades, 
        initialCash: tempPortfolio.initialCash,
        pair 
    };

    tempPortfolio.cash = cash;
    tempPortfolio.position = position;
    tempPortfolio.entryPrice = entryPrice;
    tempPortfolio.highestPrice = highestPrice;
    tempPortfolio.lowestPrice = lowestPrice;
    tempPortfolio.trades = trades;
    tempPortfolio.takeProfitLevels = takeProfitLevels;
    tempPortfolio.tradeLog = tradeLog;

    if (trades.length >= 10) {
        tempPortfolio.historicalData = historicalData;
        const mlModel = trainSignalModel(pair, trades, historicalData);
        if (mlModel) {
            portfolio[pair] = { ...tempPortfolio, mlModel };
        } else {
            console.warn(`[WARN] Skipping portfolio update for ${pair} due to failed model training`);
        }
    }

    // console.log(`[DEBUG] ${pair} backtest result:`, { trades: result.trades.length, finalValue: result.finalValue });
    const metrics = calculateRiskAdjustedMetrics(result, data);
    return { ...result, ...metrics };
}

// Pair Analysis
async function analyzePairPerformance(pair, fullResult) {
    const data = fullResult.data;
    if (!data || !Array.isArray(data) || data.length === 0) {
        console.error(`[${pair}] Error: Invalid or empty data in fullResult`);
        return false; // Early return if data is invalid
    }

    const signals = generateSignals(data, pair);
    const indicatorScore = calculateIndicatorAlignmentScore(data);
    const volumeProfile = analyzeVolumeProfile(data);

    const performance = [];
    for (const count of config.backtest.performancePeriods) {
        if (count > data.length) continue;
        const slicedData = data.slice(-count);
        const slicedSignals = signals.slice(-count);
        const tempPortfolio = {
            initialCash: portfolio[pair]?.initialCash || config.trading.initialCash / config.trading.topPairs,
            cash: portfolio[pair]?.initialCash || config.trading.initialCash / config.trading.topPairs,
            position: 0,
            entryPrice: 0,
            highestPrice: 0,
            lowestPrice: Infinity,
            trades: [], // Always initialize trades
            atr: calculateATR(slicedData.map(d => d.high), slicedData.map(d => d.low), slicedData.map(d => d.close)),
            tradeLog: [] // Initialize tradeLog
        };
        const backtestResult = backtest(slicedData, slicedSignals, pair, tempPortfolio);
        if (backtestResult) {
            performance.push({ count, ...backtestResult });
        } else {
            console.warn(`[${pair}] Warning: Backtest failed for period ${count}`);
        }
    }

    if (performance.length === 0) {
        console.error(`[${pair}] Error: No performance data generated`);
        return false; // Early return if no valid backtest results
    }

    const keyMetrics = performance.filter(p => [250, 500, 1000].includes(p.count));
    const longTerm = performance.find(p => p.count === 1000) || performance[performance.length - 1];

    // Use correct property names from calculateRiskAdjustedMetrics and add fallbacks
    const profit = longTerm.profit ?? 0;
    const winRate = longTerm.winRate ?? 0;
    const tradeCount = longTerm.tradeCount ?? 0;
    const sharpe = longTerm.sharpe ?? 0; // Changed from sharpeRatio
    const drawdown = longTerm.drawdown ?? 0; // Changed from maxDrawdown

    const isAcceptable = keyMetrics.every(p => p.profit > 0) &&
                        winRate >= config.pairCriteria.minWinRate &&
                        profit >= config.pairCriteria.minProfit &&
                        tradeCount >= config.pairCriteria.minTradeCount &&
                        indicatorScore.score >= config.pairCriteria.minIndicatorScore &&
                        volumeProfile.volumeQualityScore >= config.pairCriteria.minVolumeScore &&
                        sharpe >= config.pairCriteria.minSharpeRatio && // Updated to sharpe
                        drawdown <= config.pairCriteria.maxDrawdown;   // Updated to drawdown

    const statusEmoji = isAcceptable ? '✅' : '❌';
    console.log(`[${pair}] ${statusEmoji} Acceptable: ${isAcceptable} | 💰 Profit: ${profit.toFixed(2)} | 🎯 WinRate: ${(winRate * 100).toFixed(2)}% | ` +
        `📈 IndicatorScore: ${indicatorScore.score.toFixed(2)} | 🔊 VolumeScore: ${volumeProfile.volumeQualityScore.toFixed(2)} | ` +
        `⚖️ Sharpe: ${sharpe.toFixed(2)} | 📉 Drawdown: ${drawdown.toFixed(2)}`);
                        
    return isAcceptable;
}

// Pair Selection
async function findBestPairs() {
    const markets = await exchange.loadMarkets();
    const usdtPairs = Object.keys(markets).filter(s => s.endsWith('/USDT') && markets[s].active).slice(0, config.trading.pairLimit);
    const results = [];

    for (const pair of usdtPairs) {
        try {
            const timeframe = await timeframeSelector(pair);
            const ohlcv = await exchange.fetchOHLCV(pair, timeframe, undefined, config.backtest.lookbackCandles);
            const data = ohlcv.map(candle => ({ timestamp: new Date(candle[0]), open: candle[1], high: candle[2], low: candle[3], close: candle[4], volume: candle[5] }));
            const tempPortfolio = { 
                initialCash: config.trading.initialCash / config.trading.topPairs, 
                cash: config.trading.initialCash / config.trading.topPairs, 
                position: 0, 
                entryPrice: 0, 
                highestPrice: 0, 
                lowestPrice: Infinity, 
                trades: [], 
                atr: calculateATR(data.map(d => d.high), data.map(d => d.low), data.map(d => d.close)),
                historicalData: data,
                tradeLog: [] // Add tradeLog
            };
            const optimizedParams = await optimizeIndicatorParameters(pair);
            if (optimizedParams) {
                portfolio[pair] = { ...tempPortfolio, params: optimizedParams }; // Include tradeLog in initialization
                const signals = generateSignals(data, pair);
                const backtestResult = backtest(data, signals, pair, portfolio[pair]);
                const multiTf = await analyzeMultipleTimeframes(pair);
                results.push({ pair, profit: backtestResult.profit, winRate: backtestResult.winRate, tradeCount: backtestResult.tradeCount, data, alignmentScore: multiTf.alignmentScore, backtestResult, timeframe });
                console.log(`📊 Pair #${usdtPairs.indexOf(pair) + 1} - ${pair} Results: ` +
                    `Profit: $${backtestResult.profit.toFixed(2)} 💰, ` +
                    `Win Rate: ${(backtestResult.winRate * 100).toFixed(2)}% 🎯, ` +
                    `Trades: ${backtestResult.tradeCount} 🔄, ` +
                    `Alignment Score: ${multiTf.alignmentScore.toFixed(2)} 🌐`);
            }else {
                console.log(`⚠️ Pair #${usdtPairs.indexOf(pair) + 1} - ${pair}: No optimized params found`);
            }
        } catch (error) {
            console.error(`[${pair}] Error: ${error.message}`);
        }
    }

    const initialCandidates = results.filter(r => 
        r.tradeCount >= config.pairCriteria.minTradeCount && 
        r.winRate >= config.pairCriteria.minWinRate && 
        r.profit >= config.pairCriteria.minProfit
    );
    console.log('🎉 Initial Candidates:', initialCandidates.map(c => c.pair).join(', ') || 'None');

    const validPairs = [];
    for (const candidate of initialCandidates) {
        if (await analyzePairPerformance(candidate.pair, candidate)) {
            validPairs.push(candidate);
        }
    }
    console.log('✅ Valid Pairs:', validPairs.map(v => v.pair).join(', ') || 'None');

    const correlationMatrix = await analyzeMarketCorrelations(validPairs.map(r => r.pair));
    console.log('🔗 Correlation Matrix:', correlationMatrix);

    const groups = groupPairsByCorrelation(correlationMatrix);
    console.log('👥 Correlation Groups:', JSON.stringify(groups));

    const pairScores = Object.fromEntries(validPairs.map(r => [r.pair, r.profit]));
    console.log('📈 Pair Scores:', JSON.stringify(pairScores));

    const finalPairs = selectDiversePairs(groups, pairScores).filter(p => p && typeof p === 'string');
    console.log('🏆 Final Pairs:', finalPairs.join(', ') || 'None');
    return finalPairs;
}

// WebSocket Monitoring
async function startRealTimeMonitoring() {
    for (const pair of tradingPairs) {
        const timeframe = portfolio[pair].timeframe || await timeframeSelector(pair);
        portfolio[pair].timeframe = timeframe;
        const wsSymbol = pair.replace('/', '').toLowerCase();
        let data = [];

        portfolio[pair] = { initialCash: portfolio[pair].initialCash, cash: portfolio[pair].initialCash, position: 0, entryPrice: 0, highestPrice: 0, lowestPrice: Infinity, trades: [], takeProfitLevels: null, trend: portfolio[pair].trend, atr: portfolio[pair].atr, params: portfolio[pair].params, timeframe, tradeLog: [] };
        let { cash, position, entryPrice, highestPrice, lowestPrice, trades, takeProfitLevels } = portfolio[pair];

        try {
            const ohlcv = await exchange.fetchOHLCV(pair, timeframe, undefined, config.websocket.maxDataLength);
            data = ohlcv.map(candle => ({ timestamp: new Date(candle[0]), open: parseFloat(candle[1]), high: parseFloat(candle[2]), low: parseFloat(candle[3]), close: parseFloat(candle[4]), volume: parseFloat(candle[5]) }));
        } catch (error) {
            console.error(`[${pair}] Error fetching historical data: ${error.message}`);
            continue;
        }

        const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${wsSymbol}@kline_${timeframe}`);
        wsConnections[pair] = ws;

        let reconnectAttempts = 0;
        let heartbeatInterval;

        const setupHandlers = () => {
            ws.on('open', () => {
                console.log(`[${pair}] 🌐 WebSocket connected (${timeframe}) 📡`);
                reconnectAttempts = 0;
                heartbeatInterval = setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) ws.ping('heartbeat');
                }, config.websocket.heartbeatInterval);
            });

            ws.on('message', async (msg) => {
                const parsed = JSON.parse(msg);
                const candle = parsed.k;
                if (candle.x) {
                    const newCandle = { timestamp: new Date(candle.t), open: parseFloat(candle.o), high: parseFloat(candle.h), low: parseFloat(candle.l), close: parseFloat(candle.c), volume: parseFloat(candle.v) };
                    data.push(newCandle);
                    if (data.length > config.websocket.maxDataLength) data.shift();

                    const signals = generateSignals(data, pair);
                    const signal = signals[signals.length - 1];
                    const price = newCandle.close;
                    const volatility = calculateATR(data.map(d => d.high), data.map(d => d.low), data.map(d => d.close))[data.length - 1];
                    portfolio[pair].atr = calculateATR(data.map(d => d.high), data.map(d => d.low), data.map(d => d.close));

                    if (position !== 0) {
                        highestPrice = Math.max(highestPrice, price);
                        lowestPrice = Math.min(lowestPrice, price);
                        const isShort = position < 0;
                        const stopLossPrice = calculateStopLoss(entryPrice, volatility, portfolio[pair].trend, isShort);
                        const trailingStopPrice = isShort ? lowestPrice + volatility * config.risk.trailingStopMultiplier : highestPrice - volatility * config.risk.trailingStopMultiplier;

                        if (takeProfitLevels?.length > 0) {
                            const nextTP = takeProfitLevels[0];
                            const tpHit = isShort ? price <= nextTP.price : price >= nextTP.price;
                            if (tpHit) {
                                const sellAmount = Math.abs(position) * nextTP.portion;
                                const profit = isShort ? sellAmount * (entryPrice - price) : sellAmount * (price - entryPrice);
                                cash += sellAmount * price * (isShort ? -1 : 1);
                                position -= sellAmount * (isShort ? -1 : 1);
                                trades.push({ price, profit });
                                logTrade(pair, isShort ? 'close_short' : 'take_profit', price, sellAmount, profit);
                                takeProfitLevels.shift();
                                if (takeProfitLevels.length === 0) takeProfitLevels = null;
                            }
                        }

                        const exitCondition = (isShort && (signal.action === 1 || price >= stopLossPrice || price >= trailingStopPrice)) ||
                                              (!isShort && (signal.action === -1 || price <= stopLossPrice || price <= trailingStopPrice));
                        if (exitCondition) {
                            const profit = isShort ? Math.abs(position) * (entryPrice - price) : position * (price - entryPrice);
                            cash += Math.abs(position) * price * (isShort ? -1 : 1);
                            trades.push({ price, profit });
                            logTrade(pair, isShort ? 'close_short' : 'sell', price, Math.abs(position), profit);
                            position = 0;
                            highestPrice = 0;
                            lowestPrice = Infinity;
                            takeProfitLevels = null;
                        }
                    }

                    if (signal.action === 1 && cash >= config.trading.minCashForTrade && position === 0) {
                        const quantity = calculatePositionSize(pair, signal.strength, { ...portfolio[pair], cash, trades });
                        position += quantity;
                        entryPrice = price;
                        highestPrice = price;
                        lowestPrice = price;
                        cash -= quantity * price;
                        takeProfitLevels = setupTakeProfitLevels(entryPrice, volatility);
                        logTrade(pair, 'buy', price, quantity, 0);
                    } else if (signal.action === -1 && cash >= config.trading.minCashForTrade && position === 0) {
                        const quantity = calculatePositionSize(pair, signal.strength, { ...portfolio[pair], cash, trades });
                        position -= quantity;
                        entryPrice = price;
                        highestPrice = price;
                        lowestPrice = price;
                        cash += quantity * price;
                        takeProfitLevels = setupTakeProfitLevels(entryPrice, volatility).map(tp => ({ price: entryPrice - (tp.price - entryPrice), portion: tp.portion }));
                        logTrade(pair, 'short', price, quantity, 0);
                    }

                    portfolio[pair] = { ...portfolio[pair], cash, position, entryPrice, highestPrice, lowestPrice, trades, takeProfitLevels };
                    console.log(`[${pair}] 💼 Portfolio: 💵 Cash=${cash.toFixed(2)} | 📊 Position=${position.toFixed(6)} | 💰 Value=${(cash + position * price).toFixed(2)}`);
                }
            });

            ws.on('error', (error) => console.error(`[${pair}] WebSocket error: ${error.message}`));
            ws.on('close', () => {
                console.log(`[${pair}] 🌐 WebSocket closed 🚫, reconnecting... 🔄`);
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
}

// Portfolio Rebalancing
async function rebalancePortfolio() {
    const totalValue = await tradingPairs.reduce(async (sum, pair) => {
        const ticker = await exchange.fetchTicker(pair);
        return (await sum) + (portfolio[pair].cash + portfolio[pair].position * ticker.last);
    }, Promise.resolve(0));
    const targetPerPair = totalValue / tradingPairs.length;

    for (const pair of tradingPairs) {
        const ticker = await exchange.fetchTicker(pair);
        const currentValue = portfolio[pair].cash + portfolio[pair].position * ticker.last;
        if (currentValue > targetPerPair * config.rebalancing.upperThreshold) {
            const excess = currentValue - targetPerPair;
            portfolio[pair].cash -= excess;
            console.log(`[${pair}] 💸 Withdrawing ${excess.toFixed(2)} USD 🔧 for rebalancing`);
        } else if (currentValue < targetPerPair * config.rebalancing.lowerThreshold) {
            const deficit = targetPerPair - currentValue;
            portfolio[pair].cash += deficit;
            console.log(`[${pair}] ➕ Adding ${deficit.toFixed(2)} USD 🔧 for rebalancing`);
        }
    }
}

// Main Logic
async function runBot() {
    const bestPairs = await findBestPairs();
    if (bestPairs.length === 0) {
        console.log('🚫 No suitable pairs found. 😞');
        return;
    }

    tradingPairs = bestPairs//.map(p => p.pair);
    const cashPerPair = config.trading.initialCash / tradingPairs.length;

    console.log(`🌟 Selected pairs: ${tradingPairs.join(', ')} 🎉`);

    for (const pair of tradingPairs) {
        if (pair){
            const timeframe = await timeframeSelector(pair);
            const ohlcv = await exchange.fetchOHLCV(pair, timeframe, undefined, config.backtest.lookbackCandles);
            const data = ohlcv.map(candle => ({ timestamp: new Date(candle[0]), open: candle[1], high: candle[2], low: candle[3], close: candle[4], volume: candle[5] }));
            const signals = generateSignals(data, pair);
            const tempPortfolio = { initialCash: cashPerPair, cash: cashPerPair, position: 0, entryPrice: 0, highestPrice: 0, lowestPrice: Infinity, trades: [], atr: calculateATR(data.map(d => d.high), data.map(d => d.low), data.map(d => d.close)), trend: (await analyzeMultipleTimeframes(pair)).primaryTrend, timeframe };
            const backtestResult = backtest(data, signals, pair, tempPortfolio);
            portfolio[pair] = { ...tempPortfolio, params: portfolio[pair]?.params, trend: tempPortfolio.trend, timeframe };
            console.log(`[${pair}] 🔍 Pre-Monitoring Backtest: 💰 Profit=${backtestResult.profit.toFixed(2)}`);
        }
    }

    await startRealTimeMonitoring();
    setInterval(async () => { await reassessPairsPerformance(); await rebalancePortfolio(); }, config.trading.reassessInterval);
}

async function reassessPairsPerformance() {
    console.log("🔄 Reassessing pairs... 👀");
    const newBestPairs = await findBestPairs();
    const pairsToRemove = tradingPairs.filter(p => !newBestPairs.some(np => np.pair === p));
    const pairsToAdd = newBestPairs.filter(np => !tradingPairs.includes(np.pair)).map(np => np.pair);

    if (pairsToRemove.length === 0 && pairsToAdd.length === 0) return;

    let totalAvailableCapital = 0;
    for (const pair of pairsToRemove) {
        if (portfolio[pair].position !== 0) {
            const ticker = await exchange.fetchTicker(pair);
            const profit = portfolio[pair].position > 0 ? portfolio[pair].position * (ticker.last - portfolio[pair].entryPrice) : Math.abs(portfolio[pair].position) * (portfolio[pair].entryPrice - ticker.last);
            portfolio[pair].cash += Math.abs(portfolio[pair].position) * ticker.last * (portfolio[pair].position < 0 ? -1 : 1);
            portfolio[pair].trades.push({ price: ticker.last, profit });
            logTrade(pair, portfolio[pair].position < 0 ? 'close_short' : 'sell', ticker.last, Math.abs(portfolio[pair].position), profit);
            if (wsConnections[pair]?.readyState === WebSocket.OPEN) wsConnections[pair].close();
        }
        totalAvailableCapital += portfolio[pair].cash;
        delete portfolio[pair];
    }

    const retainedPairs = tradingPairs.filter(p => newBestPairs.some(np => np.pair === p));
    for (const pair of retainedPairs) {
        const redistributionAmount = portfolio[pair].cash * 0.3;
        portfolio[pair].cash -= redistributionAmount;
        totalAvailableCapital += redistributionAmount;
    }

    const capitalPerPair = totalAvailableCapital / newBestPairs.length;
    for (const pair of newBestPairs.map(p => p.pair)) {
        if (retainedPairs.includes(pair)) {
            portfolio[pair].cash += capitalPerPair - (portfolio[pair].cash * 0.7);
        } else {
            portfolio[pair] = { initialCash: capitalPerPair, cash: capitalPerPair, position: 0, entryPrice: 0, highestPrice: 0, lowestPrice: Infinity, trades: [], takeProfitLevels: null, atr: calculateATR((await exchange.fetchOHLCV(pair, await timeframeSelector(pair), undefined, config.websocket.maxDataLength)).map(c => c[2]), (await exchange.fetchOHLCV(pair, await timeframeSelector(pair), undefined, config.websocket.maxDataLength)).map(c => c[3]), (await exchange.fetchOHLCV(pair, await timeframeSelector(pair), undefined, config.websocket.maxDataLength)).map(c => c[4])), trend: (await analyzeMultipleTimeframes(pair)).primaryTrend, params: portfolio[pair]?.params, timeframe: await timeframeSelector(pair), tradeLog: [] };
            await startPairMonitoring(pair);
        }
    }

    tradingPairs = newBestPairs.map(p => p.pair);
}

async function startPairMonitoring(pair) {
    const wsSymbol = pair.replace('/', '').toLowerCase();
    const ohlcv = await exchange.fetchOHLCV(pair, config.backtest.timeframe, undefined, config.websocket.maxDataLength);
    const data = ohlcv.map(candle => ({
        timestamp: new Date(candle[0]),
        open: parseFloat(candle[1]),
        high: parseFloat(candle[2]),
        low: parseFloat(candle[3]),
        close: parseFloat(candle[4]),
        volume: parseFloat(candle[5]),
    }));

    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${wsSymbol}@kline_${config.backtest.timeframe}`);
    wsConnections[pair] = ws;

    let reconnectAttempts = 0;
    let heartbeatInterval;

    const setupHandlers = () => {
        ws.on('open', () => {
            console.log(`[${pair}] 🌐 WebSocket connected 📡`);
            reconnectAttempts = 0;
            heartbeatInterval = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) ws.ping('heartbeat');
            }, config.websocket.heartbeatInterval);
        });

        ws.on('message', (msg) => {
            const parsed = JSON.parse(msg);
            const candle = parsed.k;
            if (candle.x) {
                const newCandle = {
                    timestamp: new Date(candle.t),
                    open: parseFloat(candle.o),
                    high: parseFloat(candle.h),
                    low: parseFloat(candle.l),
                    close: parseFloat(candle.c),
                    volume: parseFloat(candle.v),
                };
                data.push(newCandle);
                if (data.length > config.websocket.maxDataLength) data.shift();

                const signals = generateSignals(data, pair);
                const signal = signals[signals.length - 1];
                const price = newCandle.close;
                const volatility = calculateATR(data.map(d => d.high), data.map(d => d.low), data.map(d => d.close))[data.length - 1];

                let { cash, position, entryPrice, highestPrice, trades, takeProfitLevels } = portfolio[pair];

                if (position > 0) {
                    highestPrice = Math.max(highestPrice, price);
                    const stopLossPrice = calculateStopLoss(entryPrice, volatility, portfolio[pair].trend);
                    const trailingStopPrice = highestPrice - volatility * config.risk.trailingStopMultiplier;

                    if (takeProfitLevels?.length > 0) {
                        const nextTP = takeProfitLevels[0];
                        if (price >= nextTP.price) {
                            const sellAmount = position * nextTP.portion;
                            const profit = sellAmount * (price - entryPrice);
                            cash += sellAmount * price;
                            position -= sellAmount;
                            trades.push({ price, profit });
                            takeProfitLevels.shift();
                            if (takeProfitLevels.length === 0) takeProfitLevels = null;
                            console.log(`[${pair}] 🎯 Take Profit: Sold ${sellAmount.toFixed(6)} 📤 at $${price} 💵`);
                        }
                    }

                    if (signal.action === -1 || price <= stopLossPrice || price <= trailingStopPrice) {
                        const profit = position * (price - entryPrice);
                        cash += position * price;
                        trades.push({ price, profit });
                        position = 0;
                        highestPrice = 0;
                        takeProfitLevels = null;
                        console.log(`[${pair}] 📉 Sell: ${position.toFixed(6)} 📤 at $${price} 💵`);
                    }
                }

                if (signal.action === 1 && cash >= config.trading.minCashForTrade) {
                    const quantity = calculatePositionSize(pair, signal.strength, { ...portfolio[pair], cash, trades });
                    position += quantity;
                    entryPrice = price;
                    highestPrice = price;
                    cash -= quantity * price;
                    takeProfitLevels = setupTakeProfitLevels(entryPrice, volatility);
                    console.log(`📈 [${pair}] Buy: ${quantity.toFixed(6)} at 💲${price}`);
                }

                portfolio[pair] = { ...portfolio[pair], cash, position, entryPrice, highestPrice, trades, takeProfitLevels };
            }
        });

        ws.on('error', (error) => console.error(`[${pair}] WebSocket error: ${error.message}`));
        ws.on('close', () => {
            console.log(`🔌 [${pair}] WebSocket closed, 🔁 reconnecting...`);
            clearInterval(heartbeatInterval);
            if (reconnectAttempts < config.websocket.maxReconnectAttempts) {
                setTimeout(() => {
                    wsConnections[pair] = new WebSocket(`wss://stream.binance.com:9443/ws/${wsSymbol}@kline_${config.backtest.timeframe}`);
                    setupHandlers();
                    reconnectAttempts++;
                }, Math.min(1000 * Math.pow(2, reconnectAttempts), 60000));
            }
        });
    };

    setupHandlers();
}

// Start Bot
runBot();
// end v7