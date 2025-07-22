const http = require('http');

console.log('=== TESTING FIXED NONCE GENERATION ===');
console.log('Testing 6 concurrent balance requests...\n');

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

async function testConcurrentBalanceRequests() {
  const assets = ['BTC', 'ETH', 'SOL', 'ADA', 'XRP', 'DOGE'];
  
  console.log('🚀 Making 6 concurrent balance requests...');
  
  const promises = assets.map(asset => 
    makeRequest(asset).catch(error => ({ asset, success: false, error: error.message }))
  );
  
  const startTime = Date.now();
  const results = await Promise.all(promises);
  const duration = Date.now() - startTime;
  
  console.log(`\n📊 RESULTS (${duration}ms total):`);
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Successful: ${successful.length}/6`);
  console.log(`❌ Failed: ${failed.length}/6`);
  
  if (failed.length > 0) {
    console.log('\n🚨 FAILURES:');
    failed.forEach(f => {
      console.log(`  ${f.asset}: ${f.error || (f.data && f.data.message) || 'Unknown error'}`);
    });
    
    const nonceErrors = failed.filter(f => 
      (f.error && f.error.toLowerCase().includes('nonce')) ||
      (f.data && f.data.message && f.data.message.toLowerCase().includes('nonce'))
    );
    
    if (nonceErrors.length > 0) {
      console.log(`\n💥 NONCE ERRORS: ${nonceErrors.length}/6`);
      console.log('❌ Race condition still exists!');
    } else {
      console.log('\n✅ No nonce errors detected');
    }
  }
  
  console.log('\n🎯 CONCLUSION:');
  if (failed.length === 0) {
    console.log('🎉 SUCCESS! All concurrent requests completed without errors');
    console.log('The nonce race condition appears to be FIXED!');
  } else {
    const failureRate = (failed.length / 6 * 100).toFixed(1);
    console.log(`❌ ${failureRate}% failure rate - race condition may still exist`);
  }
}

testConcurrentBalanceRequests().catch(console.error);
