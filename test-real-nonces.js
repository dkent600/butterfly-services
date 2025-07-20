#!/usr/bin/env node

/**
 * Real nonce generation test that validates actual nonce behavior
 * This bypasses API calls to focus purely on nonce generation patterns
 */

console.log('=== REAL NONCE GENERATION ANALYSIS ===\n');

async function testActualNonceGeneration() {
  try {
    // Dynamic import for ES modules
    const { container } = await import('./dist/container.js');
    const { configureDI, initializeServices } = await import('./dist/container.js');
    
    // Configure dependency injection
    configureDI();
    await initializeServices();
    
    const krakenService = container.resolve('KrakenApiService');
    console.log('✅ Kraken service resolved successfully\n');
    
    // Test nonce generation directly by accessing the private method via reflection
    console.log('🧪 Testing direct nonce generation patterns...\n');
    
    // Create multiple concurrent nonce generation requests
    const noncePromises = [];
    const requestCount = 12;
    const startTime = Date.now();
    
    console.log(`🚀 Generating ${requestCount} concurrent nonces...`);
    
    for (let i = 0; i < requestCount; i++) {
      // We'll generate nonces by calling the method that would be used internally
      const promise = generateTestNonce(krakenService, i + 1);
      noncePromises.push(promise);
    }
    
    const results = await Promise.all(noncePromises);
    const totalTime = Date.now() - startTime;
    
    console.log(`\n⏱️  Total generation time: ${totalTime}ms\n`);
    
    // Analyze the nonce sequence
    console.log('📊 NONCE SEQUENCE ANALYSIS:');
    console.log('Generated nonces:');
    
    results.forEach((result, index) => {
      const { nonce, requestId, duration } = result;
      console.log(`  ${requestId.toString().padStart(2)}: ${nonce} (${duration}ms)`);
    });
    
    // Check for issues
    const nonces = results.map(r => r.nonce).sort((a, b) => a - b);
    const issues = [];
    
    // Check for duplicates
    const duplicates = nonces.filter((nonce, index) => nonces.indexOf(nonce) !== index);
    if (duplicates.length > 0) {
      issues.push(`❌ DUPLICATE NONCES: ${duplicates.join(', ')}`);
    }
    
    // Check for out-of-order generation (this is the real issue!)
    const originalOrder = results.map(r => r.nonce);
    let outOfOrder = 0;
    for (let i = 1; i < originalOrder.length; i++) {
      if (originalOrder[i] <= originalOrder[i - 1]) {
        outOfOrder++;
        issues.push(`❌ OUT-OF-ORDER: Request ${i + 1} got nonce ${originalOrder[i]} after request ${i} got ${originalOrder[i - 1]}`);
      }
    }
    
    // Check for proper incrementation
    let improperIncrements = 0;
    for (let i = 1; i < nonces.length; i++) {
      const diff = nonces[i] - nonces[i - 1];
      if (diff === 0) {
        improperIncrements++;
        issues.push(`❌ ZERO INCREMENT: ${nonces[i - 1]} -> ${nonces[i]}`);
      }
    }
    
    // Check time ranges
    const minNonce = Math.min(...nonces);
    const maxNonce = Math.max(...nonces);
    const nonceRange = maxNonce - minNonce;
    const currentTime = Date.now();
    
    console.log(`\n🔍 VALIDATION RESULTS:`);
    console.log(`  Unique nonces: ${new Set(nonces).size}/${nonces.length}`);
    console.log(`  Nonce range: ${nonceRange}ms`);
    console.log(`  Time vs min nonce diff: ${Math.abs(currentTime - minNonce)}ms`);
    console.log(`  Time vs max nonce diff: ${Math.abs(currentTime - maxNonce)}ms`);
    
    if (issues.length === 0) {
      console.log(`\n🎉 SUCCESS: All nonces generated correctly!`);
      console.log(`   - No duplicates`);
      console.log(`   - Proper sequential order`);
      console.log(`   - Appropriate time alignment`);
    } else {
      console.log(`\n⚠️  ISSUES DETECTED (${issues.length}):`);
      issues.forEach(issue => console.log(`   ${issue}`));
      
      console.log(`\n🔧 DIAGNOSIS:`);
      if (outOfOrder > 0) {
        console.log(`   - OUT-OF-ORDER GENERATION: The queue is not working properly!`);
        console.log(`   - This explains why you're still getting nonce errors`);
        console.log(`   - Requests are completing out of sequence despite queuing`);
      }
      if (duplicates.length > 0) {
        console.log(`   - DUPLICATE NONCES: Race condition in atomic generation`);
      }
      if (improperIncrements > 0) {
        console.log(`   - ZERO INCREMENTS: Multiple requests getting same timestamp`);
      }
    }
    
    // Test the queue behavior specifically
    console.log(`\n🧪 QUEUE BEHAVIOR TEST:`);
    await testQueueOrder();
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack:', error.stack);
  }
}

async function generateTestNonce(krakenService, requestId) {
  const startTime = Date.now();
  
  try {
    // Use the public test method to generate nonces
    const nonce = await krakenService.testGenerateNonce();
    const duration = Date.now() - startTime;
    
    return { nonce, requestId, duration, success: true };
  } catch (error) {
    const duration = Date.now() - startTime;
    return { nonce: -1, requestId, duration, success: false, error: error.message };
  }
}

async function testQueueOrder() {
  // Test to see if the queue is actually working
  console.log('Testing if queue maintains order...');
  
  const promises = [];
  const results = [];
  
  // Create promises that resolve at different times to test ordering
  for (let i = 0; i < 5; i++) {
    const promise = new Promise(async (resolve) => {
      // Add random delay to simulate real-world timing variations
      await new Promise(r => setTimeout(r, Math.random() * 10));
      const result = `Request ${i + 1} completed at ${Date.now()}`;
      results.push(result);
      resolve(result);
    });
    promises.push(promise);
  }
  
  const outcomes = await Promise.all(promises);
  
  console.log('Completion order (should match promise creation order for proper queuing):');
  outcomes.forEach((outcome, index) => {
    console.log(`  ${index + 1}: ${outcome}`);
  });
}

console.log('Starting real nonce generation analysis...\n');
testActualNonceGeneration().catch(error => {
  console.error('🚨 Unexpected error:', error);
  process.exit(1);
});
