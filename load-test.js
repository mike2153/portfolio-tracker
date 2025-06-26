// Load Testing Script for Production Capacity
// Run with: node load-test.js

const http = require('http');
const https = require('https');

class LoadTester {
    constructor(baseUrl, concurrency = 10, duration = 60) {
        this.baseUrl = baseUrl;
        this.concurrency = concurrency;
        this.duration = duration;
        this.stats = {
            requests: 0,
            responses: 0,
            errors: 0,
            timeouts: 0,
            responseTimes: []
        };
    }

    async makeRequest(endpoint) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const url = `${this.baseUrl}${endpoint}`;
            const client = url.startsWith('https') ? https : http;
            
            const req = client.get(url, { timeout: 5000 }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    const responseTime = Date.now() - startTime;
                    this.stats.responses++;
                    this.stats.responseTimes.push(responseTime);
                    resolve({ status: res.statusCode, responseTime, data });
                });
            });

            req.on('error', (err) => {
                this.stats.errors++;
                reject(err);
            });

            req.on('timeout', () => {
                this.stats.timeouts++;
                req.destroy();
                reject(new Error('Request timeout'));
            });

            this.stats.requests++;
        });
    }

    async runConcurrentRequests(endpoint) {
        const promises = [];
        for (let i = 0; i < this.concurrency; i++) {
            promises.push(this.makeRequest(endpoint));
        }
        
        try {
            await Promise.allSettled(promises);
        } catch (error) {
            // Errors are already tracked in stats
        }
    }

    async startTest(endpoint = '/api/hello') {
        console.log(`🚀 Starting load test: ${this.concurrency} concurrent users for ${this.duration}s`);
        console.log(`📍 Target: ${this.baseUrl}${endpoint}`);
        console.log('⏱️  Running...\n');

        const startTime = Date.now();
        const endTime = startTime + (this.duration * 1000);

        while (Date.now() < endTime) {
            await this.runConcurrentRequests(endpoint);
            
            // Brief pause to prevent overwhelming
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Progress update every 10 seconds
            if (this.stats.requests % 100 === 0) {
                this.printProgress();
            }
        }

        this.printResults();
    }

    printProgress() {
        const elapsed = Math.floor((Date.now() - Date.now()) / 1000);
        console.log(`📊 Requests: ${this.stats.requests}, Responses: ${this.stats.responses}, Errors: ${this.stats.errors}`);
    }

    printResults() {
        const totalTime = this.duration;
        const avgResponseTime = this.stats.responseTimes.length > 0 
            ? this.stats.responseTimes.reduce((a, b) => a + b, 0) / this.stats.responseTimes.length 
            : 0;
        
        const p95ResponseTime = this.stats.responseTimes.length > 0
            ? this.stats.responseTimes.sort((a, b) => a - b)[Math.floor(this.stats.responseTimes.length * 0.95)]
            : 0;

        const requestsPerSecond = this.stats.requests / totalTime;
        const successRate = ((this.stats.responses / this.stats.requests) * 100).toFixed(2);

        console.log('\n📈 LOAD TEST RESULTS');
        console.log('='.repeat(50));
        console.log(`⏱️  Duration: ${totalTime}s`);
        console.log(`👥 Concurrent Users: ${this.concurrency}`);
        console.log(`📤 Total Requests: ${this.stats.requests}`);
        console.log(`📥 Successful Responses: ${this.stats.responses}`);
        console.log(`❌ Errors: ${this.stats.errors}`);
        console.log(`⏰ Timeouts: ${this.stats.timeouts}`);
        console.log(`✅ Success Rate: ${successRate}%`);
        console.log(`🚀 Requests/Second: ${requestsPerSecond.toFixed(2)}`);
        console.log(`⚡ Avg Response Time: ${avgResponseTime.toFixed(2)}ms`);
        console.log(`📊 95th Percentile: ${p95ResponseTime.toFixed(2)}ms`);
        
        console.log('\n🎯 CAPACITY ESTIMATE');
        console.log('='.repeat(50));
        
        if (successRate > 95 && avgResponseTime < 500) {
            const estimatedUsers = Math.floor(requestsPerSecond * this.concurrency * 2);
            console.log(`✅ Current setup can handle ~${estimatedUsers} concurrent users`);
        } else if (successRate > 90) {
            const estimatedUsers = Math.floor(requestsPerSecond * this.concurrency * 1.5);
            console.log(`⚠️  Current setup can handle ~${estimatedUsers} concurrent users (with some degradation)`);
        } else {
            console.log(`❌ Current setup is overloaded at ${this.concurrency} concurrent users`);
        }

        // Production recommendations
        console.log('\n💡 PRODUCTION RECOMMENDATIONS');
        console.log('='.repeat(50));
        
        if (this.concurrency >= 100) {
            console.log('🚀 For 1000+ users, deploy Kubernetes with auto-scaling');
            console.log('📊 Scale to 25-30 backend pods minimum');
            console.log('💾 Add Redis caching for better performance');
        } else {
            console.log('📈 Test with higher concurrency: node load-test.js 100');
            console.log('🐳 Deploy docker-compose.prod.yml for better capacity');
        }
    }
}

// CLI usage
async function main() {
    const args = process.argv.slice(2);
    const concurrency = parseInt(args[0]) || 10;
    const duration = parseInt(args[1]) || 30;
    const baseUrl = args[2] || 'http://localhost:8000';
    
    console.log('🧪 PRODUCTION CAPACITY TESTER');
    console.log('='.repeat(50));
    console.log('Usage: node load-test.js [concurrency] [duration] [baseUrl]');
    console.log(`Example: node load-test.js 100 60 http://localhost:8000\n`);

    const tester = new LoadTester(baseUrl, concurrency, duration);
    await tester.startTest();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = LoadTester; 