// START v1
// const ccxt = require('ccxt');
// const WebSocket = require('ws');

// // Initialize Binance exchange
// const exchange = new ccxt.binance({
//     apiKey: 'xdqcpFgxkWKQ64rPtpCBlWCMjl8IROz7EMyssCUxFRfdkXqVN0cAXyTbbSt8HhY2',
//     secret: 'B5tflivSc96gga7D4j47aE9PoKHU5nEsl9vqoR9G0i029FtrDbo7o1BvLdtomAVd',
//     enableRateLimit: true,
// });

// // Function to calculate moving average
// function calculateMA(prices, period) {
//     const ma = [];
//     for (let i = 0; i < prices.length; i++) {
//         if (i < period - 1) {
//             ma.push(null); // Not enough data yet
//         } else {
//             const slice = prices.slice(i - period + 1, i + 1);
//             ma.push(slice.reduce((a, b) => a + b, 0) / period);
//         }
//     }
//     return ma;
// }

// // Function to place orders (simulated or live)
// async function placeOrder(exchange, side, quantity) {
//     try {
//         if (side === 'buy') {
//             const order = await exchange.createMarketBuyOrder('BTC/USDT', quantity);
//             console.log('Buy order:', order);
//             return order;
//         } else if (side === 'sell') {
//             const order = await exchange.createMarketSellOrder('BTC/USDT', quantity);
//             console.log('Sell order:', order);
//             return order;
//         }
//     } catch (error) {
//         console.error('Order failed:', error.message);
//         return null;
//     }
// }

// // Backtest function with stop-loss
// function backtest(closes, signals, stopLossPercent = 0.02) {
//     let cash = 1000; // Starting USD
//     let position = 0; // BTC held
//     let entryPrice = 0;

//     for (let i = 0; i < signals.length; i++) {
//         if (position > 0 && closes[i] < entryPrice * (1 - stopLossPercent)) {
//             console.log(`Stop-loss triggered at ${closes[i]}`);
//             cash = position * closes[i];
//             position = 0;
//         }
//         if (signals[i] === 1 && cash > 0) {
//             const quantity = cash / closes[i];
//             console.log(`Simulated buy: ${quantity.toFixed(6)} BTC at ${closes[i]}`);
//             position += quantity;
//             entryPrice = closes[i];
//             cash = 0;
//         } else if (signals[i] === -1 && position > 0) {
//             console.log(`Simulated sell: ${position.toFixed(6)} BTC at ${closes[i]}`);
//             cash = position * closes[i];
//             position = 0;
//         }
//     }
//     const finalValue = cash + (position * closes[closes.length - 1]);
//     console.log(`Final value: ${finalValue.toFixed(2)} USD`);
//     return finalValue;
// }

// // Main trading bot logic
// async function runBot() {
//     try {
//         // Fetch historical data
//         const ohlcv = await exchange.fetchOHLCV('BTC/USDT', '5m', undefined, 100);
//         const data = ohlcv.map(candle => ({
//             timestamp: new Date(candle[0]),
//             open: candle[1],
//             high: candle[2],
//             low: candle[3],
//             close: candle[4],
//             volume: candle[5],
//         }));
//         const closes = ohlcv.map(candle => candle[4]);

//         console.log('Last 5 candles:', data.slice(-5));

//         // Calculate moving averages
//         const shortMA = calculateMA(closes, 5);
//         const longMA = calculateMA(closes, 20);

//         // Generate signals
//         const signals = closes.map((_, i) => {
//             if (i < 20) return 0; // Wait for enough data
//             const short = shortMA[i];
//             const long = longMA[i];
//             const prevShort = shortMA[i - 1];
//             const prevLong = longMA[i - 1];
//             if (!prevShort || !prevLong) return 0; // Avoid undefined
//             if (prevShort <= prevLong && short > long) return 1; // Buy
//             if (prevShort >= prevLong && short < long) return -1; // Sell
//             return 0; // Hold
//         });

//         console.log('Last 5 signals:', signals.slice(-5));

//         // Run simulation/backtest
//         const finalValue = backtest(closes, signals);

//         // Uncomment below for live trading (use with caution!)
//         /*
//         let cash = 1000;
//         let position = 0;
//         for (let i = 0; i < signals.length; i++) {
//             if (signals[i] === 1 && cash > 0) {
//                 const quantity = cash / closes[i];
//                 await placeOrder(exchange, 'buy', quantity);
//                 position += quantity;
//                 cash = 0;
//             } else if (signals[i] === -1 && position > 0) {
//                 await placeOrder(exchange, 'sell', position);
//                 cash = position * closes[i];
//                 position = 0;
//             }
//         }
//         console.log(`Final cash: ${cash}, Position: ${position}`);
//         */
//     } catch (error) {
//         console.error('Bot error:', error.message);
//     }
// }

// // Real-time WebSocket for live data
// function startRealTimeMonitoring() {
//     const ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@kline_5m');
//     let closes = []; // Store real-time close prices

//     ws.on('message', (data) => {
//         const msg = JSON.parse(data);
//         if (msg.k && msg.k.x) { // k.x = true when candle is closed
//             const close = parseFloat(msg.k.c);
//             console.log(`New close price: ${close}`);
//             closes.push(close);

//             // Keep only last 100 candles
//             if (closes.length > 100) closes.shift();

//             // Recalculate MAs and signals
//             if (closes.length >= 20) {
//                 const shortMA = calculateMA(closes, 5);
//                 const longMA = calculateMA(closes, 20);
//                 const latestShort = shortMA[shortMA.length - 1];
//                 const latestLong = longMA[longMA.length - 1];
//                 const prevShort = shortMA[shortMA.length - 2];
//                 const prevLong = longMA[longMA.length - 2];

//                 if (prevShort && prevLong) {
//                     if (prevShort <= prevLong && latestShort > latestLong) {
//                         console.log('Real-time Buy signal!');
//                         // Add live buy logic here
//                     } else if (prevShort >= prevLong && latestShort < latestLong) {
//                         console.log('Real-time Sell signal!');
//                         // Add live sell logic here
//                     }
//                 }
//             }
//         }
//     });

//     ws.on('error', (error) => console.error('WebSocket error:', error));
//     ws.on('open', () => console.log('WebSocket connected'));
// }

// // Run the bot and start real-time monitoring
// runBot();
// startRealTimeMonitoring();
// END V1

// START v2
// const ccxt = require('ccxt');
// const WebSocket = require('ws');

// const exchange = new ccxt.binance({
//     apiKey: 'xdqcpFgxkWKQ64rPtpCBlWCMjl8IROz7EMyssCUxFRfdkXqVN0cAXyTbbSt8HhY2',
//     secret: 'B5tflivSc96gga7D4j47aE9PoKHU5nEsl9vqoR9G0i029FtrDbo7o1BvLdtomAVd',
//     enableRateLimit: true,
// });

// // Indicator Functions
// function calculateMA(prices, period) {
//     const ma = [];
//     for (let i = 0; i < prices.length; i++) {
//         if (i < period - 1) ma.push(null);
//         else ma.push(prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period);
//     }
//     return ma;
// }

// function calculateEMA(prices, period) {
//     const k = 2 / (period + 1);
//     const ema = [prices[0]];
//     for (let i = 1; i < prices.length; i++) {
//         ema.push(prices[i] * k + ema[i - 1] * (1 - k));
//     }
//     return ema;
// }

// function calculateMACD(prices) {
//     const ema12 = calculateEMA(prices, 12);
//     const ema26 = calculateEMA(prices, 26);
//     const macd = ema12.map((v, i) => (i < 25 ? null : v - ema26[i]));
//     const signalRaw = calculateEMA(macd.slice(25), 9);
//     const signal = Array(25).fill(null).concat(signalRaw); // Align with macd
//     return { macd, signal };
// }

// function calculateRSI(prices, period = 14) {
//     const rsi = [];
//     for (let i = 0; i < prices.length; i++) {
//         if (i < period) rsi.push(null);
//         else {
//             const changes = prices.slice(i - period, i + 1).map((v, j, arr) => (j === 0 ? 0 : v - arr[j - 1]));
//             const gains = changes.reduce((sum, ch) => sum + (ch > 0 ? ch : 0), 0) / period;
//             const losses = Math.abs(changes.reduce((sum, ch) => sum + (ch < 0 ? ch : 0), 0)) / period;
//             const rs = losses === 0 ? 100 : gains / losses;
//             rsi.push(losses === 0 ? 100 : 100 - (100 / (1 + rs)));
//         }
//     }
//     return rsi;
// }

// function calculateBollingerBands(prices, period = 20, stdDevMultiplier = 2) {
//     const sma = calculateMA(prices, period);
//     const bands = [];
//     for (let i = 0; i < prices.length; i++) {
//         if (i < period - 1) bands.push({ upper: null, middle: null, lower: null });
//         else {
//             const slice = prices.slice(i - period + 1, i + 1);
//             const mean = sma[i];
//             const stdDev = Math.sqrt(slice.reduce((sum, v) => sum + (v - mean) ** 2, 0) / period);
//             bands.push({
//                 upper: mean + stdDevMultiplier * stdDev,
//                 middle: mean,
//                 lower: mean - stdDevMultiplier * stdDev,
//             });
//         }
//     }
//     return bands;
// }

// function calculateATR(highs, lows, closes, period = 14) {
//     const tr = [];
//     for (let i = 0; i < closes.length; i++) {
//         if (i === 0) tr.push(highs[i] - lows[i]);
//         else {
//             const hl = highs[i] - lows[i];
//             const hc = Math.abs(highs[i] - closes[i - 1]);
//             const lc = Math.abs(lows[i] - closes[i - 1]);
//             tr.push(Math.max(hl, hc, lc));
//         }
//     }
//     return calculateMA(tr, period);
// }

// // Backtest
// function backtest(data, signals, stopLossPercent = 0.02, trailingStopPercent = 0.005) {
//     let cash = 1000;
//     let position = 0;
//     let entryPrice = 0;
//     let highestPrice = 0;
//     const atr = calculateATR(data.map(d => d.high), data.map(d => d.low), data.map(d => d.close));

//     for (let i = 0; i < signals.length; i++) {
//         const price = data[i].close;
//         const volatility = atr[i] || 0;
//         const riskPerTrade = cash * 0.01;
//         const stopDistance = volatility * 2;
//         const quantity = volatility > 0 ? Math.min(riskPerTrade / stopDistance, cash / price) : cash / price;

//         if (position > 0) {
//             highestPrice = Math.max(highestPrice, price);
//             const trailingStopPrice = highestPrice * (1 - trailingStopPercent);
//             if (price <= trailingStopPrice) {
//                 console.log(`Trailing stop triggered at ${price}`);
//                 cash = position * price;
//                 position = 0;
//                 highestPrice = 0;
//             }
//         }

//         if (position > 0 && price < entryPrice * (1 - stopLossPercent)) {
//             console.log(`Stop-loss triggered at ${price}`);
//             cash = position * price;
//             position = 0;
//             highestPrice = 0;
//         }

//         if (signals[i] === 1 && cash > 0) {
//             const buyQuantity = quantity;
//             console.log(`Simulated buy: ${buyQuantity.toFixed(6)} BTC at ${price}`);
//             position += buyQuantity;
//             entryPrice = price;
//             highestPrice = price;
//             cash -= buyQuantity * price;
//         } else if (signals[i] === -1 && position > 0) {
//             console.log(`Simulated sell: ${position.toFixed(6)} BTC at ${price}`);
//             cash += position * price;
//             position = 0;
//             highestPrice = 0;
//         }
//     }
//     const finalValue = cash + (position * data[data.length - 1].close);
//     console.log(`Final value: ${finalValue.toFixed(2)} USD`);
//     return finalValue;
// }

// // Main bot logic
// async function runBot() {
//     try {
//         const ohlcv = await exchange.fetchOHLCV('BTC/USDT', '5m', undefined, 100);
//         const data = ohlcv.map(candle => ({
//             timestamp: new Date(candle[0]),
//             open: candle[1],
//             high: candle[2],
//             low: candle[3],
//             close: candle[4],
//             volume: candle[5],
//         }));
//         const closes = data.map(d => d.close);

//         console.log('Last 5 candles:', data.slice(-5));

//         // Indicators
//         const shortMA = calculateMA(closes, 5);
//         const longMA = calculateMA(closes, 20);
//         const { macd, signal } = calculateMACD(closes);
//         const rsi = calculateRSI(closes);
//         const bb = calculateBollingerBands(closes);

//         // Signals
//         const signals = closes.map((_, i) => {
//             if (i < 25) return 0; // Reduced to wait for MACD only
//             const maBuy = shortMA[i] > longMA[i] && shortMA[i - 1] <= longMA[i - 1];
//             const maSell = shortMA[i] < longMA[i] && shortMA[i - 1] >= longMA[i - 1];
//             const macdBuy = i >= 25 && macd[i] > signal[i] && macd[i - 1] <= signal[i - 1];
//             const macdSell = i >= 25 && macd[i] < signal[i] && macd[i - 1] >= signal[i - 1];
//             const rsiValue = rsi[i] || 50; // Default if null
//             const price = closes[i];
//             const bbUpper = bb[i].upper || Infinity;
//             const bbLower = bb[i].lower || -Infinity;

//             if (i >= closes.length - 5) {
//                 console.log(`Candle ${i}: Price=${price}, ShortMA=${shortMA[i]?.toFixed(2) || 'N/A'}, LongMA=${longMA[i]?.toFixed(2) || 'N/A'}, MACD=${macd[i]?.toFixed(2) || 'N/A'}, Signal=${signal[i]?.toFixed(2) || 'N/A'}, RSI=${rsiValue.toFixed(2)}, BB Upper=${bbUpper.toFixed(2)}, BB Lower=${bbLower.toFixed(2)}`);
//             }

//             if ((maBuy || macdBuy) && rsiValue < 70 && price < bbUpper) return 1;
//             if ((maSell || macdSell) && rsiValue > 30 && price > bbLower) return -1;
//             return 0;
//         });

//         console.log('Last 5 signals:', signals.slice(-5));
//         backtest(data, signals);
//     } catch (error) {
//         console.error('Bot error:', error.message);
//     }
// }

// // Real-time monitoring
// function startRealTimeMonitoring() {
//     const ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@kline_5m');
//     let data = [];

//     ws.on('message', (msg) => {
//         const candle = JSON.parse(msg).k;
//         if (candle.x) {
//             const newCandle = {
//                 timestamp: new Date(candle.t),
//                 open: parseFloat(candle.o),
//                 high: parseFloat(candle.h),
//                 low: parseFloat(candle.l),
//                 close: parseFloat(candle.c),
//                 volume: parseFloat(candle.v),
//             };
//             data.push(newCandle);
//             if (data.length > 100) data.shift();

//             const closes = data.map(d => d.close);
//             if (closes.length >= 34) {
//                 const shortMA = calculateMA(closes, 5);
//                 const longMA = calculateMA(closes, 20);
//                 const { macd, signal } = calculateMACD(closes);
//                 const rsi = calculateRSI(closes);
//                 const bb = calculateBollingerBands(closes);
//                 const i = closes.length - 1;

//                 const maBuy = shortMA[i] > longMA[i] && shortMA[i - 1] <= longMA[i - 1];
//                 const maSell = shortMA[i] < longMA[i] && shortMA[i - 1] >= longMA[i - 1];
//                 const macdBuy = i >= 25 && macd[i] > signal[i] && macd[i - 1] <= signal[i - 1];
//                 const macdSell = i >= 25 && macd[i] < signal[i] && macd[i - 1] >= signal[i - 1];
//                 const rsiValue = rsi[i] || 50;
//                 const price = closes[i];
//                 const bbUpper = bb[i].upper || Infinity;
//                 const bbLower = bb[i].lower || -Infinity;

//                 if ((maBuy || macdBuy) && rsiValue < 70 && price < bbUpper) {
//                     console.log('Real-time Buy signal!');
//                 } else if ((maSell || macdSell) && rsiValue > 30 && price > bbLower) {
//                     console.log('Real-time Sell signal!');
//                 }
//             }
//         }
//     });

//     ws.on('error', (error) => console.error('WebSocket error:', error));
//     ws.on('open', () => console.log('WebSocket connected'));
// }

// runBot();
// startRealTimeMonitoring();
// END V2
// START v3
// const ccxt = require('ccxt');
// const WebSocket = require('ws');

// const exchange = new ccxt.binance({
//     apiKey: 'xdqcpFgxkWKQ64rPtpCBlWCMjl8IROz7EMyssCUxFRfdkXqVN0cAXyTbbSt8HhY2',
//     secret: 'B5tflivSc96gga7D4j47aE9PoKHU5nEsl9vqoR9G0i029FtrDbo7o1BvLdtomAVd',
//     enableRateLimit: true,
// });

// // Indicator Functions
// function calculateMA(prices, period) {
//     const ma = [];
//     for (let i = 0; i < prices.length; i++) {
//         if (i < period - 1) ma.push(null);
//         else ma.push(prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period);
//     }
//     return ma;
// }

// function calculateEMA(prices, period) {
//     const k = 2 / (period + 1);
//     const ema = [prices[0]];
//     for (let i = 1; i < prices.length; i++) {
//         ema.push(prices[i] * k + ema[i - 1] * (1 - k));
//     }
//     return ema;
// }

// function calculateMACD(prices) {
//     const ema12 = calculateEMA(prices, 12);
//     const ema26 = calculateEMA(prices, 26);
//     const macd = ema12.map((v, i) => (i < 25 ? null : v - ema26[i]));
//     const signalRaw = calculateEMA(macd.slice(25), 9);
//     const signal = Array(25).fill(null).concat(signalRaw);
//     return { macd, signal };
// }

// function calculateRSI(prices, period = 14) {
//     const rsi = [];
//     for (let i = 0; i < prices.length; i++) {
//         if (i < period) rsi.push(null);
//         else {
//             const changes = prices.slice(i - period, i + 1).map((v, j, arr) => (j === 0 ? 0 : v - arr[j - 1]));
//             const gains = changes.reduce((sum, ch) => sum + (ch > 0 ? ch : 0), 0) / period;
//             const losses = Math.abs(changes.reduce((sum, ch) => sum + (ch < 0 ? ch : 0), 0)) / period;
//             const rs = losses === 0 ? 100 : gains / losses;
//             rsi.push(losses === 0 ? 100 : 100 - (100 / (1 + rs)));
//         }
//     }
//     return rsi;
// }

// function calculateBollingerBands(prices, period = 20, stdDevMultiplier = 2) {
//     const sma = calculateMA(prices, period);
//     const bands = [];
//     for (let i = 0; i < prices.length; i++) {
//         if (i < period - 1) bands.push({ upper: null, middle: null, lower: null });
//         else {
//             const slice = prices.slice(i - period + 1, i + 1);
//             const mean = sma[i];
//             const stdDev = Math.sqrt(slice.reduce((sum, v) => sum + (v - mean) ** 2, 0) / period);
//             bands.push({
//                 upper: mean + stdDevMultiplier * stdDev,
//                 middle: mean,
//                 lower: mean - stdDevMultiplier * stdDev,
//             });
//         }
//     }
//     return bands;
// }

// function calculateATR(highs, lows, closes, period = 14) {
//     const tr = [];
//     for (let i = 0; i < closes.length; i++) {
//         if (i === 0) tr.push(highs[i] - lows[i]);
//         else {
//             const hl = highs[i] - lows[i];
//             const hc = Math.abs(highs[i] - closes[i - 1]);
//             const lc = Math.abs(lows[i] - closes[i - 1]);
//             tr.push(Math.max(hl, hc, lc));
//         }
//     }
//     return calculateMA(tr, period);
// }

// // Backtest
// function backtest(data, signals, stopLossPercent = 0.02, trailingStopPercent = 0.003) {
//     let cash = 1000;
//     let position = 0;
//     let entryPrice = 0;
//     let highestPrice = 0;
//     const atr = calculateATR(data.map(d => d.high), data.map(d => d.low), data.map(d => d.close));

//     for (let i = 0; i < signals.length; i++) {
//         const price = data[i].close;
//         const volatility = atr[i] || 0;
//         const riskPerTrade = cash * 0.01;
//         const stopDistance = volatility * 2;
//         const quantity = volatility > 0 ? Math.min(riskPerTrade / stopDistance, cash / price) : cash / price;

//         if (position > 0) {
//             highestPrice = Math.max(highestPrice, price);
//             const trailingStopPrice = highestPrice * (1 - trailingStopPercent);
//             if (price <= trailingStopPrice) {
//                 console.log(`Trailing stop triggered at ${price}`);
//                 cash = position * price;
//                 position = 0;
//                 highestPrice = 0;
//             }
//         }

//         if (position > 0 && price < entryPrice * (1 - stopLossPercent)) {
//             console.log(`Stop-loss triggered at ${price}`);
//             cash = position * price;
//             position = 0;
//             highestPrice = 0;
//         }

//         if (signals[i] === 1 && cash > 0) {
//             const buyQuantity = quantity;
//             console.log(`Simulated buy: ${buyQuantity.toFixed(6)} BTC at ${price}`);
//             position += buyQuantity;
//             entryPrice = price;
//             highestPrice = price;
//             cash -= buyQuantity * price;
//         } else if (signals[i] === -1 && position > 0) {
//             console.log(`Simulated sell: ${position.toFixed(6)} BTC at ${price}`);
//             cash += position * price;
//             position = 0;
//             highestPrice = 0;
//         }
//     }
//     const finalValue = cash + (position * data[data.length - 1].close);
//     console.log(`Final value: ${finalValue.toFixed(2)} USD`);
//     return finalValue;
// }

// // Main bot logic
// async function runBot() {
//     try {
//         const ohlcv = await exchange.fetchOHLCV('BTC/USDT', '5m', undefined, 100);
//         const data = ohlcv.map(candle => ({
//             timestamp: new Date(candle[0]),
//             open: candle[1],
//             high: candle[2],
//             low: candle[3],
//             close: candle[4],
//             volume: candle[5],
//         }));
//         const closes = data.map(d => d.close);

//         console.log('Last 5 candles:', data.slice(-5));

//         // Indicators
//         const shortMA = calculateMA(closes, 5);
//         const longMA = calculateMA(closes, 20);
//         const { macd, signal } = calculateMACD(closes);
//         const rsi = calculateRSI(closes);
//         const bb = calculateBollingerBands(closes);

//         // Signals
//         const signals = closes.map((_, i) => {
//             if (i < 25) return 0;
//             const maBuy = shortMA[i] > longMA[i] && shortMA[i - 1] <= longMA[i - 1];
//             const maSell = shortMA[i] < longMA[i] && shortMA[i - 1] >= longMA[i - 1];
//             const macdBuy = i >= 25 && macd[i] > signal[i] && macd[i - 1] <= signal[i - 1];
//             const macdSell = i >= 25 && macd[i] < signal[i] && macd[i - 1] >= signal[i - 1];
//             const rsiValue = rsi[i] || 50;
//             const price = closes[i];
//             const bbUpper = bb[i].upper || Infinity;
//             const bbLower = bb[i].lower || -Infinity;

//             if (i >= closes.length - 5) {
//                 console.log(`Candle ${i}: Price=${price}, ShortMA=${shortMA[i]?.toFixed(2) || 'N/A'}, LongMA=${longMA[i]?.toFixed(2) || 'N/A'}, MACD=${macd[i]?.toFixed(2) || 'N/A'}, Signal=${signal[i]?.toFixed(2) || 'N/A'}, RSI=${rsiValue.toFixed(2)}, BB Upper=${bbUpper.toFixed(2)}, BB Lower=${bbLower.toFixed(2)}`);
//             }

//             if ((maBuy || macdBuy) && rsiValue < 75 && price < bbUpper) return 1; // Relaxed RSI
//             if ((maSell || macdSell) && rsiValue > 25 && price > bbLower) return -1; // Relaxed RSI
//             return 0;
//         });

//         console.log('Last 5 signals:', signals.slice(-5));
//         backtest(data, signals);
//     } catch (error) {
//         console.error('Bot error:', error.message);
//     }
// }

// // Real-time monitoring
// function startRealTimeMonitoring() {
//     const ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@kline_5m');
//     let data = [];

//     ws.on('message', (msg) => {
//         const candle = JSON.parse(msg).k;
//         if (candle.x) {
//             const newCandle = {
//                 timestamp: new Date(candle.t),
//                 open: parseFloat(candle.o),
//                 high: parseFloat(candle.h),
//                 low: parseFloat(candle.l),
//                 close: parseFloat(candle.c),
//                 volume: parseFloat(candle.v),
//             };
//             data.push(newCandle);
//             if (data.length > 100) data.shift();

//             const closes = data.map(d => d.close);
//             if (closes.length >= 34) {
//                 const shortMA = calculateMA(closes, 5);
//                 const longMA = calculateMA(closes, 20);
//                 const { macd, signal } = calculateMACD(closes);
//                 const rsi = calculateRSI(closes);
//                 const bb = calculateBollingerBands(closes);
//                 const i = closes.length - 1;

//                 const maBuy = shortMA[i] > longMA[i] && shortMA[i - 1] <= longMA[i - 1];
//                 const maSell = shortMA[i] < longMA[i] && shortMA[i - 1] >= longMA[i - 1];
//                 const macdBuy = i >= 25 && macd[i] > signal[i] && macd[i - 1] <= signal[i - 1];
//                 const macdSell = i >= 25 && macd[i] < signal[i] && macd[i - 1] >= signal[i - 1];
//                 const rsiValue = rsi[i] || 50;
//                 const price = closes[i];
//                 const bbUpper = bb[i].upper || Infinity;
//                 const bbLower = bb[i].lower || -Infinity;

//                 console.log(`Real-time: Price=${price}, ShortMA=${shortMA[i]?.toFixed(2)}, MACD=${macd[i]?.toFixed(2)}, Signal=${signal[i]?.toFixed(2)}, RSI=${rsiValue.toFixed(2)}`);
//                 if ((maBuy || macdBuy) && rsiValue < 75 && price < bbUpper) {
//                     console.log('Real-time Buy signal!');
//                 } else if ((maSell || macdSell) && rsiValue > 25 && price > bbLower) {
//                     console.log('Real-time Sell signal!');
//                 }
//             }
//         }
//     });

//     ws.on('error', (error) => console.error('WebSocket error:', error));
//     ws.on('open', () => console.log('WebSocket connected'));
// }

// runBot();
// startRealTimeMonitoring();
// END V3

// START v4
// const ccxt = require('ccxt');
// const WebSocket = require('ws');

// const exchange = new ccxt.binance({
//     apiKey: 'xdqcpFgxkWKQ64rPtpCBlWCMjl8IROz7EMyssCUxFRfdkXqVN0cAXyTbbSt8HhY2',
//     secret: 'B5tflivSc96gga7D4j47aE9PoKHU5nEsl9vqoR9G0i029FtrDbo7o1BvLdtomAVd',
//     enableRateLimit: true,
// });

// // const exchange = new ccxt.binance({
// //     apiKey: 'XU8d8JUgER8IjZ7TOiT9P1uAgbO3VdagnGsQCMMux3XLKtVmDgkHEElExuoU5Liy',
// //     secret: 'zjiA8lm1D0rJ3vvQg3SuUBjhJMJXeGhE6u1iPUuQRkEZs6iV5JUhK2Pwa0gRbozp',
// //     enableRateLimit: true,
// // });

// // Indicator Functions
// function calculateMA(prices, period) {
//     const ma = [];
//     for (let i = 0; i < prices.length; i++) {
//         if (i < period - 1) ma.push(null);
//         else ma.push(prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period);
//     }
//     return ma;
// }

// function calculateEMA(prices, period) {
//     const k = 2 / (period + 1);
//     const ema = [prices[0]];
//     for (let i = 1; i < prices.length; i++) {
//         ema.push(prices[i] * k + ema[i - 1] * (1 - k));
//     }
//     return ema;
// }

// function calculateMACD(prices) {
//     const ema12 = calculateEMA(prices, 12);
//     const ema26 = calculateEMA(prices, 26);
//     const macd = ema12.map((v, i) => (i < 25 ? null : v - ema26[i]));
//     const signalRaw = calculateEMA(macd.slice(25), 9);
//     const signal = Array(25).fill(null).concat(signalRaw);
//     return { macd, signal };
// }

// function calculateRSI(prices, period = 14) {
//     const rsi = [];
//     for (let i = 0; i < prices.length; i++) {
//         if (i < period) rsi.push(null);
//         else {
//             const changes = prices.slice(i - period, i + 1).map((v, j, arr) => (j === 0 ? 0 : v - arr[j - 1]));
//             const gains = changes.reduce((sum, ch) => sum + (ch > 0 ? ch : 0), 0) / period;
//             const losses = Math.abs(changes.reduce((sum, ch) => sum + (ch < 0 ? ch : 0), 0)) / period;
//             const rs = losses === 0 ? 100 : gains / losses;
//             rsi.push(losses === 0 ? 100 : 100 - (100 / (1 + rs)));
//         }
//     }
//     return rsi;
// }

// function calculateBollingerBands(prices, period = 20, stdDevMultiplier = 2) {
//     const sma = calculateMA(prices, period);
//     const bands = [];
//     for (let i = 0; i < prices.length; i++) {
//         if (i < period - 1) bands.push({ upper: null, middle: null, lower: null });
//         else {
//             const slice = prices.slice(i - period + 1, i + 1);
//             const mean = sma[i];
//             const stdDev = Math.sqrt(slice.reduce((sum, v) => sum + (v - mean) ** 2, 0) / period);
//             bands.push({
//                 upper: mean + stdDevMultiplier * stdDev,
//                 middle: mean,
//                 lower: mean - stdDevMultiplier * stdDev,
//             });
//         }
//     }
//     return bands;
// }

// function calculateATR(highs, lows, closes, period = 14) {
//     const tr = [];
//     for (let i = 0; i < closes.length; i++) {
//         if (i === 0) tr.push(highs[i] - lows[i]);
//         else {
//             const hl = highs[i] - lows[i];
//             const hc = Math.abs(highs[i] - closes[i - 1]);
//             const lc = Math.abs(lows[i] - closes[i - 1]);
//             tr.push(Math.max(hl, hc, lc));
//         }
//     }
//     return calculateMA(tr, period);
// }

// // Backtest
// function backtest(data, signals, stopLossPercent = 0.01, trailingStopPercent = 0.005) {
//     let cash = 1000;
//     let position = 0;
//     let entryPrice = 0;
//     let highestPrice = 0;
//     const atr = calculateATR(data.map(d => d.high), data.map(d => d.low), data.map(d => d.close));

//     for (let i = 0; i < signals.length; i++) {
//         const price = data[i].close;
//         const volatility = atr[i] || 0;
//         const riskPerTrade = cash * 0.01;
//         const stopDistance = volatility * 2;
//         const quantity = volatility > 0 ? Math.min(riskPerTrade / stopDistance, cash / price) : cash / price;

//         // Check profit target or explicit sell
//         if (position > 0 && (price >= entryPrice * 1.005 || signals[i] === -1)) {
//             console.log(`Simulated sell: ${position.toFixed(6)} BTC at ${price} (${price >= entryPrice * 1.005 ? 'Profit Target' : 'Signal'})`);
//             cash += position * price;
//             position = 0;
//             highestPrice = 0;
//             continue;
//         }

//         if (position > 0) {
//             highestPrice = Math.max(highestPrice, price);
//             const trailingStopPrice = highestPrice * (1 - trailingStopPercent);
//             if (price <= trailingStopPrice) {
//                 console.log(`Trailing stop triggered at ${price}`);
//                 cash = position * price;
//                 position = 0;
//                 highestPrice = 0;
//             }
//         }

//         if (position > 0 && price < entryPrice * (1 - stopLossPercent)) {
//             console.log(`Stop-loss triggered at ${price}`);
//             cash = position * price;
//             position = 0;
//             highestPrice = 0;
//         }

//         if (signals[i] === 1 && cash > 0) {
//             const buyQuantity = quantity;
//             console.log(`Simulated buy: ${buyQuantity.toFixed(6)} BTC at ${price}`);
//             position += buyQuantity;
//             entryPrice = price;
//             highestPrice = price;
//             cash -= buyQuantity * price;
//         }
//     }
//     const finalValue = cash + (position * data[data.length - 1].close);
//     console.log(`Final value: ${finalValue.toFixed(2)} USD`);
//     return finalValue;
// }

// // Main bot logic
// async function runBot() {
//     try {
//         const ohlcv = await exchange.fetchOHLCV('BTC/USDT', '5m', undefined, 250);
//         const data = ohlcv.map(candle => ({
//             timestamp: new Date(candle[0]),
//             open: candle[1],
//             high: candle[2],
//             low: candle[3],
//             close: candle[4],
//             volume: candle[5],
//         }));
//         const closes = data.map(d => d.close);

//         console.log('Last 5 candles:', data.slice(-5));

//         // Indicators
//         const shortMA = calculateMA(closes, 3);
//         const longMA = calculateMA(closes, 10);
//         const { macd, signal } = calculateMACD(closes);
//         const rsi = calculateRSI(closes);
//         const bb = calculateBollingerBands(closes);

//         // Signals
//         const signals = closes.map((_, i) => {
//             if (i < 25) return 0;
//             const maBuy = shortMA[i] > longMA[i] && shortMA[i - 1] <= longMA[i - 1];
//             const maSell = shortMA[i] < longMA[i] && shortMA[i - 1] >= longMA[i - 1];
//             const macdBuy = i >= 25 && macd[i] > signal[i] && macd[i - 1] <= signal[i - 1] && (macd[i] - signal[i]) > 2;
//             const macdSell = i >= 25 && macd[i] < signal[i] && macd[i - 1] >= signal[i - 1] && (signal[i] - macd[i]) > 10; // Stronger confirmation
//             const rsiValue = rsi[i] || 50;
//             const price = closes[i];
//             const bbUpper = bb[i].upper || Infinity;
//             const bbLower = bb[i].lower || -Infinity;
//             const nearLowerBB = price <= bbLower * 1.005; // Within 0.5% of lower band

//             if (i >= closes.length - 5) {
//                 console.log(`Candle ${i}: Price=${price}, ShortMA=${shortMA[i]?.toFixed(2) || 'N/A'}, LongMA=${longMA[i]?.toFixed(2) || 'N/A'}, MACD=${macd[i]?.toFixed(2) || 'N/A'}, Signal=${signal[i]?.toFixed(2) || 'N/A'}, RSI=${rsiValue.toFixed(2)}, BB Upper=${bbUpper.toFixed(2)}, BB Lower=${bbLower.toFixed(2)}`);
//             }

//             if ((maBuy || macdBuy || (nearLowerBB && rsiValue < 40)) && rsiValue < 75 && price < bbUpper) return 1;
//             if ((maSell || macdSell) && rsiValue > 25 && price > bbLower) return -1;
//             return 0;
//         });

//         console.log('Last 5 signals:', signals.slice(-5));
//         backtest(data, signals);
//     } catch (error) {
//         console.error('Bot error:', error.message);
//     }
// }

// async function startRealTimeMonitoring() {
//     const ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@kline_5m');
//     let data = [];
//     let position = 0; // Track BTC position
//     let cash = 1000; // Starting USDT balance
//     let entryPrice = 0;
//     let highestPrice = 0;

//     // Fetch initial historical data
//     try {
//         const ohlcv = await exchange.fetchOHLCV('BTC/USDT', '5m', undefined, 100);
//         data = ohlcv.map(candle => ({
//             timestamp: new Date(candle[0]),
//             open: parseFloat(candle[1]),
//             high: parseFloat(candle[2]),
//             low: parseFloat(candle[3]),
//             close: parseFloat(candle[4]),
//             volume: parseFloat(candle[5]),
//         }));
//         console.log('Loaded historical data:', data.slice(-5)); // Log last 5 candles
//     } catch (error) {
//         console.error('Error fetching historical data:', error.message);
//         return;
//     }

//     ws.on('message', async (msg) => {
//         const rawMessage = JSON.parse(msg);

//         const candle = rawMessage.k;
//         if (candle.x) { // Closed candle
//             const newCandle = {
//                 timestamp: new Date(candle.t),
//                 open: parseFloat(candle.o),
//                 high: parseFloat(candle.h),
//                 low: parseFloat(candle.l),
//                 close: parseFloat(candle.c),
//                 volume: parseFloat(candle.v),
//             };
//             data.push(newCandle);
//             if (data.length > 100) data.shift();

//             const closes = data.map(d => d.close);
//             const highs = data.map(d => d.high);
//             const lows = data.map(d => d.low);
//             const i = closes.length - 1;

//             const shortMA = calculateMA(closes, 3);
//             const longMA = calculateMA(closes, 10);
//             const { macd, signal } = calculateMACD(closes);
//             const rsi = calculateRSI(closes);
//             const bb = calculateBollingerBands(closes);
//             const atr = calculateATR(highs, lows, closes);

//             const maBuy = shortMA[i] > longMA[i] && shortMA[i - 1] <= longMA[i - 1];
//             const maSell = shortMA[i] < longMA[i] && shortMA[i - 1] >= longMA[i - 1];
//             const macdBuy = macd[i] > signal[i] && macd[i - 1] <= signal[i - 1] && (macd[i] - signal[i]) > 2;
//             const macdSell = macd[i] < signal[i] && macd[i - 1] >= signal[i - 1] && (signal[i] - macd[i]) > 10;
//             const rsiValue = rsi[i] || 50;
//             const price = closes[i];
//             const bbUpper = bb[i].upper || Infinity;
//             const bbLower = bb[i].lower || -Infinity;
//             const nearLowerBB = price <= bbLower * 1.005;
//             const volatility = atr[i] || 0;
//             const stopDistance = volatility * 2;
//             const riskPerTrade = cash * 0.01;
//             const quantity = volatility > 0 ? Math.min(riskPerTrade / stopDistance, cash / price) : cash / price;

//             console.log(`🍂 Real-time: Price=${price}, ShortMA=${shortMA[i]?.toFixed(2)}, LongMA=${longMA[i]?.toFixed(2)}, MACD=${macd[i]?.toFixed(2)}, Signal=${signal[i]?.toFixed(2)}, RSI=${rsiValue.toFixed(2)}`);

//             // Check sell conditions
//             if (position > 0) {
//                 highestPrice = Math.max(highestPrice, price);
//                 const trailingStopPrice = highestPrice * (1 - 0.005); // 0.5% trailing stop
//                 if (price >= entryPrice * 1.005 || macdSell || price <= trailingStopPrice) {
//                     try {
//                         // const sellOrder = await exchange.createMarketSellOrder('BTC/USDT', position);
//                         cash += position * price;
//                         console.log(`🔥 Real Sell: ${position.toFixed(6)} BTC at ${price} (${price >= entryPrice * 1.005 ? 'Profit Target' : macdSell ? 'Signal' : 'Trailing Stop'})`);
//                         position = 0;
//                         entryPrice = 0;
//                         highestPrice = 0;
//                     } catch (error) {
//                         console.error('Sell error:', error.message);
//                     }
//                 }
//             }

//             // Check buy conditions
//             if ((maBuy || macdBuy || (nearLowerBB && rsiValue < 40)) && rsiValue < 75 && price < bbUpper && position === 0 && cash > 0) {
//                 try {
//                     const buyQuantity = Math.max(0.0001, quantity); // Minimum order size
//                     // const buyOrder = await exchange.createMarketBuyOrder('BTC/USDT', buyQuantity);
//                     position += buyQuantity;
//                     cash -= buyQuantity * price;
//                     entryPrice = price;
//                     highestPrice = price;
//                     console.log(`🍀 Real Buy: ${buyQuantity.toFixed(6)} BTC at ${price}`);
//                 } catch (error) {
//                     console.error('Buy error:', error.message);
//                 }
//             }

//             // Log current portfolio
//             console.log(`Portfolio: Cash=${cash.toFixed(2)} USDT, Position=${position.toFixed(6)} BTC, Value=${(cash + position * price).toFixed(2)} USDT`);
//         }
//     });

//     ws.on('error', (error) => console.error('WebSocket error:', error));
//     ws.on('open', () => console.log('WebSocket connected to Binance Testnet'));
// }

// runBot();
// startRealTimeMonitoring();
// END V4 BEST ONE YET

// START v5
// const ccxt = require('ccxt');
// const WebSocket = require('ws');

// const exchange = new ccxt.binance({
//     apiKey: 'xdqcpFgxkWKQ64rPtpCBlWCMjl8IROz7EMyssCUxFRfdkXqVN0cAXyTbbSt8HhY2',
//     secret: 'B5tflivSc96gga7D4j47aE9PoKHU5nEsl9vqoR9G0i029FtrDbo7o1BvLdtomAVd',
//     enableRateLimit: true,
// });

// // Indicator Functions (unchanged)
// function calculateMA(prices, period) {
//     const ma = [];
//     for (let i = 0; i < prices.length; i++) {
//         if (i < period - 1) ma.push(null);
//         else ma.push(prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period);
//     }
//     return ma;
// }

// function calculateEMA(prices, period) {
//     const k = 2 / (period + 1);
//     const ema = [prices[0]];
//     for (let i = 1; i < prices.length; i++) {
//         ema.push(prices[i] * k + ema[i - 1] * (1 - k));
//     }
//     return ema;
// }

// function calculateMACD(prices) {
//     const ema12 = calculateEMA(prices, 12);
//     const ema26 = calculateEMA(prices, 26);
//     const macd = ema12.map((v, i) => (i < 25 ? null : v - ema26[i]));
//     const signalRaw = calculateEMA(macd.slice(25), 9);
//     const signal = Array(25).fill(null).concat(signalRaw);
//     return { macd, signal };
// }

// function calculateRSI(prices, period = 14) {
//     const rsi = [];
//     for (let i = 0; i < prices.length; i++) {
//         if (i < period) rsi.push(null);
//         else {
//             const changes = prices.slice(i - period, i + 1).map((v, j, arr) => (j === 0 ? 0 : v - arr[j - 1]));
//             const gains = changes.reduce((sum, ch) => sum + (ch > 0 ? ch : 0), 0) / period;
//             const losses = Math.abs(changes.reduce((sum, ch) => sum + (ch < 0 ? ch : 0), 0)) / period;
//             const rs = losses === 0 ? 100 : gains / losses;
//             rsi.push(losses === 0 ? 100 : 100 - (100 / (1 + rs)));
//         }
//     }
//     return rsi;
// }

// function calculateBollingerBands(prices, period = 20, stdDevMultiplier = 2) {
//     const sma = calculateMA(prices, period);
//     const bands = [];
//     for (let i = 0; i < prices.length; i++) {
//         if (i < period - 1) bands.push({ upper: null, middle: null, lower: null });
//         else {
//             const slice = prices.slice(i - period + 1, i + 1);
//             const mean = sma[i];
//             const stdDev = Math.sqrt(slice.reduce((sum, v) => sum + (v - mean) ** 2, 0) / period);
//             bands.push({
//                 upper: mean + stdDevMultiplier * stdDev,
//                 middle: mean,
//                 lower: mean - stdDevMultiplier * stdDev,
//             });
//         }
//     }
//     return bands;
// }

// function calculateATR(highs, lows, closes, period = 14) {
//     const tr = [];
//     for (let i = 0; i < closes.length; i++) {
//         if (i === 0) tr.push(highs[i] - lows[i]);
//         else {
//             const hl = highs[i] - lows[i];
//             const hc = Math.abs(highs[i] - closes[i - 1]);
//             const lc = Math.abs(lows[i] - closes[i - 1]);
//             tr.push(Math.max(hl, hc, lc));
//         }
//     }
//     return calculateMA(tr, period);
// }

// function calculateADX(highs, lows, closes, period = 14) {
//     const tr = calculateATR(highs, lows, closes, period);
//     const dmPlus = highs.map((h, i) => i === 0 ? 0 : Math.max(h - highs[i-1], 0));
//     const dmMinus = lows.map((l, i) => i === 0 ? 0 : Math.max(lows[i-1] - l, 0));
//     const atr = calculateMA(tr, period);
//     const diPlus = calculateMA(dmPlus, period).map((v, i) => atr[i] ? 100 * v / atr[i] : 0);
//     const diMinus = calculateMA(dmMinus, period).map((v, i) => atr[i] ? 100 * v / atr[i] : 0);
//     const dx = diPlus.map((p, i) => atr[i] ? 100 * Math.abs(p - diMinus[i]) / (p + diMinus[i]) : 0);
//     return calculateMA(dx, period);
// }

// function calculateVolumeMA(data, period = 20) {
//     const volumes = data.map(d => d.volume);
//     return calculateMA(volumes, period);
// }

// function calculateKellyCriterion(trades) {
//     if (trades.length < 10) return 0.01;
//     const wins = trades.filter(t => t.profit > 0);
//     const winRate = wins.length / trades.length;
//     const avgWin = wins.reduce((sum, t) => sum + t.profit, 0) / wins.length || 0;
//     const avgLoss = trades.filter(t => t.profit <= 0).reduce((sum, t) => sum + Math.abs(t.profit), 0) / (trades.length - wins.length) || 1;
//     const b = avgWin / avgLoss;
//     const kelly = (winRate * b - (1 - winRate)) / b;
//     return Math.max(0.01, Math.min(0.2, isNaN(kelly) ? 0.01 : kelly));
// }

// async function fetchHigherTimeframeData() {
//     try {
//         const ohlcv15m = await exchange.fetchOHLCV('BTC/USDT', '15m', undefined, 100);
//         return ohlcv15m.map(candle => ({
//             timestamp: new Date(candle[0]),
//             close: candle[4],
//         }));
//     } catch (error) {
//         console.error('Error fetching 15m data:', error.message);
//         return [];
//     }
// }

// // Backtest (Updated with new signals)
// function backtest(data, signals) {
//     let cash = 1000;
//     let position = 0;
//     let entryPrice = 0;
//     let highestPrice = 0;
//     const trades = [];
//     const atr = calculateATR(data.map(d => d.high), data.map(d => d.low), data.map(d => d.close));

//     for (let i = 0; i < signals.length; i++) {
//         const price = data[i].close;
//         const volatility = atr[i] || 0;
//         const kellyFraction = calculateKellyCriterion(trades);
//         const quantity = Math.min(cash * kellyFraction / price, cash / price);

//         if (position > 0) {
//             highestPrice = Math.max(highestPrice, price);
//             const stopLossPrice = entryPrice - 2 * volatility;
//             const profitTargetPrice = entryPrice + 3 * volatility;
//             const trailingStopPrice = highestPrice - volatility;
//             if (price >= profitTargetPrice || signals[i] === -1 || price <= stopLossPrice || price <= trailingStopPrice) {
//                 const profit = position * (price - entryPrice);
//                 cash += position * price;
//                 console.log(`Simulated sell: ${position.toFixed(6)} BTC at ${price} (${price >= profitTargetPrice ? 'Profit Target' : price <= stopLossPrice ? 'Stop Loss' : 'Trailing Stop'})`);
//                 trades.push({ price, profit });
//                 position = 0;
//                 highestPrice = 0;
//                 continue;
//             }
//         }

//         if (signals[i] === 1 && cash > 0) {
//             const buyQuantity = Math.max(0.0001, quantity);
//             console.log(`Simulated buy: ${buyQuantity.toFixed(6)} BTC at ${price}`);
//             position += buyQuantity;
//             entryPrice = price;
//             highestPrice = price;
//             cash -= buyQuantity * price;
//         }
//     }
//     const finalValue = cash + (position * data[data.length - 1].close);
//     console.log(`Final value: ${finalValue.toFixed(2)} USD`);
//     return finalValue;
// }

// // Main bot logic (Updated signals)
// async function runBot() {
//     try {
//         const ohlcv = await exchange.fetchOHLCV('BTC/USDT', '5m', undefined, 1000);
//         const data = ohlcv.map(candle => ({
//             timestamp: new Date(candle[0]),
//             open: candle[1],
//             high: candle[2],
//             low: candle[3],
//             close: candle[4],
//             volume: candle[5],
//         }));
//         const closes = data.map(d => d.close);
//         console.log('Last 5 candles:', data.slice(-5));

//         const shortMA = calculateMA(closes, 3);
//         const longMA = calculateMA(closes, 10);
//         const { macd, signal } = calculateMACD(closes);
//         const rsi = calculateRSI(closes);
//         const bb = calculateBollingerBands(closes);
//         const adx = calculateADX(data.map(d => d.high), data.map(d => d.low), closes);
//         const volumeMA = calculateVolumeMA(data);
//         const higherTFData = await fetchHigherTimeframeData();
//         const higherCloses = higherTFData.map(d => d.close);
//         const higherShortMA = calculateMA(higherCloses, 3);
//         const higherLongMA = calculateMA(higherCloses, 10);
//         const higherTrendUp = higherShortMA[higherShortMA.length - 1] > higherLongMA[higherLongMA.length - 1];

//         const signals = closes.map((_, i) => {
//             if (i < 25) return 0;
//             const maBuy = shortMA[i] > longMA[i] && shortMA[i - 1] <= longMA[i - 1];
//             const maSell = shortMA[i] < longMA[i] && shortMA[i - 1] >= longMA[i - 1];
//             const macdBuy = macd[i] > signal[i] && macd[i - 1] <= signal[i - 1] && (macd[i] - signal[i]) > 2;
//             const macdSell = macd[i] < signal[i] && macd[i - 1] >= signal[i - 1] && (signal[i] - macd[i]) > 10;
//             const rsiValue = rsi[i] || 50;
//             const price = closes[i];
//             const bbUpper = bb[i].upper || Infinity;
//             const bbLower = bb[i].lower || -Infinity;
//             const nearLowerBB = price <= bbLower * 1.005;
//             const strongTrend = adx[i] > 25;
//             const highVolume = data[i].volume > volumeMA[i];

//             if (i >= closes.length - 5) {
//                 console.log(`Candle ${i}: Price=${price}, ShortMA=${shortMA[i]?.toFixed(2)}, LongMA=${longMA[i]?.toFixed(2)}, MACD=${macd[i]?.toFixed(2)}, Signal=${signal[i]?.toFixed(2)}, RSI=${rsiValue.toFixed(2)}, ADX=${adx[i]?.toFixed(2)}, Volume=${data[i].volume.toFixed(2)}`);
//             }

//             if ((maBuy || macdBuy || (nearLowerBB && rsiValue < 40)) && rsiValue < 75 && price < bbUpper && strongTrend && highVolume && higherTrendUp) return 1;
//             if ((maSell || macdSell) && rsiValue > 25 && price > bbLower) return -1;
//             return 0;
//         });

//         console.log('Last 5 signals:', signals.slice(-5));
//         backtest(data, signals);
//     } catch (error) {
//         console.error('Bot error:', error.message);
//     }
// }

// // Real-time monitoring
// async function startRealTimeMonitoring() {
//     const ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@kline_5m');
//     let data = [];
//     let position = 0;
//     let cash = 1000;
//     let entryPrice = 0;
//     let highestPrice = 0;
//     let trades = [];

//     try {
//         const ohlcv = await exchange.fetchOHLCV('BTC/USDT', '5m', undefined, 100);
//         data = ohlcv.map(candle => ({
//             timestamp: new Date(candle[0]),
//             open: parseFloat(candle[1]),
//             high: parseFloat(candle[2]),
//             low: parseFloat(candle[3]),
//             close: parseFloat(candle[4]),
//             volume: parseFloat(candle[5]),
//         }));
//         console.log('Loaded historical data:', data.slice(-5));
//     } catch (error) {
//         console.error('Error fetching historical data:', error.message);
//         return;
//     }

//     let higherTFData = await fetchHigherTimeframeData();
//     let lastHigherTFUpdate = Date.now();

//     ws.on('message', async (msg) => {
//         const candle = JSON.parse(msg).k;
//         if (candle.x) {
//             const newCandle = {
//                 timestamp: new Date(candle.t),
//                 open: parseFloat(candle.o),
//                 high: parseFloat(candle.h),
//                 low: parseFloat(candle.l),
//                 close: parseFloat(candle.c),
//                 volume: parseFloat(candle.v),
//             };
//             data.push(newCandle);
//             if (data.length > 100) data.shift();

//             // Refresh 15m data every 15 minutes
//             if (Date.now() - lastHigherTFUpdate > 15 * 60 * 1000) {
//                 higherTFData = await fetchHigherTimeframeData();
//                 lastHigherTFUpdate = Date.now();
//             }
//             const higherCloses = higherTFData.map(d => d.close);
//             const higherShortMA = calculateMA(higherCloses, 3);
//             const higherLongMA = calculateMA(higherCloses, 10);
//             const higherTrendUp = higherShortMA[higherShortMA.length - 1] > higherLongMA[higherLongMA.length - 1];

//             const closes = data.map(d => d.close);
//             const highs = data.map(d => d.high);
//             const lows = data.map(d => d.low);
//             const i = closes.length - 1;

//             const shortMA = calculateMA(closes, 3);
//             const longMA = calculateMA(closes, 10);
//             const { macd, signal } = calculateMACD(closes);
//             const rsi = calculateRSI(closes);
//             const bb = calculateBollingerBands(closes);
//             const atr = calculateATR(highs, lows, closes);
//             const adx = calculateADX(highs, lows, closes);
//             const volumeMA = calculateVolumeMA(data);

//             const maBuy = shortMA[i] > longMA[i] && shortMA[i - 1] <= longMA[i - 1];
//             const maSell = shortMA[i] < longMA[i] && shortMA[i - 1] >= longMA[i - 1];
//             const macdBuy = macd[i] > signal[i] && macd[i - 1] <= signal[i - 1] && (macd[i] - signal[i]) > 2;
//             const macdSell = macd[i] < signal[i] && macd[i - 1] >= signal[i - 1] && (signal[i] - macd[i]) > 10;
//             const rsiValue = rsi[i] || 50;
//             const price = closes[i];
//             const bbUpper = bb[i].upper || Infinity;
//             const bbLower = bb[i].lower || -Infinity;
//             const nearLowerBB = price <= bbLower * 1.005;
//             const volatility = atr[i] || 0;
//             const strongTrend = adx[i] > 25;
//             const highVolume = data[i].volume > volumeMA[i];
//             const kellyFraction = calculateKellyCriterion(trades);
//             const quantity = Math.min(cash * kellyFraction / price, cash / price);

//             console.log(`🍂 Real-time: Price=${price}, ShortMA=${shortMA[i]?.toFixed(2)}, LongMA=${longMA[i]?.toFixed(2)}, MACD=${macd[i]?.toFixed(2)}, Signal=${signal[i]?.toFixed(2)}, RSI=${rsiValue.toFixed(2)}, ADX=${adx[i]?.toFixed(2)}`);

//             if (position > 0) {
//                 highestPrice = Math.max(highestPrice, price);
//                 const stopLossPrice = entryPrice - 2 * volatility;
//                 const profitTargetPrice = entryPrice + 3 * volatility;
//                 const trailingStopPrice = highestPrice - volatility;
//                 if (price >= profitTargetPrice || macdSell || price <= stopLossPrice || price <= trailingStopPrice) {
//                     const profit = position * (price - entryPrice);
//                     cash += position * price;
//                     console.log(`🔥 Real Sell: ${position.toFixed(6)} BTC at ${price} (${price >= profitTargetPrice ? 'Profit Target' : price <= stopLossPrice ? 'Stop Loss' : macdSell ? 'Signal' : 'Trailing Stop'})`);
//                     trades.push({ price, profit });
//                     position = 0;
//                     highestPrice = 0;
//                 }
//             }

//             if ((maBuy || macdBuy || (nearLowerBB && rsiValue < 40)) && rsiValue < 75 && price < bbUpper && strongTrend && highVolume && higherTrendUp && position === 0 && cash > 0) {
//                 const buyQuantity = Math.max(0.0001, quantity);
//                 position += buyQuantity;
//                 cash -= buyQuantity * price;
//                 entryPrice = price;
//                 highestPrice = price;
//                 console.log(`🍀 Real Buy: ${buyQuantity.toFixed(6)} BTC at ${price}`);
//             }

//             console.log(`Portfolio: Cash=${cash.toFixed(2)} USDT, Position=${position.toFixed(6)} BTC, Value=${(cash + position * price).toFixed(2)} USDT`);
//         }
//     });

//     ws.on('error', (error) => console.error('WebSocket error:', error));
//     ws.on('open', () => console.log('WebSocket connected to Binance Testnet'));
// }

// runBot();
// startRealTimeMonitoring();
// END V5

// START v6
// const ccxt = require('ccxt');
// const WebSocket = require('ws');

// const exchange = new ccxt.binance({
//     apiKey: 'xdqcpFgxkWKQ64rPtpCBlWCMjl8IROz7EMyssCUxFRfdkXqVN0cAXyTbbSt8HhY2',
//     secret: 'B5tflivSc96gga7D4j47aE9PoKHU5nEsl9vqoR9G0i029FtrDbo7o1BvLdtomAVd',
//     enableRateLimit: true,
// });

// // Retain your existing indicator functions (calculateMA, calculateEMA, etc.) unchanged
// function calculateMA(prices, period) {
//     const ma = [];
//     for (let i = 0; i < prices.length; i++) {
//         if (i < period - 1) ma.push(null);
//         else ma.push(prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period);
//     }
//     return ma;
// }

// function calculateEMA(prices, period) {
//     const k = 2 / (period + 1);
//     const ema = [prices[0]];
//     for (let i = 1; i < prices.length; i++) {
//         ema.push(prices[i] * k + ema[i - 1] * (1 - k));
//     }
//     return ema;
// }

// function calculateMACD(prices) {
//     const ema12 = calculateEMA(prices, 12);
//     const ema26 = calculateEMA(prices, 26);
//     const macd = ema12.map((v, i) => (i < 25 ? null : v - ema26[i]));
//     const signalRaw = calculateEMA(macd.slice(25), 9);
//     const signal = Array(25).fill(null).concat(signalRaw);
//     return { macd, signal };
// }

// function calculateRSI(prices, period = 14) {
//     const rsi = [];
//     for (let i = 0; i < prices.length; i++) {
//         if (i < period) rsi.push(null);
//         else {
//             const changes = prices.slice(i - period, i + 1).map((v, j, arr) => (j === 0 ? 0 : v - arr[j - 1]));
//             const gains = changes.reduce((sum, ch) => sum + (ch > 0 ? ch : 0), 0) / period;
//             const losses = Math.abs(changes.reduce((sum, ch) => sum + (ch < 0 ? ch : 0), 0)) / period;
//             const rs = losses === 0 ? 100 : gains / losses;
//             rsi.push(losses === 0 ? 100 : 100 - (100 / (1 + rs)));
//         }
//     }
//     return rsi;
// }

// function calculateBollingerBands(prices, period = 20, stdDevMultiplier = 2) {
//     const sma = calculateMA(prices, period);
//     const bands = [];
//     for (let i = 0; i < prices.length; i++) {
//         if (i < period - 1) bands.push({ upper: null, middle: null, lower: null });
//         else {
//             const slice = prices.slice(i - period + 1, i + 1);
//             const mean = sma[i];
//             const stdDev = Math.sqrt(slice.reduce((sum, v) => sum + (v - mean) ** 2, 0) / period);
//             bands.push({
//                 upper: mean + stdDevMultiplier * stdDev,
//                 middle: mean,
//                 lower: mean - stdDevMultiplier * stdDev,
//             });
//         }
//     }
//     return bands;
// }

// function calculateATR(highs, lows, closes, period = 14) {
//     const tr = [];
//     for (let i = 0; i < closes.length; i++) {
//         if (i === 0) tr.push(highs[i] - lows[i]);
//         else {
//             const hl = highs[i] - lows[i];
//             const hc = Math.abs(highs[i] - closes[i - 1]);
//             const lc = Math.abs(lows[i] - closes[i - 1]);
//             tr.push(Math.max(hl, hc, lc));
//         }
//     }
//     return calculateMA(tr, period);
// }

// function calculateADX(highs, lows, closes, period = 14) {
//     const tr = calculateATR(highs, lows, closes, period);
//     const dmPlus = highs.map((h, i) => i === 0 ? 0 : Math.max(h - highs[i-1], 0));
//     const dmMinus = lows.map((l, i) => i === 0 ? 0 : Math.max(lows[i-1] - l, 0));
//     const atr = calculateMA(tr, period);
//     const diPlus = calculateMA(dmPlus, period).map((v, i) => atr[i] ? 100 * v / atr[i] : 0);
//     const diMinus = calculateMA(dmMinus, period).map((v, i) => atr[i] ? 100 * v / atr[i] : 0);
//     const dx = diPlus.map((p, i) => atr[i] ? 100 * Math.abs(p - diMinus[i]) / (p + diMinus[i]) : 0);
//     return calculateMA(dx, period);
// }

// function calculateVolumeMA(data, period = 20) {
//     const volumes = data.map(d => d.volume);
//     return calculateMA(volumes, period);
// }

// function calculateKellyCriterion(trades) {
//     if (trades.length < 10) return 0.01;
//     const wins = trades.filter(t => t.profit > 0);
//     const winRate = wins.length / trades.length;
//     const avgWin = wins.reduce((sum, t) => sum + t.profit, 0) / wins.length || 0;
//     const avgLoss = trades.filter(t => t.profit <= 0).reduce((sum, t) => sum + Math.abs(t.profit), 0) / (trades.length - wins.length) || 1;
//     const b = avgWin / avgLoss;
//     const kelly = (winRate * b - (1 - winRate)) / b;
//     return Math.max(0.01, Math.min(0.2, isNaN(kelly) ? 0.01 : kelly));
// }

// async function fetchHigherTimeframeData() {
//     try {
//         const ohlcv15m = await exchange.fetchOHLCV('BTC/USDT', '15m', undefined, 100);
//         return ohlcv15m.map(candle => ({
//             timestamp: new Date(candle[0]),
//             close: candle[4],
//         }));
//     } catch (error) {
//         console.error('Error fetching 15m data:', error.message);
//         return [];
//     }
// }

// // Define trading pairs and cash allocation
// let tradingPairs = ['DOGE/USDT', 'ADA/USDT']; // Will be updated by findBestPairs
// const initialCash = 300;
// const cashPerPair = initialCash / tradingPairs.length;

// // Portfolio state for each pair
// const portfolio = tradingPairs.reduce((acc, pair) => {
//     acc[pair] = { cash: cashPerPair, position: 0, entryPrice: 0, highestPrice: 0, trades: [] };
//     return acc;
// }, {});

// // Main bot logic (updated for multiple pairs)
// async function runBot() {
//     try {
//         for (const pair of tradingPairs) {
//             console.log(`Running bot for ${pair}`);
//             const ohlcv = await exchange.fetchOHLCV(pair, '5m', undefined, 1500);
//             const data = ohlcv.map(candle => ({
//                 timestamp: new Date(candle[0]),
//                 open: candle[1],
//                 high: candle[2],
//                 low: candle[3],
//                 close: candle[4],
//                 volume: candle[5],
//             }));
//             const closes = data.map(d => d.close);

//             const shortMA = calculateMA(closes, 5);
//             const longMA = calculateMA(closes, 10);
//             const { macd, signal } = calculateMACD(closes);
//             const rsi = calculateRSI(closes);
//             const atr = calculateATR(data.map(d => d.high), data.map(d => d.low), closes);

//             const signals = closes.map((_, i) => {
//                 if (i < 25) return 0;
//                 const maBuy = shortMA[i] > longMA[i] && shortMA[i - 1] <= longMA[i - 1];
//                 const maSell = shortMA[i] < longMA[i] && shortMA[i - 1] >= longMA[i - 1];
//                 const macdBuy = macd[i] > signal[i] && macd[i - 1] <= signal[i - 1];
//                 const macdSell = macd[i] < signal[i] && macd[i - 1] >= signal[i - 1];
//                 const rsiValue = rsi[i] || 50;
//                 const volume = data[i].volume;
//                 const volumeMA = calculateMA(data.map(d => d.volume), 10);
//                 if ((maBuy || macdBuy) && rsiValue > 30 && rsiValue < 70 && volume > volumeMA[i]) return 1;
//                 if ((maSell || macdSell) && rsiValue > 30) return -1;
//                 return 0;
//             });

//             console.log(`Last 5 signals for ${pair}:`, signals.slice(-5));
//             backtest(data, signals, pair);
//         }
//     } catch (error) {
//         console.error('Bot error:', error.message);
//     }
// }

// // Updated backtest function
// function backtest(data, signals, pair) {
//     let { cash, position, entryPrice, highestPrice, trades } = portfolio[pair];
//     const atr = calculateATR(data.map(d => d.high), data.map(d => d.low), data.map(d => d.close));

//     for (let i = 0; i < signals.length; i++) {
//         const price = data[i].close;
//         const volatility = atr[i] || 0;
//         const kellyFraction = Math.min(calculateKellyCriterion(trades), 0.1);
//         const quantity = Math.min(cash * kellyFraction / price, cash / price);

//         if (position > 0) {
//             highestPrice = Math.max(highestPrice, price);
//             const stopLossPrice = entryPrice - volatility * 1.5;
//             const profitTargetPrice = entryPrice + volatility * 0.5;
//             const trailingStopPrice = highestPrice - volatility * 1.5;
//             if (price >= profitTargetPrice || signals[i] === -1 || price <= stopLossPrice || price <= trailingStopPrice) {
//                 const profit = position * (price - entryPrice);
//                 cash += position * price;
//                 // console.log(`[${pair}] Simulated sell: ${position.toFixed(6)} at ${price} (${price >= profitTargetPrice ? 'Profit Target' : price <= stopLossPrice ? 'Stop Loss' : 'Trailing Stop'})`);
//                 trades.push({ price, profit });
//                 position = 0;
//                 highestPrice = 0;
//             }
//         }

//         if (signals[i] === 1 && cash > 0) {
//             const buyQuantity = Math.max(0.0001, quantity);
//             // console.log(`[${pair}] Simulated buy: ${buyQuantity.toFixed(6)} at ${price}`);
//             position += buyQuantity;
//             entryPrice = price;
//             highestPrice = price;
//             cash -= buyQuantity * price;
//         }
//     }

//     const finalValue = cash + (position * data[data.length - 1].close);
//     const winRate = trades.filter(t => t.profit > 0).length / trades.length || 0;
//     const avgProfit = trades.reduce((sum, t) => sum + t.profit, 0) / trades.length || 0;
//     const tradeCount = trades.length;
//     // console.log(`[${pair}] Final value: ${finalValue.toFixed(2)} USD, Win Rate: ${(winRate * 100).toFixed(2)}%, Avg Profit: ${avgProfit.toFixed(2)}`);

//     // Return all metrics before resetting
//     const result = { finalValue, profit: finalValue - cashPerPair, winRate, avgProfit, tradeCount };

//     // Reset portfolio after metrics are captured
//     portfolio[pair] = { cash: cashPerPair, position: 0, entryPrice: 0, highestPrice: 0, trades: [] };
//     return result; // Return the full result object
// }

// // Real-time monitoring (unchanged)
// async function startRealTimeMonitoring() {
//     const wsConnections = {};
//     for (const pair of tradingPairs) {
//         const wsSymbol = pair.replace('/', '').toLowerCase();
//         wsConnections[pair] = new WebSocket(`wss://stream.binance.com:9443/ws/${wsSymbol}@kline_5m`);
//         let data = [];
//         let { cash, position, entryPrice, highestPrice, trades } = portfolio[pair];

//         try {
//             const ohlcv = await exchange.fetchOHLCV(pair, '5m', undefined, 100);
//             data = ohlcv.map(candle => ({
//                 timestamp: new Date(candle[0]),
//                 open: parseFloat(candle[1]),
//                 high: parseFloat(candle[2]),
//                 low: parseFloat(candle[3]),
//                 close: parseFloat(candle[4]),
//                 volume: parseFloat(candle[5]),
//             }));
//         } catch (error) {
//             console.error(`[${pair}] Error fetching historical data:`, error.message);
//             return;
//         }

//         wsConnections[pair].on('message', (msg) => {
//             const parsed = JSON.parse(msg);
//             const candle = parsed.k;
//             console.log(`[${pair}] WebSocket raw message:`, { time: new Date(candle.t), closed: candle.x }); // Debug all messages
//             if (candle.x) {
//                 const newCandle = {
//                     timestamp: new Date(candle.t),
//                     open: parseFloat(candle.o),
//                     high: parseFloat(candle.h),
//                     low: parseFloat(candle.l),
//                     close: parseFloat(candle.c),
//                     volume: parseFloat(candle.v),
//                 };
//                 data.push(newCandle);
//                 if (data.length > 100) data.shift();
//                 // Rest of trading logic unchanged
//                 // ...
//             }
//         });

//         wsConnections[pair].on('error', (error) => {
//             console.error(`[${pair}] WebSocket error:`, error.message);
//         });

//         wsConnections[pair].on('close', () => {
//             console.log(`[${pair}] WebSocket closed`);
//         });

//         wsConnections[pair].on('open', () => {
//             console.log(`[${pair}] WebSocket connected`);
//             // Heartbeat to detect stalls
//             setInterval(() => {
//                 console.log(`[${pair}] Heartbeat: Still alive at ${new Date()}`);
//             }, 300000); // Every 5 minutes
//         });
//     }
// }

// // New function to backtest over specific candle counts
// async function analyzePairPerformance(pair, fullResult, candleCounts = [10, 100, 250, 500, 1000]) {
//     console.log(`\nAnalyzing performance for ${pair} over multiple candle counts...`);
//     try {
//         const ohlcv = await exchange.fetchOHLCV(pair, '5m', undefined, 1500);
//         const data = ohlcv.map(candle => ({
//             timestamp: new Date(candle[0]),
//             open: candle[1],
//             high: candle[2],
//             low: candle[3],
//             close: candle[4],
//             volume: candle[5],
//         }));
//         const closes = data.map(d => d.close);

//         const shortMA = calculateMA(closes, 5);
//         const longMA = calculateMA(closes, 10);
//         const { macd, signal } = calculateMACD(closes);
//         const rsi = calculateRSI(closes);
//         const atr = calculateATR(data.map(d => d.high), data.map(d => d.low), closes);

//         const signals = closes.map((_, i) => {
//             if (i < 10) return 0;
//             const maBuy = shortMA[i] > longMA[i] && shortMA[i - 1] <= longMA[i - 1];
//             const maSell = shortMA[i] < longMA[i] && shortMA[i - 1] >= longMA[i - 1];
//             const macdBuy = macd[i] > signal[i] && macd[i - 1] <= signal[i - 1];
//             const macdSell = macd[i] < signal[i] && macd[i - 1] >= signal[i - 1];
//             const rsiValue = rsi[i] || 50;
//             const volume = data[i].volume;
//             const volumeMA = calculateMA(data.map(d => d.volume), 10);
//             if ((maBuy || macdBuy) && rsiValue > 30 && rsiValue < 70 && volume > volumeMA[i]) return 1;
//             if ((maSell || macdSell) && rsiValue > 30) return -1;
//             return 0;
//         });

//         const performance = [];
//         for (const count of candleCounts) {
//             if (count > data.length) {
//                 console.log(`[${pair}] ${count} candles: Not enough data (only ${data.length} available)`);
//                 continue;
//             }
//             const slicedData = data.slice(-count);
//             const slicedSignals = signals.slice(-count);
//             portfolio[pair] = { cash: cashPerPair, position: 0, entryPrice: 0, highestPrice: 0, trades: [] };
//             const backtestResult = backtest(slicedData, slicedSignals, pair);
//             const profit = backtestResult.finalValue - cashPerPair;
//             const profitPercent = (profit / cashPerPair) * 100;
//             performance.push({ count, profit, profitPercent, winRate: backtestResult.winRate, tradeCount: backtestResult.tradeCount });
//             console.log(`[${pair}] ${count} candles: Profit=${profit.toFixed(2)} USD (${profitPercent.toFixed(2)}%), Win Rate=${(backtestResult.winRate * 100).toFixed(2)}%, Trades=${backtestResult.tradeCount}`);
//         }

//         // Swap criteria: Reject if profit < 0 at 500 or 1000 candles, or win rate < 60% at 1000 candles
//         const keyMetrics = performance.filter(p => [500, 1000].includes(p.count));
//         const isAcceptable = keyMetrics.every(p => p.profit >= 0) && // No losses at 500 or 1000 candles
//                            performance.find(p => p.count === 1000).winRate >= 0.6; // Win rate >= 60% at 1000 candles

//         if (!isAcceptable) {
//             console.log(`[${pair}] Failed performance check: ${keyMetrics.some(p => p.profit < 0) ? 'Negative profit at 500/1000 candles' : 'Win rate < 60% at 1000 candles'}`);
//         }

//         return isAcceptable;
//     } catch (error) {
//         console.error(`[${pair}] Error in analyzePairPerformance: ${error.message}`);
//         return false; // Reject on error
//     }
// }

// // Updated findBestPairs with reset and performance analysis
// async function findBestPairs(limit = 200, topN = 3, minTrades = 10, minWinRate = 0.6, minProfitPercent = 0.5) {
//     try {
//         const markets = await exchange.loadMarkets();
//         const usdtPairs = Object.keys(markets)
//             .filter(symbol => symbol.endsWith('/USDT') && markets[symbol].active)
//             .slice(0, limit);

//         console.log(`Analyzing ${usdtPairs.length} USDT pairs over 1500 candles...`);

//         const results = [];
//         for (const pair of usdtPairs) {
//             try {
//                 const ohlcv = await exchange.fetchOHLCV(pair, '5m', undefined, 1500);
//                 const data = ohlcv.map(candle => ({
//                     timestamp: new Date(candle[0]),
//                     open: candle[1],
//                     high: candle[2],
//                     low: candle[3],
//                     close: candle[4],
//                     volume: candle[5],
//                 }));
//                 const closes = data.map(d => d.close);

//                 const shortMA = calculateMA(closes, 5);
//                 const longMA = calculateMA(closes, 10);
//                 const { macd, signal } = calculateMACD(closes);
//                 const rsi = calculateRSI(closes);
//                 const atr = calculateATR(data.map(d => d.high), data.map(d => d.low), closes);

//                 const signals = closes.map((_, i) => {
//                     if (i < 10) return 0; // Reduced lag for small candle counts
//                     const maBuy = shortMA[i] > longMA[i] && shortMA[i - 1] <= longMA[i - 1];
//                     const maSell = shortMA[i] < longMA[i] && shortMA[i - 1] >= longMA[i - 1];
//                     const macdBuy = macd[i] > signal[i] && macd[i - 1] <= signal[i - 1];
//                     const macdSell = macd[i] < signal[i] && macd[i - 1] >= signal[i - 1];
//                     const rsiValue = rsi[i] || 50;
//                     const volume = data[i].volume;
//                     const volumeMA = calculateMA(data.map(d => d.volume), 10);
//                     if ((maBuy || macdBuy) && rsiValue > 30 && rsiValue < 70 && volume > volumeMA[i]) return 1;
//                     if ((maSell || macdSell) && rsiValue > 30) return -1;
//                     return 0;
//                 });

//                 portfolio[pair] = { cash: cashPerPair, position: 0, entryPrice: 0, highestPrice: 0, trades: [] };
//                 const backtestResult = backtest(data, signals, pair);

//                 const profitPercent = (backtestResult.profit / cashPerPair) * 100;
//                 results.push({
//                     pair,
//                     profit: backtestResult.profit,
//                     profitPercent,
//                     winRate: backtestResult.winRate,
//                     avgProfit: backtestResult.avgProfit,
//                     tradeCount: backtestResult.tradeCount,
//                     finalValue: backtestResult.finalValue
//                 });

//                 console.log(`[${pair}] Profit: ${backtestResult.profit.toFixed(2)} (${profitPercent.toFixed(2)}%), Win Rate: ${(backtestResult.winRate * 100).toFixed(2)}%, Trades: ${backtestResult.tradeCount}`);
//             } catch (error) {
//                 console.error(`[${pair}] Error: ${error.message}`);
//             }
//         }

//         // Initial ranking by profit, with minimum filters
//         const allRankedPairs = results
//             .filter(r => r.tradeCount >= minTrades && r.winRate >= minWinRate && r.profitPercent >= minProfitPercent)
//             .sort((a, b) => b.profit - a.profit);

//         if (allRankedPairs.length < topN) {
//             console.log(`Only ${allRankedPairs.length} pairs meet initial criteria. Relaxing standards may be needed.`);
//         }

//         // Take top N candidates for further analysis
//         const initialCandidates = allRankedPairs.slice(0, Math.max(topN, 5)); // Ensure at least 5 for replacements
//         console.log(`\nInitial top candidates:`);
//         initialCandidates.forEach(r => {
//             console.log(`${r.pair}: Profit=${r.profit.toFixed(2)} (${r.profitPercent.toFixed(2)}%), Win Rate=${(r.winRate * 100).toFixed(2)}%, Trades=${r.tradeCount}`);
//         });

//         // Analyze performance and swap if needed
//         const finalPairs = [];
//         const reservePairs = allRankedPairs.slice(topN); // Reserves for swapping
//         for (let i = 0; i < initialCandidates.length && finalPairs.length < topN; i++) {
//             const pair = initialCandidates[i].pair;
//             const isAcceptable = await analyzePairPerformance(pair, results.find(r => r.pair === pair));
//             if (isAcceptable) {
//                 finalPairs.push(pair);
//             } else {
//                 console.log(`[${pair}] Rejected based on performance analysis.`);
//             }
//         }

//         // If we don’t have enough pairs, pull from reserves
//         while (finalPairs.length < topN && reservePairs.length > 0) {
//             const nextPair = reservePairs.shift().pair;
//             const isAcceptable = await analyzePairPerformance(nextPair, results.find(r => r.pair === nextPair));
//             if (isAcceptable) {
//                 finalPairs.push(nextPair);
//                 console.log(`[${nextPair}] Added as replacement from reserves.`);
//             }
//         }

//         console.log(`\nFinal selected pairs:`);
//         finalPairs.forEach(pair => {
//             const r = results.find(r => r.pair === pair);
//             console.log(`${pair}: Profit=${r.profit.toFixed(2)} (${r.profitPercent.toFixed(2)}%), Win Rate=${(r.winRate * 100).toFixed(2)}%, Trades=${r.tradeCount}`);
//         });

//         return finalPairs;
//     } catch (error) {
//         console.error('findBestPairs error:', error.message);
//         return [];
//     }
// }

// // Updated runBotWithBestPairs with performance analysis
// async function runBotWithBestPairs() {
//     const bestPairs = await findBestPairs();
//     if (bestPairs.length === 0) {
//         console.log('No suitable pairs found.');
//         return;
//     }

//     tradingPairs.length = 0;
//     tradingPairs.push(...bestPairs);
//     console.log(`Selected trading pairs: ${tradingPairs}`);

//     await runBot();
//     startRealTimeMonitoring();
// }

// runBotWithBestPairs();
// END v6

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