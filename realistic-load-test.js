// Realistic Load Test for Database-Heavy Endpoints
const http = require('http');

async function testEndpoint(url, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const req = http.get(url, { timeout }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const responseTime = Date.now() - startTime;
                resolve({ 
                    status: res.statusCode, 
                    responseTime,
                    success: res.statusCode >= 200 && res.statusCode < 300 
                });
            });
        });

        req.on('error', () => reject(new Error('Request failed')));
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Timeout'));
        });
    });
}

async function runRealisticTest(concurrency = 10, duration = 30) {
    const baseUrl = 'http://localhost:8000';
    const stats = {
        total: 0,
        success: 0,
        errors: 0,
        timeouts: 0,
        responseTimes: []
    };
    
    console.log(`🧪 REALISTIC LOAD TEST`);
    console.log(`👥 ${concurrency} concurrent users for ${duration}s`);
    console.log(`🎯 Testing database-heavy endpoints\n`);
    
    const endTime = Date.now() + (duration * 1000);
    
    while (Date.now() < endTime) {
        const promises = [];
        
        // Simulate realistic user sessions
        for (let i = 0; i < concurrency; i++) {
            promises.push(
                testEndpoint(`${baseUrl}/api/dashboard/overview`)
                    .then(result => {
                        stats.total++;
                        if (result.success) {
                            stats.success++;
                            stats.responseTimes.push(result.responseTime);
                        } else {
                            stats.errors++;
                        }
                    })
                    .catch(() => {
                        stats.total++;
                        stats.errors++;
                    })
            );
        }
        
        await Promise.allSettled(promises);
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second between batches
        
        // Progress update
        if (stats.total > 0 && stats.total % 20 === 0) {
            console.log(`📊 Requests: ${stats.total}, Success: ${stats.success}, Errors: ${stats.errors}`);
        }
    }
    
    // Calculate results
    const successRate = ((stats.success / stats.total) * 100).toFixed(1);
    const avgResponseTime = stats.responseTimes.length > 0 
        ? (stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length).toFixed(0)
        : 0;
    
    console.log(`\n📈 RESULTS`);
    console.log(`=`.repeat(40));
    console.log(`📤 Total Requests: ${stats.total}`);
    console.log(`✅ Successful: ${stats.success}`);
    console.log(`❌ Errors: ${stats.errors}`);
    console.log(`📊 Success Rate: ${successRate}%`);
    console.log(`⚡ Avg Response Time: ${avgResponseTime}ms`);
    console.log(`🚀 Requests/Second: ${(stats.total / duration).toFixed(1)}`);
    
    // Capacity estimate
    console.log(`\n🎯 CAPACITY ESTIMATE`);
    console.log(`=`.repeat(40));
    
    if (parseFloat(successRate) > 95 && avgResponseTime < 1000) {
        const estimate = Math.floor(concurrency * 2);
        console.log(`✅ Can handle ~${estimate} concurrent users`);
    } else if (parseFloat(successRate) > 80) {
        const estimate = Math.floor(concurrency * 1.2);
        console.log(`⚠️  Can handle ~${estimate} concurrent users (degraded)`);
    } else {
        console.log(`❌ Overloaded at ${concurrency} concurrent users`);
        console.log(`🚨 UPGRADE NEEDED: docker-compose -f docker-compose.prod.yml up -d`);
    }
}

// Run the test
const concurrency = parseInt(process.argv[2]) || 10;
const duration = parseInt(process.argv[3]) || 30;

runRealisticTest(concurrency, duration).catch(console.error); 