import http from 'http';

/**
 * REAL CONCURRENT API TEST
 * This simulates your exact client scenario: 12 concurrent API requests
 */

console.log('=== REAL CLIENT SCENARIO TEST ===');
console.log('Simulating 12 concurrent requests from batch-ta client...\n');

async function testRealConcurrentRequests() {
  try {
    console.log('🎯 Testing the EXACT scenario where your client fails...');
    console.log('Making 12 concurrent requests to the running API server\n');
    
    // Test server availability
    const isServerRunning = await testServerConnection();
    if (!isServerRunning) {
      console.log('❌ API server not responding on localhost:3000');
      return;
    }
    
    console.log('✅ API server is running on localhost:3000\n');
    
    // Make 12 concurrent requests that will trigger nonce generation
    console.log('🚀 Sending 12 concurrent market sell requests...');
    
    const promises = Array.from({ length: 12 }, (_, i) => 
      makeMarketSellRequest(i + 1)
        .then(result => ({ requestId: i + 1, success: true, ...result }))
        .catch(error => ({ requestId: i + 1, success: false, error: error.message }))
    );
    
    const startTime = Date.now();
    const results = await Promise.all(promises);
    const duration = Date.now() - startTime;
    
    // Analyze results
    console.log('\n📊 CONCURRENT REQUEST RESULTS:');
    console.log(`Total time: ${duration}ms`);
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`✅ Successful: ${successful.length}/12`);
    console.log(`❌ Failed: ${failed.length}/12`);
    
    if (failed.length > 0) {
      console.log('\n🚨 FAILURES (this is your production problem):');
      failed.forEach(f => {
        console.log(`  Request ${f.requestId}: ${f.error}`);
      });
      
      // Check for nonce-related errors
      const nonceErrors = failed.filter(f => 
        f.error.includes('nonce') || 
        f.error.includes('Invalid') ||
        f.error.includes('duplicate')
      );
      
      if (nonceErrors.length > 0) {
        console.log(`\n💥 ${nonceErrors.length} requests failed with NONCE ERRORS`);
        console.log('This confirms the race condition in nonce generation!');
      }
    }
    
    console.log('\n🎯 CONCLUSION:');
    if (failed.length === 0) {
      console.log('✅ All requests succeeded - the race condition might be fixed!');
    } else {
      console.log(`❌ ${failed.length} requests failed - race condition still exists`);
      console.log('The nonce generation logic needs further improvement.');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

function testServerConnection() {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/',
      method: 'GET',
      timeout: 3000
    }, (res) => {
      resolve(true);
    });
    
    req.on('error', () => resolve(false));
    req.on('timeout', () => resolve(false));
    req.end();
  });
}

function makeMarketSellRequest(requestId) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      asset: {
        name: 'XBTUSD',
        exchange: 'kraken',
        balance: 0.001
      },
      to: 'test-address-' + requestId
    });
    
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/kraken/orders/sell/market',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 15000
    }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(result);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${result.message || data}`));
          }
        } catch (error) {
          reject(new Error(`Parse error: ${error.message}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(new Error(`Request ${requestId} failed: ${error.message}`));
    });
    
    req.on('timeout', () => {
      reject(new Error(`Request ${requestId} timed out`));
    });
    
    req.write(postData);
    req.end();
  });
}

testRealConcurrentRequests();
