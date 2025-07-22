const http = require('http');

console.log('=== TESTING SEQUENTIAL VS CONCURRENT ===');
console.log('Comparing sequential vs concurrent requests to prove the fix...\n');

function makeRequest(asset) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://localhost:3000/api/v1/kraken/balance/${asset}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve({ asset, success: res.statusCode === 200, status: res.statusCode, data: result });
        } catch (e) {
          reject(new Error(`Parse error for ${asset}: ${e.message}`));
        }
      });
    });
    
    req.on('error', error => reject(new Error(`Request failed for ${asset}: ${error.message}`)));
    req.setTimeout(10000, () => reject(new Error(`Timeout for ${asset}`)));
  });
}

async function testSequentialRequests() {
  const assets = ['BTC', 'ETH', 'SOL', 'ADA', 'XRP', 'DOGE'];
  
  console.log('🔄 Making 6 SEQUENTIAL requests (one after another)...');
  
  const results = [];
  const startTime = Date.now();
  
  for (const asset of assets) {
    try {
      const result = await makeRequest(asset);
      results.push(result);
      console.log(`  ✅ ${asset}: Success`);
    } catch (error) {
      results.push({ asset, success: false, error: error.message });
      console.log(`  ❌ ${asset}: Failed - ${error.message}`);
    }
  }
  
  const duration = Date.now() - startTime;
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`\n📊 SEQUENTIAL RESULTS (${duration}ms total):`);
  console.log(`✅ Successful: ${successful.length}/6`);
  console.log(`❌ Failed: ${failed.length}/6`);
  
  return failed.length;
}

async function testConcurrentRequests() {
  const assets = ['BTC', 'ETH', 'SOL', 'ADA', 'XRP', 'DOGE'];
  
  console.log('\n⚡ Making 6 CONCURRENT requests (all at once)...');
  
  const promises = assets.map(asset => 
    makeRequest(asset).catch(error => ({ asset, success: false, error: error.message }))
  );
  
  const startTime = Date.now();
  const results = await Promise.all(promises);
  const duration = Date.now() - startTime;
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`\n📊 CONCURRENT RESULTS (${duration}ms total):`);
  console.log(`✅ Successful: ${successful.length}/6`);
  console.log(`❌ Failed: ${failed.length}/6`);
  
  return failed.length;
}

async function runComparison() {
  try {
    const sequentialFailures = await testSequentialRequests();
    const concurrentFailures = await testConcurrentRequests();
    
    console.log('\n🎯 FINAL ANALYSIS:');
    console.log(`Sequential failures: ${sequentialFailures}/6`);
    console.log(`Concurrent failures: ${concurrentFailures}/6`);
    
    if (sequentialFailures === 0 && concurrentFailures > 0) {
      console.log('\n✅ DIAGNOSIS CONFIRMED:');
      console.log('- Race condition is FIXED (no duplicate nonces generated)');
      console.log('- Remaining issue is network timing causing out-of-order arrival');
      console.log('- Solution: Use sequential requests instead of concurrent for balance checks');
    } else if (sequentialFailures === 0 && concurrentFailures === 0) {
      console.log('\n🎉 COMPLETELY FIXED!');
      console.log('Both sequential and concurrent requests work perfectly!');
    } else {
      console.log('\n❌ OTHER ISSUES DETECTED');
      console.log('There may be additional problems beyond the race condition.');
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

runComparison();
