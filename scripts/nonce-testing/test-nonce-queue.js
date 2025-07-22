#!/usr/bin/env node

/**
 * Test script to compare queued vs atomic nonce generation
 * This helps verify that queuing improves nonce ordering
 */

console.log('=== NONCE GENERATION STRATEGY COMPARISON ===\n');

async function testNonceStrategies() {
  try {
    // Dynamic import for ES modules
    const { container } = await import('./dist/container.js');
    const { configureDI, initializeServices } = await import('./dist/container.js');
    
    // Configure dependency injection
    configureDI();
    await initializeServices();
    
    const krakenService = container.resolve('KrakenApiService');
    console.log('✅ Kraken service resolved successfully\n');
    
    // Test asset for balance check
    const testAsset = {
      name: 'BTC',
      exchange: 'kraken'
    };
    
    console.log('🧪 Testing Queued Nonce Generation Strategy...');
    console.log('This approach processes nonce requests sequentially to ensure strict ordering.\n');
    
    // Run the queued test
    const queuedResults = await runNonceTest(krakenService, testAsset, 'QUEUED', 8);
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    // Clear any state between tests
    console.log('🧹 Clearing nonce queues between tests...\n');
    
    // Test with higher concurrency to see queue benefits
    console.log('🧪 Testing Higher Concurrency (12 requests)...');
    console.log('This tests the queue under higher load.\n');
    
    const highConcurrencyResults = await runNonceTest(krakenService, testAsset, 'HIGH_CONCURRENCY', 12);
    
    // Summary comparison
    console.log('\n' + '='.repeat(60));
    console.log('📊 STRATEGY COMPARISON SUMMARY');
    console.log('='.repeat(60));
    
    printTestSummary('Queued (8 requests)', queuedResults);
    printTestSummary('High Concurrency (12 requests)', highConcurrencyResults);
    
    console.log('\n💡 ANALYSIS:');
    
    if (queuedResults.nonceErrors === 0 && highConcurrencyResults.nonceErrors === 0) {
      console.log('🎉 Excellent! Both tests passed with 0 nonce errors.');
      console.log('   The queued approach appears to be working correctly.');
    } else {
      console.log('⚠️  Some nonce errors detected:');
      if (queuedResults.nonceErrors > 0) {
        console.log(`   - Standard test: ${queuedResults.nonceErrors} nonce errors`);
      }
      if (highConcurrencyResults.nonceErrors > 0) {
        console.log(`   - High concurrency: ${highConcurrencyResults.nonceErrors} nonce errors`);
      }
      console.log('   Review the detailed logs above for root cause analysis.');
    }
    
    console.log('\n🔍 Key metrics to watch in the logs:');
    console.log('   - [QUEUE] messages show request queuing behavior');
    console.log('   - [NONCE] messages show atomic generation details');
    console.log('   - "(QUEUED)" in success messages confirms queue processing');
    console.log('   - Time differences between request initiation and completion');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('\nTroubleshooting:');
    console.error('1. Build the project: npm run build');
    console.error('2. Check dependencies: npm install');
    console.error('3. Verify environment: check .env file');
  }
}

async function runNonceTest(krakenService, testAsset, testName, requestCount) {
  console.log(`🚀 Starting ${testName} test with ${requestCount} concurrent requests...`);
  
  const startTime = Date.now();
  const requests = [];
  
  // Launch all requests concurrently
  for (let i = 0; i < requestCount; i++) {
    const requestStartTime = Date.now();
    const request = krakenService.fetchBalance(testAsset)
      .then(balance => {
        const duration = Date.now() - requestStartTime;
        console.log(`  ✅ Request ${i + 1} succeeded in ${duration}ms: Balance = ${balance}`);
        return { success: true, balance, requestId: i + 1, duration };
      })
      .catch(error => {
        const duration = Date.now() - requestStartTime;
        console.error(`  ❌ Request ${i + 1} failed in ${duration}ms:`, error.message);
        return { success: false, error: error.message, requestId: i + 1, duration };
      });
    
    requests.push(request);
  }
  
  console.log(`⏳ Waiting for ${requestCount} requests to complete...\n`);
  
  // Wait for all requests
  const results = await Promise.all(requests);
  const totalDuration = Date.now() - startTime;
  
  // Analyze results
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const nonceErrors = failed.filter(r => r.error.toLowerCase().includes('nonce')).length;
  
  console.log(`\n📋 ${testName} Results:`);
  console.log(`   Total time: ${totalDuration}ms`);
  console.log(`   Successful: ${successful.length}/${requestCount}`);
  console.log(`   Failed: ${failed.length}/${requestCount}`);
  console.log(`   Nonce errors: ${nonceErrors}`);
  console.log(`   Success rate: ${((successful.length / requestCount) * 100).toFixed(1)}%`);
  
  if (successful.length > 0) {
    const avgDuration = successful.reduce((sum, r) => sum + r.duration, 0) / successful.length;
    const minDuration = Math.min(...successful.map(r => r.duration));
    const maxDuration = Math.max(...successful.map(r => r.duration));
    console.log(`   Avg request time: ${avgDuration.toFixed(1)}ms`);
    console.log(`   Request time range: ${minDuration}ms - ${maxDuration}ms`);
  }
  
  if (failed.length > 0) {
    console.log(`\n   Failed requests:`);
    failed.forEach(result => {
      const isNonceError = result.error.toLowerCase().includes('nonce');
      const errorType = isNonceError ? '[NONCE]' : '[OTHER]';
      console.log(`     ${errorType} Request ${result.requestId}: ${result.error}`);
    });
  }
  
  return {
    testName,
    requestCount,
    totalDuration,
    successful: successful.length,
    failed: failed.length,
    nonceErrors,
    successRate: (successful.length / requestCount) * 100,
    avgDuration: successful.length > 0 ? successful.reduce((sum, r) => sum + r.duration, 0) / successful.length : 0
  };
}

function printTestSummary(testName, results) {
  console.log(`\n${testName}:`);
  console.log(`  Success Rate: ${results.successRate.toFixed(1)}%`);
  console.log(`  Nonce Errors: ${results.nonceErrors}`);
  console.log(`  Avg Duration: ${results.avgDuration.toFixed(1)}ms`);
  console.log(`  Total Time: ${results.totalDuration}ms`);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted by user');
  process.exit(0);
});

console.log('Starting nonce strategy comparison...\n');
testNonceStrategies().catch(error => {
  console.error('🚨 Unexpected error:', error);
  process.exit(1);
});
