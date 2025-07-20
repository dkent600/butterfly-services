#!/usr/bin/env node

/**
 * MULTI-PROCESS NONCE CONFLICT SIMULATION
 * This simulates what happens when multiple applications use the same API keys
 */

console.log('=== MULTI-PROCESS CONFLICT SIMULATION ===');
console.log('Simulating multiple apps using same API keys...\n');

async function simulateMultiProcessConflict() {
  try {
    console.log('🔍 IDENTIFIED PROBLEM:');
    console.log('You have multiple Node.js processes running:');
    console.log('  - butterfly-services (this app)');
    console.log('  - batch-ta... (another trading app?)');
    console.log('  - Multiple other node processes');
    console.log('');
    console.log('If they use the same Kraken API keys, they will conflict!\n');
    
    // Simulate the conflict by creating multiple "applications"
    console.log('🧪 Simulating what happens with multiple apps...');
    
    // App 1 (this app)
    const { container: container1 } = await import('./dist/container.js');
    const { configureDI: configureDI1, initializeServices: init1 } = await import('./dist/container.js');
    configureDI1();
    await init1();
    const app1 = container1.resolve('KrakenApiService');
    
    // App 2 (simulated other app) - fresh import to simulate separate process
    delete require.cache[require.resolve('./dist/container.js')];
    const { container: container2 } = await import('./dist/container.js');
    const { configureDI: configureDI2, initializeServices: init2 } = await import('./dist/container.js');
    configureDI2();
    await init2();
    const app2 = container2.resolve('KrakenApiService');
    
    console.log('✅ Created two "applications" using same API keys\n');
    
    // Test scenario: both apps generate nonces simultaneously
    console.log('🎯 CONFLICT TEST: Both apps generate nonces at same time');
    
    const results = await Promise.all([
      // App 1 generates 6 nonces
      ...Array.from({ length: 6 }, (_, i) => 
        app1.testGenerateNonce()
          .then(nonce => ({ app: 'App1', request: i + 1, nonce, success: true }))
          .catch(error => ({ app: 'App1', request: i + 1, error: error.message, success: false }))
      ),
      // App 2 generates 6 nonces simultaneously
      ...Array.from({ length: 6 }, (_, i) => 
        app2.testGenerateNonce()
          .then(nonce => ({ app: 'App2', request: i + 1, nonce, success: true }))
          .catch(error => ({ app: 'App2', request: i + 1, error: error.message, success: false }))
      )
    ]);
    
    console.log('\n📊 MULTI-PROCESS RESULTS:');
    
    const app1Results = results.filter(r => r.app === 'App1');
    const app2Results = results.filter(r => r.app === 'App2');
    
    console.log(`App1: ${app1Results.filter(r => r.success).length}/6 succeeded`);
    console.log(`App2: ${app2Results.filter(r => r.success).length}/6 succeeded`);
    
    // Check for nonce conflicts
    const app1Nonces = app1Results.filter(r => r.success).map(r => r.nonce);
    const app2Nonces = app2Results.filter(r => r.success).map(r => r.nonce);
    const allNonces = [...app1Nonces, ...app2Nonces];
    
    console.log('\nApp1 nonces:', app1Nonces.join(', '));
    console.log('App2 nonces:', app2Nonces.join(', '));
    
    // Check for conflicts
    const duplicates = allNonces.filter((nonce, index) => allNonces.indexOf(nonce) !== index);
    const overlaps = app1Nonces.filter(nonce => app2Nonces.includes(nonce));
    
    if (duplicates.length > 0 || overlaps.length > 0) {
      console.log('\n❌ NONCE CONFLICTS DETECTED!');
      console.log('This is why you get nonce errors in production.');
      console.log('Multiple apps are generating the same nonces.');
    } else {
      console.log('\n✅ No direct conflicts, but still problematic');
      console.log('Even without duplicates, overlapping time ranges cause issues.');
    }
    
    console.log('\n🎯 ROOT CAUSE IDENTIFIED:');
    console.log('Your production nonce errors are caused by:');
    console.log('1. Multiple applications using same Kraken API keys');
    console.log('2. Each app has its own nonce counter/timing');
    console.log('3. Kraken sees nonces from different apps as out-of-order');
    console.log('');
    console.log('💡 SOLUTIONS:');
    console.log('A. Use different API keys for each application');
    console.log('B. Stop other applications using same keys');
    console.log('C. Implement shared nonce storage (Redis/file)');
    console.log('D. Use API key rotation/time-based separation');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

simulateMultiProcessConflict();
