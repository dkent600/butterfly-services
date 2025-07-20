#!/usr/bin/env node

/**
 * REAL CONCURRENT API TEST
 * This simulates your exact client scenario: 12 concurrent API requests to butterfly-services
 */

console.log('=== REAL CLIENT SCENARIO TEST ===');
console.log('Simulating 12 concurrent requests from batch-ta client...\n');

const http = require('http');

async function testRealConcurrentRequests() {
  try {
    console.log('🎯 Testing the EXACT scenario where your client fails...');
    console.log('This will show if the API can handle 12 concurrent requests properly.\n');
    
    // Start the API server first (if not running)
    console.log('📡 Making sure API server is available...');
    
    // Test if server is running by making a test request
    const testResponse = await makeTestRequest();
    if (!testResponse) {
      console.log('❌ API server not running. Please start it first with: npm start');
      return;
    }
    
    console.log('✅ API server is running\n');
    
    // Now simulate 12 concurrent requests (like your batch-ta client)
    console.log('🚀 Sending 12 concurrent requests to /api/exchanges/kraken...');
    
    const promises = Array.from({ length: 12 }, (_, i) => 
      makeKrakenRequest(i + 1)
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
      const nonceErrors = failed.filter(f => f.error.includes('nonce') || f.error.includes('Invalid'));
      if (nonceErrors.length > 0) {
        console.log(`\n💥 ${nonceErrors.length} requests failed with NONCE ERRORS`);
        console.log('This confirms the race condition in nonce generation!');
      }
    }
    
    if (successful.length > 0) {
      console.log('\n✅ Successful requests:');
      successful.forEach(s => {
        if (s.nonce) {
          console.log(`  Request ${s.requestId}: Generated nonce ${s.nonce}`);
        }
      });
      
      // Check for duplicate nonces
      const nonces = successful.filter(s => s.nonce).map(s => s.nonce);
      const duplicates = nonces.filter((nonce, index) => nonces.indexOf(nonce) !== index);
      
      if (duplicates.length > 0) {
        console.log(`\n❌ DUPLICATE NONCES DETECTED: ${duplicates.join(', ')}`);
        console.log('This proves the atomic nonce generation is failing!');
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

function makeTestRequest() {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/exchanges',
      method: 'GET',
      timeout: 5000
    }, (res) => {
      resolve(true);
    });
    
    req.on('error', () => resolve(false));
    req.on('timeout', () => resolve(false));
    req.end();
  });
}

function makeKrakenRequest(requestId) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      asset: 'XBTUSD', // Example asset
      // Any other data your API expects
    });
    
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/exchanges/kraken',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 10000
    }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const result = JSON.parse(data);
            resolve(result);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
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
