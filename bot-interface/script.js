// Configuration
const API_URL = 'https://cors-anywhere.herokuapp.com/https://long-shot-production.up.railway.app/logs'; // Change this to your API endpoint
const REFRESH_INTERVAL = 30000; // 30 seconds

// State
let logs = [];
let tradingPairs = [];
let recentTrades = [];
let profitHistory = [];
let portfolioAllocation = [];
let indicatorPerformance = [];

// Charts
let profitChart;
let portfolioChart;

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', () => {
    initThemeToggle();
    initRefreshButton();
    initPeriodSelector();
    fetchData();
    setInterval(fetchData, REFRESH_INTERVAL);
});

// Theme toggle functionality
function initThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle');
    
    // Check for saved theme preference or use system preference
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
        document.body.classList.add('dark-theme');
        themeToggle.checked = true;
    }
    
    themeToggle.addEventListener('change', () => {
        if (themeToggle.checked) {
            document.body.classList.add('dark-theme');
            localStorage.setItem('theme', 'dark');
        } else {
            document.body.classList.remove('dark-theme');
            localStorage.setItem('theme', 'light');
        }
        
        // Update charts with new theme
        updateChartsTheme();
    });
}

// Refresh button functionality
function initRefreshButton() {
    const refreshButton = document.getElementById('refreshButton');
    refreshButton.addEventListener('click', () => {
        refreshButton.classList.add('animate-pulse');
        fetchData().then(() => {
            setTimeout(() => {
                refreshButton.classList.remove('animate-pulse');
            }, 1000);
        });
    });
}

// Period selector for profit chart
function initPeriodSelector() {
    const periodButtons = document.querySelectorAll('.period-btn');
    periodButtons.forEach(button => {
        button.addEventListener('click', () => {
            periodButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            updateProfitChart(button.dataset.period);
        });
    });
}

// Call this function after fetching logs
async function fetchData() {
    try {
        const response = await fetch(API_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        logs = await response.json();
        processLogs();
        updateDashboard();
        return true;
    } catch (error) {
        console.error('Error fetching data:', error);
        return false;
    }
}

// Process logs to extract trading data
function processLogs() {
    // Extract trading pairs
    tradingPairs = extractTradingPairs();
    
    // Extract recent trades
    recentTrades = extractRecentTrades();
    
    // Generate profit history
    profitHistory = generateProfitHistory();
    
    // Generate portfolio allocation
    portfolioAllocation = generatePortfolioAllocation();
    
    // Generate indicator performance
    indicatorPerformance = generateIndicatorPerformance();
}

// Extract trading pairs from logs
// Update the extractTradingPairs function in script.js
function extractTradingPairs() {
    const pairsMap = new Map();
    
    // First, look for WebSocket connection logs to get timeframes
    const timeframes = {};
    
    // Improved regex pattern for timeframe extraction
    logs.forEach(log => {
        // This pattern matches strings like: [LTC/USDT] 🌐 WebSocket connected (1h) 📡
        const timeframeMatch = log.message.match(/\[([\w\/]+)\].*WebSocket connected \(([\w]+)\)/);
        if (timeframeMatch) {
            const pair = timeframeMatch[1];
            const timeframe = timeframeMatch[2];
            timeframes[pair] = timeframe;
            console.log(`Found timeframe for ${pair}: ${timeframe}`); // Debug log
        }
    });
    
    // Look for portfolio status logs
    logs.forEach(log => {
        const portfolioMatch = log.message.match(/\[([\w\/]+)\] 💼 Portfolio: 💵 Cash=([\d.]+) \| 📊 Position=([-\d.]+) \| 💰 Value=([\d.]+)/);
        
        if (portfolioMatch) {
            const pair = portfolioMatch[1];
            const cash = parseFloat(portfolioMatch[2]);
            const position = parseFloat(portfolioMatch[3]);
            const value = parseFloat(portfolioMatch[4]);
            
            // Look for entry price in previous logs
            let entryPrice = 0;
            let trend = 'neutral';
            
            // Find buy/sell logs for this pair to determine entry price and trend
            for (let i = logs.length - 1; i >= 0; i--) {
                const buyMatch = logs[i].message.match(new RegExp(`\\[${pair.replace('/', '\\/')}\\] 📈.*Buy: ([\\d.]+) at 💲([\\d.]+)`));
                const sellMatch = logs[i].message.match(new RegExp(`\\[${pair.replace('/', '\\/')}\\] 📉.*Sell: ([\\d.]+) 📤 at \\$([\\d.]+)`));
                
                if (buyMatch && position > 0) {
                    entryPrice = parseFloat(buyMatch[2]);
                    trend = 'up';
                    break;
                } else if (sellMatch && position < 0) {
                    entryPrice = parseFloat(sellMatch[2]);
                    trend = 'down';
                    break;
                }
            }
            
            // Find the most recent price from logs if available
            let currentPrice = 0;
            for (let i = logs.length - 1; i >= 0; i--) {
                const priceMatch = logs[i].message.match(new RegExp(`\\[${pair.replace('/', '\\/')}\\].*current price: \\$([\\d.]+)`));
                if (priceMatch) {
                    currentPrice = parseFloat(priceMatch[1]);
                    break;
                }
            }
            
            // If we don't have a current price, estimate from the portfolio value
            if (currentPrice === 0) {
                // For your specific log format, we'll use the last known price from results
                for (let i = logs.length - 1; i >= 0; i--) {
                    const resultsMatch = logs[i].message.match(new RegExp(`📊 Pair #\\d+ - ${pair.replace('/', '\\/')} Results:`));
                    if (resultsMatch) {
                        // Use a placeholder price since we don't have the actual price
                        currentPrice = entryPrice || 100; // Default to 100 if no entry price
                        break;
                    }
                }
            }
            
            // Calculate profit/loss (will be 0 if position is 0)
            const profitLoss = position * (currentPrice - entryPrice);
            
            // Extract win rate from logs
            let winRate = 0;
            for (let i = logs.length - 1; i >= 0; i--) {
                const winRateMatch = logs[i].message.match(new RegExp(`📊 Pair #\\d+ - ${pair.replace('/', '\\/')} Results:.*Win Rate: ([\\d.]+)%`));
                if (winRateMatch) {
                    winRate = parseFloat(winRateMatch[1]);
                    break;
                }
            }
            
            pairsMap.set(pair, {
                symbol: pair,
                position: position,
                entryPrice: entryPrice || currentPrice,
                currentPrice: currentPrice,
                profitLoss: profitLoss,
                trend: trend,
                winRate: winRate,
                timeframe: timeframes[pair] || 'unknown' // Add timeframe information
            });
        }
    });
    
    // Also look for the final selected pairs message
    for (let i = logs.length - 1; i >= 0; i--) {
        const selectedPairsMatch = logs[i].message.match(/🌟 Selected pairs: ([\w\/\s,]+) 🎉/);
        if (selectedPairsMatch) {
            const selectedPairs = selectedPairsMatch[1].split(', ');
            
            // Add any selected pairs that might not have portfolio updates yet
            selectedPairs.forEach(pair => {
                if (!pairsMap.has(pair)) {
                    pairsMap.set(pair, {
                        symbol: pair,
                        position: 0,
                        entryPrice: 0,
                        currentPrice: 0,
                        profitLoss: 0,
                        trend: 'neutral',
                        winRate: 0,
                        timeframe: timeframes[pair] || 'unknown' // Add timeframe information
                    });
                } else if (!pairsMap.get(pair).timeframe && timeframes[pair]) {
                    // Update timeframe if it wasn't set before
                    const pairData = pairsMap.get(pair);
                    pairData.timeframe = timeframes[pair];
                    pairsMap.set(pair, pairData);
                }
            });
            
            break;
        }
    }
    
    // Let's add a direct check for WebSocket logs for each pair
    // This ensures we don't miss any timeframe information
    pairsMap.forEach((data, pair) => {
        if (data.timeframe === 'unknown') {
            for (let i = logs.length - 1; i >= 0; i--) {
                const wsMatch = logs[i].message.match(new RegExp(`\\[${pair.replace('/', '\\/')}\\].*WebSocket connected \$$(\\w+)\$$`));
                if (wsMatch) {
                    data.timeframe = wsMatch[1];
                    pairsMap.set(pair, data);
                    break;
                }
            }
        }
    });
    
    // Return all pairs, including those with zero positions
    return Array.from(pairsMap.values());
}

// Extract recent trades from logs
function extractRecentTrades() {
    const trades = [];
    
    logs.forEach(log => {
        // Match buy logs
        const buyMatch = log.message.match(/\[([\w\/]+)\] 📈 Buy: ([\d.]+) at 💲([\d.]+)/);
        if (buyMatch) {
            trades.push({
                pair: buyMatch[1],
                type: 'buy',
                price: parseFloat(buyMatch[3]),
                quantity: parseFloat(buyMatch[2]),
                profit: 0,
                timestamp: new Date(log.timestamp)
            });
        }
        
        // Match sell logs
        const sellMatch = log.message.match(/\[([\w\/]+)\] 📉 Sell: ([\d.]+) 📤 at \$([\d.]+)/);
        if (sellMatch) {
            // Try to find profit information
            const profitMatch = log.message.match(/profit=([+-]?[\d.]+)/i);
            const profit = profitMatch ? parseFloat(profitMatch[1]) : 0;
            
            trades.push({
                pair: sellMatch[1],
                type: 'sell',
                price: parseFloat(sellMatch[3]),
                quantity: parseFloat(sellMatch[2]),
                profit,
                timestamp: new Date(log.timestamp)
            });
        }
        
        // Match take profit logs
        const tpMatch = log.message.match(/\[([\w\/]+)\] 🎯 Take Profit: Sold ([\d.]+) 📤 at \$([\d.]+)/);
        if (tpMatch) {
            trades.push({
                pair: tpMatch[1],
                type: 'take_profit',
                price: parseFloat(tpMatch[3]),
                quantity: parseFloat(tpMatch[2]),
                profit: 0, // We don't have profit info directly in this log
                timestamp: new Date(log.timestamp)
            });
        }
        
        // Match short logs (if applicable)
        const shortMatch = log.message.match(/\[([\w\/]+)\] short: ([\d.]+) at \$([\d.]+)/i);
        if (shortMatch) {
            trades.push({
                pair: shortMatch[1],
                type: 'short',
                price: parseFloat(shortMatch[3]),
                quantity: parseFloat(shortMatch[2]),
                profit: 0,
                timestamp: new Date(log.timestamp)
            });
        }
    });
    
    // Sort by timestamp (newest first) and take the most recent 10
    return trades.sort((a, b) => b.timestamp - a.timestamp).slice(0, 10);
}

// Generate profit history from logs
function generateProfitHistory() {
    // Look for logs with profit information
    const profitPoints = [];
    const now = new Date();
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
    
    // Start with some initial value
    let cumulativeProfit = 0;
    
    // Find initial profit value if available
    for (const log of logs) {
        const statsMatch = log.message.match(/Stats: Total Profit=([\d.]+)/);
        if (statsMatch) {
            cumulativeProfit = parseFloat(statsMatch[1]);
            break;
        }
    }
    
    // Generate hourly data points for the last 24 hours
    for (let i = 0; i < 24; i++) {
        const hour = new Date(oneDayAgo.getTime() + i * 60 * 60 * 1000);
        
        // Find trades that happened in this hour
        const hourlyProfit = logs
            .filter(log => {
                const logTime = new Date(log.timestamp);
                return logTime >= hour && logTime < new Date(hour.getTime() + 60 * 60 * 1000);
            })
            .reduce((sum, log) => {
                const profitMatch = log.message.match(/profit=([-+]?[\d.]+)/i);
                return sum + (profitMatch ? parseFloat(profitMatch[1]) : 0);
            }, 0);
        
        cumulativeProfit += hourlyProfit;
        
        profitPoints.push({
            time: hour.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            profit: cumulativeProfit
        });
    }
    
    return profitPoints;
}

// Generate portfolio allocation data
function generatePortfolioAllocation() {
    const portfolio = [];
    let totalValue = 0;
    
    // Add up positions from active trading pairs
    tradingPairs.forEach(pair => {
        const value = Math.abs(pair.position * pair.currentPrice);
        totalValue += value;
        
        portfolio.push({
            name: pair.symbol.split('/')[0],
            value
        });
    });
    
    // Add cash component (estimate from logs)
    let cashValue = 0;
    for (const log of logs) {
        const cashMatch = log.message.match(/Cash=([+-]?[\d.]+)/);
        if (cashMatch) {
            cashValue = parseFloat(cashMatch[1]);
            break;
        }
    }
    
    if (cashValue > 0) {
        portfolio.push({
            name: 'Cash',
            value: cashValue
        });
        totalValue += cashValue;
    }
    
    return portfolio;
}

// Generate indicator performance data
function generateIndicatorPerformance() {
    // Look for indicator alignment score logs
    const indicators = [
        { name: 'MA Cross', successRate: 0 },
        { name: 'MACD', successRate: 0 },
        { name: 'RSI', successRate: 0 },
        { name: 'Bollinger Bands', successRate: 0 },
        { name: 'Volume Profile', successRate: 0 }
    ];
    
    logs.forEach(log => {
        // Match logs with indicator success rates
        const maMatch = log.message.match(/maCrossSuccessRate: ([\d.]+)/);
        const macdMatch = log.message.match(/macdCrossSuccessRate: ([\d.]+)/);
        const rsiMatch = log.message.match(/rsiReversalSuccessRate: ([\d.]+)/);
        const bbMatch = log.message.match(/bbReversalSuccessRate: ([\d.]+)/);
        
        if (maMatch) indicators[0].successRate = parseFloat(maMatch[1]) * 100;
        if (macdMatch) indicators[1].successRate = parseFloat(macdMatch[1]) * 100;
        if (rsiMatch) indicators[2].successRate = parseFloat(rsiMatch[1]) * 100;
        if (bbMatch) indicators[3].successRate = parseFloat(bbMatch[1]) * 100;
    });
    
    // If we don't have real data, generate some placeholder values
    if (indicators.every(i => i.successRate === 0)) {
        indicators[0].successRate = 72;
        indicators[1].successRate = 68;
        indicators[2].successRate = 65;
        indicators[3].successRate = 58;
        indicators[4].successRate = 63;
    }
    
    return indicators;
}

// Update the dashboard with the processed data
function updateDashboard() {
    updateMetrics();
    updateTradingPairsTable();
    updateRecentTradesTable();
    updateIndicatorsGrid();
    
    if (!profitChart) {
        initProfitChart();
    } else {
        updateProfitChart();
    }
    
    if (!portfolioChart) {
        initPortfolioChart();
    } else {
        updatePortfolioChart();
    }
}

// Update metrics section
function updateMetrics() {
    // Calculate total profit
    let totalProfit = 0;
    let profitChange = 0;
    
    // Look for stats logs
    for (const log of logs) {
        const statsMatch = log.message.match(/Stats: Total Profit=([\d.]+)/);
        if (statsMatch) {
            totalProfit = parseFloat(statsMatch[1]);
            break;
        }
    }
    
    // Count total trades
    const totalTrades = recentTrades.length;
    
    // Calculate win rate
    const winningTrades = recentTrades.filter(trade => trade.profit > 0).length;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    
    // Count active pairs
    const activePairs = tradingPairs.length;
    
    // Update the DOM
    animateCounter('totalProfit', totalProfit);
    animateCounter('totalTrades', totalTrades);
    animateCounter('winRate', winRate);
    animateCounter('activePairs', activePairs);
    
    // Update profit change indicator
    const profitChangeElement = document.getElementById('profitChange');
    if (profitChange >= 0) {
        profitChangeElement.classList.add('positive');
        profitChangeElement.classList.remove('negative');
        profitChangeElement.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>
            <span>${profitChange.toFixed(2)}%</span>
        `;
    } else {
        profitChangeElement.classList.add('negative');
        profitChangeElement.classList.remove('positive');
        profitChangeElement.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m19 12-7 7-7-7"/><path d="M12 5v14"/></svg>
            <span>${Math.abs(profitChange).toFixed(2)}%</span>
        `;
    }
}

// Update trading pairs table
function updateTradingPairsTable() {
    const tableBody = document.querySelector('#tradingPairsTable tbody');
    
    if (tradingPairs.length === 0) {
        tableBody.innerHTML = `
            <tr class="empty-state">
                <td colspan="6"> <!-- Updated column count -->
                    <div class="empty-message">
                        <p>No active trading pairs</p>
                        <p class="empty-submessage">Waiting for signals...</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    tableBody.innerHTML = '';
    
    tradingPairs.forEach((pair, index) => {
        const row = document.createElement('tr');
        row.className = 'animate-in';
        row.style.animationDelay = `${index * 100}ms`;
        
        // For pairs with zero position, show a "monitoring" status
        const status = pair.position === 0 ? 
            '<span class="badge badge-monitoring">Monitoring</span>' : 
            `<span class="badge ${pair.trend === 'up' ? 'badge-up' : pair.trend === 'down' ? 'badge-down' : 'badge-neutral'}">
                ${pair.trend === 'up' ? 
                    '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>' : 
                    pair.trend === 'down' ?
                    '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m19 12-7 7-7-7"/><path d="M12 5v14"/></svg>' :
                    ''
                }
                ${pair.trend}
            </span>`;
        
        row.innerHTML = `
            <td>
                <div class="pair-cell">
                    <div class="pair-icon">${pair.symbol.split('/')[0].charAt(0)}</div>
                    <div>
                        <div>${pair.symbol}</div>
                        <div class="pair-details">
                            ${status}
                            <span class="badge badge-timeframe">${pair.timeframe}</span>
                        </div>
                    </div>
                </div>
            </td>
            <td>${pair.position.toFixed(6)}</td>
            <td>$${pair.entryPrice > 0 ? pair.entryPrice.toFixed(2) : 'N/A'}</td>
            <td>$${pair.currentPrice > 0 ? pair.currentPrice.toFixed(2) : 'N/A'}</td>
            <td class="${pair.profitLoss > 0 ? 'profit' : pair.profitLoss < 0 ? 'loss' : ''}" style="text-align: right;">
                ${pair.profitLoss !== 0 ? 
                    `${pair.profitLoss > 0 ? 
                        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>' : 
                        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m19 12-7 7-7-7"/><path d="M12 5v14"/></svg>'
                    }
                    $${Math.abs(pair.profitLoss).toFixed(2)}` : 
                    'N/A'
                }
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}

// Update recent trades table
function updateRecentTradesTable() {
    const tableBody = document.querySelector('#recentTradesTable tbody');
    
    if (recentTrades.length === 0) {
        tableBody.innerHTML = `
            <tr class="empty-state">
                <td colspan="5">
                    <div class="empty-message">
                        <p>No recent trades</p>
                        <p class="empty-submessage">Trades will appear here</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    tableBody.innerHTML = '';
    
    recentTrades.forEach((trade, index) => {
        const row = document.createElement('tr');
        row.className = 'animate-in';
        row.style.animationDelay = `${index * 100}ms`;
        
        row.innerHTML = `
            <td>${trade.pair}</td>
            <td>
                <div class="badge ${trade.type.includes('buy') || trade.type.includes('short') ? 'badge-buy' : 'badge-sell'}">
                    ${trade.type}
                </div>
            </td>
            <td>$${trade.price.toFixed(2)}</td>
            <td>${trade.quantity.toFixed(6)}</td>
            <td class="${trade.profit >= 0 ? 'profit' : 'loss'}" style="text-align: right;">
                $${trade.profit.toFixed(2)}
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}

// Update indicators grid
function updateIndicatorsGrid() {
    const indicatorsGrid = document.getElementById('indicatorsGrid');
    
    if (indicatorPerformance.length === 0) {
        indicatorsGrid.innerHTML = `
            <div class="empty-message" style="height: 200px; width: 100%;">
                <p>No indicator data</p>
                <p class="empty-submessage">Waiting for performance data...</p>
            </div>
        `;
        return;
    }
    
    indicatorsGrid.innerHTML = '';
    
    indicatorPerformance.forEach((indicator, index) => {
        const indicatorElement = document.createElement('div');
        indicatorElement.className = 'indicator animate-in';
        indicatorElement.style.animationDelay = `${index * 100}ms`;
        
        let progressClass = 'progress-low';
        if (indicator.successRate >= 70) {
            progressClass = 'progress-high';
        } else if (indicator.successRate >= 50) {
            progressClass = 'progress-medium';
        }
        
        indicatorElement.innerHTML = `
            <div class="indicator-header">
                <div class="indicator-name">${indicator.name}</div>
                <div class="indicator-value">${indicator.successRate.toFixed(1)}%</div>
            </div>
            <div class="progress-bar">
                <div class="progress-value ${progressClass}" style="width: ${indicator.successRate}%"></div>
            </div>
        `;
        
        indicatorsGrid.appendChild(indicatorElement);
    });
}

// Initialize profit chart
function initProfitChart() {
    const ctx = document.getElementById('profitChart').getContext('2d');
    
    profitChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: 'Profit',
                data: profitHistory.map(point => ({
                    x: point.time,
                    y: point.profit
                })),
                borderColor: '#10b981',
                backgroundColor: createGradient(ctx, '#10b981'),
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 4,
                pointHoverBackgroundColor: '#10b981',
                pointHoverBorderColor: '#ffffff',
                pointHoverBorderWidth: 2,
                tension: 0.4,
                fill: true
            }]
        },
        options: getProfitChartOptions()
    });
}

// Update profit chart
function updateProfitChart(period = '24h') {
    if (!profitChart) return;
    
    // Generate data based on selected period
    let data;
    
    if (period === '24h') {
        data = profitHistory;
    } else if (period === '7d') {
        // Generate daily data for 7 days
        data = generateDailyProfitData(7);
    } else if (period === '30d') {
        // Generate daily data for 30 days
        data = generateDailyProfitData(30);
    }
    
    profitChart.data.datasets[0].data = data.map(point => ({
        x: point.time,
        y: point.profit
    }));
    
    profitChart.update();
}

// Generate daily profit data for longer periods
function generateDailyProfitData(days) {
    const data = [];
    const now = new Date();
    let cumulativeProfit = profitHistory[profitHistory.length - 1]?.profit || 0;
    
    for (let i = days - 1; i >= 0; i--) {
        const day = new Date(now);
        day.setDate(now.getDate() - i);
        
        // Add some random fluctuation for demo purposes
        const dailyChange = (Math.random() * 100) - 30;
        cumulativeProfit += dailyChange;
        
        data.push({
            time: day.toLocaleDateString([], { month: 'short', day: 'numeric' }),
            profit: Math.max(0, cumulativeProfit)
        });
    }
    
    return data;
}

// Initialize portfolio chart
function initPortfolioChart() {
    const ctx = document.getElementById('portfolioChart').getContext('2d');
    
    const colors = [
        '#10b981', // green
        '#3b82f6', // blue
        '#8b5cf6', // purple
        '#ec4899', // pink
        '#f59e0b', // amber
        '#ef4444'  // red
    ];
    
    portfolioChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: portfolioAllocation.map(item => item.name),
            datasets: [{
                data: portfolioAllocation.map(item => item.value),
                backgroundColor: portfolioAllocation.map((_, i) => colors[i % colors.length]),
                borderColor: getComputedStyle(document.body).getPropertyValue('--card'),
                borderWidth: 2
            }]
        },
        options: getPortfolioChartOptions()
    });
}

// Update portfolio chart
function updatePortfolioChart() {
    if (!portfolioChart) return;
    
    portfolioChart.data.labels = portfolioAllocation.map(item => item.name);
    portfolioChart.data.datasets[0].data = portfolioAllocation.map(item => item.value);
    
    portfolioChart.update();
}

// Update charts theme when theme changes
function updateChartsTheme() {
    if (profitChart) {
        profitChart.options = getProfitChartOptions();
        profitChart.update();
    }
    
    if (portfolioChart) {
        portfolioChart.options = getPortfolioChartOptions();
        portfolioChart.update();
    }
}

// Get profit chart options based on current theme
function getProfitChartOptions() {
    const isDark = document.body.classList.contains('dark-theme');
    const textColor = isDark ? '#9ca3af' : '#6b7280';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                mode: 'index',
                intersect: false,
                backgroundColor: isDark ? '#374151' : '#ffffff',
                titleColor: isDark ? '#f9fafb' : '#1f2937',
                bodyColor: isDark ? '#f9fafb' : '#1f2937',
                borderColor: isDark ? '#4b5563' : '#e5e7eb',
                borderWidth: 1,
                padding: 12,
                cornerRadius: 8,
                titleFont: {
                    size: 14,
                    weight: 'bold'
                },
                bodyFont: {
                    size: 14
                },
                displayColors: false,
                callbacks: {
                    title: (items) => items[0].label,
                    label: (item) => `Profit: $${item.raw.y.toFixed(2)}`
                }
            }
        },
        scales: {
            x: {
                grid: {
                    display: false
                },
                ticks: {
                    color: textColor,
                    font: {
                        size: 12
                    },
                    maxRotation: 0
                }
            },
            y: {
                grid: {
                    color: gridColor,
                    drawBorder: false
                },
                ticks: {
                    color: textColor,
                    font: {
                        size: 12
                    },
                    callback: (value) => `$${value}`
                }
            }
        }
    };
}

// Get portfolio chart options based on current theme
function getPortfolioChartOptions() {
    const isDark = document.body.classList.contains('dark-theme');
    const textColor = isDark ? '#9ca3af' : '#6b7280';
    
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    color: textColor,
                    font: {
                        size: 12
                    },
                    padding: 20,
                    usePointStyle: true,
                    pointStyle: 'circle'
                }
            },
            tooltip: {
                backgroundColor: isDark ? '#374151' : '#ffffff',
                titleColor: isDark ? '#f9fafb' : '#1f2937',
                bodyColor: isDark ? '#f9fafb' : '#1f2937',
                borderColor: isDark ? '#4b5563' : '#e5e7eb',
                borderWidth: 1,
                padding: 12,
                cornerRadius: 8,
                callbacks: {
                    label: (context) => {
                        const label = context.label || '';
                        const value = context.raw || 0;
                        const total = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                        const percentage = ((value / total) * 100).toFixed(1);
                        return `${label}: $${value.toFixed(2)} (${percentage}%)`;
                    }
                }
            }
        },
        cutout: '50%',
        animation: {
            animateRotate: true,
            animateScale: true
        }
    };
}

// Create gradient for chart background
function createGradient(ctx, color) {
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, `${color}80`); // 50% opacity
    gradient.addColorStop(1, `${color}00`); // 0% opacity
    return gradient;
}

// Animate counter for metrics
function animateCounter(id, endValue) {
    const element = document.getElementById(id);
    if (!element) return;
    
    const startValue = parseFloat(element.textContent) || 0;
    const isDecimal = String(endValue).includes('.') || id === 'totalProfit' || id === 'winRate';
    const decimalPlaces = id === 'totalProfit' ? 2 : id === 'winRate' ? 1 : 0;
    
    // const countUp = new CountUp(element, startValue, endValue, decimalPlaces, 1, {
    //     useEasing: true,
    //     useGrouping: true,
    //     separator: ',',
    //     decimal: '.'
    // });
    
    // if (!countUp.error) {
    //     countUp.start();
    // } else {
    //     console.error(countUp.error);
    //     element.textContent = isDecimal ? endValue.toFixed(decimalPlaces) : endValue;
    // }
}