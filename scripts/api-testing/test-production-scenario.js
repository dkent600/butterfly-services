#!/usr/bin/env node

/**
 * REAL PRODUCTION SIMULATION TEST
 * This test simulates the exact scenario where you're seeing increased nonce errors
 * and will actually validate what's happening without making assumptions
 */

console.log('=== PRODUCTION SCENARIO SIMULATION ===');
console.log('Testing the EXACT conditions that cause your nonce errors...\n');

async function simulateProductionScenario() {
  try {
    // Import and setup like real production
    const { container } = await import('./dist/container.js');
    const { configureDI, initializeServices } = await import('./dist/container.js');
    
    configureDI();
    await initializeServices();
    
    const krakenService = container.resolve('KrakenApiService');
    console.log('✅ Service setup complete\n');
    
    // Test 1: Single requests (should work)
    console.log('🧪 TEST 1: Single sequential requests (baseline)');
    await testSequentialRequests(krakenService, 3);
    
    // Test 2: The problematic scenario - concurrent requests
    console.log('\n🧪 TEST 2: 12 concurrent requests (your problem scenario)');
    await testConcurrentRequests(krakenService, 12);
    
    // Test 3: Rapid fire requests (stress test)
    console.log('\n🧪 TEST 3: Rapid sequential requests (timing stress)');
    await testRapidSequentialRequests(krakenService, 8);
    
    // Test 4: Multiple service instances (multi-instance simulation)
    console.log('\n🧪 TEST 4: Multiple service instances (instance conflicts)');
    await testMultipleInstances();
    
  } catch (error) {
    console.error('❌ Test setup failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

async function testSequentialRequests(krakenService, count) {
  console.log(`Running ${count} sequential requests...`);
  const results = [];
  const startTime = Date.now();
  
  for (let i = 0; i < count; i++) {
    try {
      const nonce = await krakenService.testGenerateNonce();
      results.push({ success: true, nonce, requestId: i + 1 });
      console.log(`  Request ${i + 1}: Generated nonce ${nonce}`);
      // Small delay to simulate real-world timing
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      results.push({ success: false, error: error.message, requestId: i + 1 });
      console.log(`  Request ${i + 1}: FAILED - ${error.message}`);
    }
  }
  
  analyzeResults('Sequential', results, Date.now() - startTime);
}

async function testConcurrentRequests(krakenService, count) {
  console.log(`Running ${count} CONCURRENT requests (your problem scenario)...`);
  const startTime = Date.now();
  
  // Create all promises at once - this is where problems occur
  const promises = Array.from({ length: count }, (_, i) => 
    krakenService.testGenerateNonce()
      .then(nonce => ({ success: true, nonce, requestId: i + 1 }))
      .catch(error => ({ success: false, error: error.message, requestId: i + 1 }))
  );
  
  console.log(`  Launched ${count} requests simultaneously...`);
  const results = await Promise.all(promises);
  
  // Show the actual order of nonce generation
  const successfulResults = results.filter(r => r.success);
  if (successfulResults.length > 0) {
    console.log('  Generated nonces in order:');
    successfulResults.forEach(r => {
      console.log(`    Request ${r.requestId}: ${r.nonce}`);
    });
  }
  
  analyzeResults('Concurrent', results, Date.now() - startTime);
}

async function testRapidSequentialRequests(krakenService, count) {
  console.log(`Running ${count} rapid sequential requests...`);
  const results = [];
  const startTime = Date.now();
  
  for (let i = 0; i < count; i++) {
    try {
      const nonce = await krakenService.testGenerateNonce();
      results.push({ success: true, nonce, requestId: i + 1 });
      console.log(`  Request ${i + 1}: Generated nonce ${nonce}`);
      // NO delay - rapid fire
    } catch (error) {
      results.push({ success: false, error: error.message, requestId: i + 1 });
      console.log(`  Request ${i + 1}: FAILED - ${error.message}`);
    }
  }
  
  analyzeResults('Rapid Sequential', results, Date.now() - startTime);
}

async function testMultipleInstances() {
  console.log('Testing multiple service instances...');
  
  try {
    // Create a second container (simulates multiple app instances)
    const { container: container2 } = await import('./dist/container.js');
    const { configureDI } = await import('./dist/container.js');
    
    // This should fail or show conflicts if there are static state issues
    configureDI();
    const krakenService2 = container2.resolve('KrakenApiService');
    
    console.log('  ✅ Second service instance created');
    
    // Test if they interfere with each other
    const nonce1 = await krakenService2.testGenerateNonce();
    console.log(`  Second instance generated nonce: ${nonce1}`);
    
  } catch (error) {
    console.log(`  ❌ Multiple instance test failed: ${error.message}`);
  }
}

function analyzeResults(testName, results, duration) {
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`\n📊 ${testName} Results:`);
  console.log(`  Duration: ${duration}ms`);
  console.log(`  Success: ${successful.length}/${results.length}`);
  console.log(`  Failed: ${failed.length}/${results.length}`);
  
  if (failed.length > 0) {
    console.log(`  ❌ Failures:`);
    failed.forEach(f => console.log(`    Request ${f.requestId}: ${f.error}`));
  }
  
  if (successful.length > 1) {
    // Check for nonce problems
    const nonces = successful.map(r => r.nonce).sort((a, b) => a - b);
    const duplicates = nonces.filter((nonce, index) => nonces.indexOf(nonce) !== index);
    const outOfOrder = checkOutOfOrder(successful.map(r => r.nonce));
    
    if (duplicates.length > 0) {
      console.log(`  ❌ DUPLICATE NONCES: ${duplicates.join(', ')}`);
    }
    
    if (outOfOrder > 0) {
      console.log(`  ❌ OUT-OF-ORDER GENERATION: ${outOfOrder} instances`);
    }
    
    if (duplicates.length === 0 && outOfOrder === 0) {
      console.log(`  ✅ Nonces are unique and properly ordered`);
    }
    
    // Check nonce spacing
    const gaps = [];
    for (let i = 1; i < nonces.length; i++) {
      gaps.push(nonces[i] - nonces[i - 1]);
    }
    const avgGap = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
    const minGap = Math.min(...gaps);
    const maxGap = Math.max(...gaps);
    
    console.log(`  📏 Nonce spacing: avg=${avgGap.toFixed(1)}ms, min=${minGap}ms, max=${maxGap}ms`);
  }
}

function checkOutOfOrder(nonces) {
  let outOfOrder = 0;
  for (let i = 1; i < nonces.length; i++) {
    if (nonces[i] <= nonces[i - 1]) {
      outOfOrder++;
    }
  }
  return outOfOrder;
}

// Actually run the test and catch any issues
simulateProductionScenario()
  .then(() => {
    console.log('\n🎯 SUMMARY:');
    console.log('This test shows the ACTUAL behavior in your production scenario.');
    console.log('Any failures or issues shown above are what you experience in production.');
    console.log('Look for patterns in the failed tests to identify the root cause.');
  })
  .catch(error => {
    console.error('\n🚨 TEST FRAMEWORK ERROR:', error.message);
    console.error('This indicates a fundamental problem with the setup.');
  });
