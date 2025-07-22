#!/usr/bin/env node

/**
 * Enhanced debug script to test nonce generation and identify issues
 * Run this to simulate the concurrent request scenario and capture detailed logs
 */

const { setTimeout } = require('timers/promises');

async function simulateConcurrentRequests() {
  console.log('=== ENHANCED NONCE DEBUG SIMULATION ===');
  console.log('This script simulates concurrent API requests to help debug nonce issues.');
  console.log('Monitor the console output for detailed nonce generation logs.\n');

  try {
    // Dynamic import for ES modules
    const { container } = await import('./dist/container.js');
    const { TYPES } = await import('./dist/types/interfaces.js');
    
    const krakenService = container.resolve(TYPES.IKrakenApiService);
    console.log('✅ Kraken service resolved successfully\n');
    
    // Test asset for balance check
    const testAsset = {
      name: 'BTC',
      exchange: 'kraken'
    };
    
    console.log('🚀 Starting concurrent request simulation...');
    console.log(`Testing with ${testAsset.name} on ${testAsset.exchange}\n`);
    
    // Create multiple concurrent requests to trigger nonce conflicts
    const requestCount = 12;
    const requests = [];
    
    console.log('📊 Launching requests with detailed timing...\n');
    
    for (let i = 0; i < requestCount; i++) {
      const startTime = Date.now();
      const request = krakenService.fetchBalance(testAsset)
        .then(balance => {
          const duration = Date.now() - startTime;
          console.log(`✅ Request ${i + 1} succeeded in ${duration}ms: Balance = ${balance}`);
          return { success: true, balance, requestId: i + 1, duration };
        })
        .catch(error => {
          const duration = Date.now() - startTime;
          console.error(`❌ Request ${i + 1} failed in ${duration}ms:`, error.message);
          return { success: false, error: error.message, requestId: i + 1, duration };
        });
      
      requests.push(request);
    }
    
    console.log(`Launched ${requestCount} concurrent requests...\n`);
    
    // Wait for all requests to complete
    const results = await Promise.all(requests);
    
    // Analyze results
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log('\n=== DETAILED RESULTS ANALYSIS ===');
    console.log(`Total requests: ${requestCount}`);
    console.log(`Successful: ${successful.length}`);
    console.log(`Failed: ${failed.length}`);
    console.log(`Success rate: ${((successful.length / requestCount) * 100).toFixed(1)}%`);
    
    if (successful.length > 0) {
      const avgDuration = successful.reduce((sum, r) => sum + r.duration, 0) / successful.length;
      console.log(`Average successful request duration: ${avgDuration.toFixed(1)}ms`);
    }
    
    if (failed.length > 0) {
      console.log('\n=== FAILED REQUESTS ANALYSIS ===');
      failed.forEach(result => {
        console.log(`Request ${result.requestId} (${result.duration}ms): ${result.error}`);
      });
      
      const nonceErrors = failed.filter(r => r.error.toLowerCase().includes('nonce'));
      const authErrors = failed.filter(r => r.error.toLowerCase().includes('auth') || r.error.toLowerCase().includes('key'));
      const networkErrors = failed.filter(r => r.error.toLowerCase().includes('network') || r.error.toLowerCase().includes('timeout'));
      
      console.log(`\nError breakdown:`);
      console.log(`  Nonce-related: ${nonceErrors.length}`);
      console.log(`  Authentication: ${authErrors.length}`);
      console.log(`  Network/Timeout: ${networkErrors.length}`);
      console.log(`  Other: ${failed.length - nonceErrors.length - authErrors.length - networkErrors.length}`);
    }
    
    console.log('\n=== DIAGNOSTIC RECOMMENDATIONS ===');
    
    if (failed.length === 0) {
      console.log('🎉 All requests succeeded! The nonce generation appears to be working correctly.');
      console.log('💡 If you\'re still seeing issues in production, they may be:');
      console.log('   - Environment-specific (different server time sync)');
      console.log('   - Load-related (higher concurrency than this test)');
      console.log('   - API key specific (different nonce requirements per key)');
    } else {
      const nonceErrorCount = failed.filter(r => r.error.toLowerCase().includes('nonce')).length;
      
      if (nonceErrorCount > 0) {
        console.log('⚠️  Nonce errors detected. Review the enhanced logs above for:');
        console.log('   - Atomic nonce generation timing');
        console.log('   - Server time synchronization status');
        console.log('   - Global nonce reference consistency');
        console.log('   - Time difference warnings');
        console.log('\n💡 Potential fixes to try:');
        console.log('   1. Increase the buffer time in nonce initialization');
        console.log('   2. Check if API key has been used recently with higher nonces');
        console.log('   3. Verify server time synchronization is working');
        console.log('   4. Consider implementing a delay between requests');
      } else {
        console.log('ℹ️  Non-nonce related errors detected. Check:');
        console.log('   - API credentials are correct and active');
        console.log('   - Network connectivity is stable');
        console.log('   - Account permissions for balance requests');
      }
    }
    
    console.log('\n=== NEXT STEPS ===');
    console.log('1. Review the detailed logs above for patterns');
    console.log('2. If nonce errors persist, increase the buffer in KrakenApiService constructor');
    console.log('3. Consider adding artificial delays between requests if needed');
    console.log('4. Test with different request counts to find the breaking point');
    
  } catch (error) {
    console.error('❌ Failed to run debug simulation:', error);
    console.error('\nTroubleshooting:');
    console.error('1. Make sure the project is built: npm run build');
    console.error('2. Check that all dependencies are installed: npm install');
    console.error('3. Verify environment variables are set correctly');
    console.error('4. Ensure API credentials are valid');
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Debug simulation interrupted by user');
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

console.log('Starting enhanced nonce debugging...\n');
simulateConcurrentRequests().catch(error => {
  console.error('🚨 Unexpected error:', error);
  process.exit(1);
});
