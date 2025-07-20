import fetch from 'node-fetch';

console.log('=== TESTING FIXED NONCE GENERATION ===');
console.log('Testing 6 concurrent balance requests to verify race condition is fixed...\n');

async function testConcurrentBalanceRequests() {
  const assets = ['BTC', 'ETH', 'SOL', 'ADA', 'XRP', 'DOGE'];
  
  console.log('🚀 Making 6 concurrent balance requests...');
  
  const promises = assets.map((asset, i) => 
    fetch(`http://localhost:3000/api/v1/kraken/balance/${asset}`)
      .then(async response => {
        const data = await response.json();
        return { 
          requestId: i + 1, 
          asset, 
          success: response.ok, 
          status: response.status,
          data: response.ok ? data : data.message
        };
      })
      .catch(error => ({ 
        requestId: i + 1, 
        asset, 
        success: false, 
        error: error.message 
      }))
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
      console.log(`  ${f.asset}: ${f.error || f.data}`);
    });
    
    const nonceErrors = failed.filter(f => 
      (f.error && f.error.toLowerCase().includes('nonce')) ||
      (f.data && f.data.toLowerCase().includes('nonce'))
    );
    
    if (nonceErrors.length > 0) {
      console.log(`\n💥 NONCE ERRORS: ${nonceErrors.length}/6`);
      console.log('❌ Race condition still exists!');
    } else {
      console.log('\n✅ No nonce errors detected');
    }
  }
  
  if (successful.length > 0) {
    console.log('\n✅ Successful requests:');
    successful.forEach(s => {
      console.log(`  ${s.asset}: Balance = ${s.data.balance}`);
    });
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
