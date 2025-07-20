#!/usr/bin/env node

// Simple direct test of the exact balance fetching scenario
const http = require('http');

console.log('=== BALANCE FETCHING CONCURRENCY TEST ===');
console.log('Testing 12 concurrent balance requests (your exact use case)...\n');

async function testBalanceConcurrency() {
  try {
    console.log('🎯 Making 12 concurrent GET requests to /api/v1/kraken/balance/BTC');
    
    const promises = Array.from({ length: 12 }, (_, i) => 
      makeBalanceRequest(i + 1)
        .then(result => ({ requestId: i + 1, success: true, nonce: extractNonce(result) }))
        .catch(error => ({ requestId: i + 1, success: false, error: error.message }))
    );
    
    const startTime = Date.now();
    const results = await Promise.all(promises);
    const duration = Date.now() - startTime;
    
    console.log(`\n📊 RESULTS (${duration}ms total):`);
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`✅ Successful: ${successful.length}/12`);
    console.log(`❌ Failed: ${failed.length}/12`);
    
    if (failed.length > 0) {
      console.log('\n🚨 FAILURES:');
      failed.forEach(f => {
        console.log(`  Request ${f.requestId}: ${f.error}`);
      });
      
      const nonceErrors = failed.filter(f => 
        f.error.toLowerCase().includes('nonce') || 
        f.error.toLowerCase().includes('invalid')
      );
      
      if (nonceErrors.length > 0) {
        console.log(`\n💥 NONCE ERRORS: ${nonceErrors.length}/12`);
        console.log('This is the race condition causing your production issues!');
      }
    }
    
    if (successful.length > 0) {
      const nonces = successful.filter(s => s.nonce).map(s => s.nonce);
      if (nonces.length > 0) {
        console.log('\n🔢 Generated nonces:');
        nonces.forEach((nonce, i) => console.log(`  ${nonce}`));
        
        // Check for duplicates
        const duplicates = nonces.filter((nonce, index) => nonces.indexOf(nonce) !== index);
        if (duplicates.length > 0) {
          console.log(`\n❌ DUPLICATE NONCES: ${duplicates.join(', ')}`);
        }
      }
    }
    
    console.log('\n🎯 ANALYSIS:');
    if (failed.length === 0) {
      console.log('✅ All requests succeeded - race condition may be resolved');
    } else {
      const ratio = (failed.length / 12 * 100).toFixed(1);
      console.log(`❌ ${ratio}% failure rate - this matches your ~1/3 failure description`);
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

function makeBalanceRequest(requestId) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/kraken/balance/BTC',
      method: 'GET',
      timeout: 10000
    }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const result = JSON.parse(data);
            resolve(result);
          } else {
            const error = JSON.parse(data);
            reject(new Error(error.message || `HTTP ${res.statusCode}`));
          }
        } catch (error) {
          reject(new Error(`Parse error: ${error.message} - Data: ${data}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(new Error(`Request ${requestId} failed: ${error.message}`));
    });
    
    req.on('timeout', () => {
      reject(new Error(`Request ${requestId} timed out`));
    });
    
    req.end();
  });
}

function extractNonce(result) {
  // Try to extract nonce from response if available
  // This is just for debugging - the nonce is used internally
  return result.nonce || 'N/A';
}

testBalanceConcurrency();
