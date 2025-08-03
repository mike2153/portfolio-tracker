const https = require('http');

function makeRequest(period) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 8000,
            path: `/api/portfolio/performance/historical?period=${period}&benchmark=SPY`,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', (e) => {
            reject(e);
        });

        req.end();
    });
}

async function debugChart() {
    console.log('=== DEBUGGING CHART DATA ALIGNMENT ===\n');
    
    try {
        // Test monthly data
        console.log('📊 Testing Monthly (1M) Data:');
        const monthlyData = await makeRequest('1M');
        
        console.log('Raw monthly response:', JSON.stringify(monthlyData, null, 2));
        
        // Also test MAX data
        console.log('\n📊 Testing MAX Data:');
        const maxData = await makeRequest('MAX');
        
        const portfolioPoints = monthlyData.portfolio_performance || [];
        const benchmarkPoints = monthlyData.benchmark_performance || [];
        
        console.log(`Portfolio points: ${portfolioPoints.length}`);
        console.log(`Benchmark points: ${benchmarkPoints.length}`);
        
        if (portfolioPoints.length > 0) {
            console.log(`\nPortfolio first: ${portfolioPoints[0].date} = $${portfolioPoints[0].value}`);
            console.log(`Portfolio last: ${portfolioPoints[portfolioPoints.length - 1].date} = $${portfolioPoints[portfolioPoints.length - 1].value}`);
        }
        
        if (benchmarkPoints.length > 0) {
            console.log(`\nBenchmark first: ${benchmarkPoints[0].date} = $${benchmarkPoints[0].value.toFixed(2)}`);
            console.log(`Benchmark last: ${benchmarkPoints[benchmarkPoints.length - 1].date} = $${benchmarkPoints[benchmarkPoints.length - 1].value.toFixed(2)}`);
        }
        
        if (portfolioPoints.length > 0 && benchmarkPoints.length > 0) {
            const portfolioStart = portfolioPoints[0].value;
            const benchmarkStart = benchmarkPoints[0].value;
            const difference = portfolioStart - benchmarkStart;
            
            console.log(`\n🔍 STARTING VALUES COMPARISON:`);
            console.log(`Portfolio starting value: $${portfolioStart}`);
            console.log(`Benchmark starting value: $${benchmarkStart.toFixed(2)}`);
            console.log(`Difference: $${difference.toFixed(2)}`);
            
            if (Math.abs(difference) > 1) {
                console.log(`❌ ISSUE FOUND: Starting values are different by $${Math.abs(difference).toFixed(2)}`);
                console.log(`This suggests the index simulation is not properly normalized to the portfolio starting value.`);
            } else {
                console.log(`✅ Starting values are aligned (difference < $1)`);
            }
        }
        
        // Show first 5 data points of each for detailed comparison
        console.log(`\n📈 FIRST 5 PORTFOLIO DATA POINTS:`);
        portfolioPoints.slice(0, 5).forEach((point, i) => {
            console.log(`  ${i + 1}. ${point.date} = $${point.value}`);
        });
        
        console.log(`\n📊 FIRST 5 BENCHMARK DATA POINTS:`);
        benchmarkPoints.slice(0, 5).forEach((point, i) => {
            console.log(`  ${i + 1}. ${point.date} = $${point.value.toFixed(2)}`);
        });
        
    } catch (error) {
        console.error('Error making API request:', error.message);
    }
}

debugChart();