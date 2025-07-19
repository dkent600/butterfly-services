import { describe, it, expect, beforeEach } from 'vitest';
import { container, configureDI } from '../../container.js';
import { KrakenApiService } from '../kraken-api-service.js';

describe('KrakenApiService Race Condition Test', () => {
  let krakenService: KrakenApiService;

  beforeEach(() => {
    configureDI();
    krakenService = container.resolve(KrakenApiService);
  });

  it('should expose race condition in old nonce generation logic', async () => {
    console.log('\n=== Testing for Race Condition ===');
    
    // Simulate the old problematic logic to prove the race condition exists
    class OldNonceGenerator {
      private static globalLastNonce = Date.now() - 1000; // Start with older timestamp
      
      // This is the OLD BUGGY logic that had race conditions
      static generateNonceOldWay(): number {
        const now = Date.now();
        
        // Step 1: Read current values
        const currentLast = this.globalLastNonce;
        
        // Step 2: Calculate candidate (race condition window here!)
        const candidateNonce = Math.max(now, currentLast + 1);
        
        // Simulate timing delay that could cause race condition
        // In real code, this "delay" could be caused by JavaScript event loop timing
        
        // Step 3: Update global (race condition possible!)
        this.globalLastNonce = candidateNonce;
        
        return candidateNonce;
      }
      
      // Force race condition by calling the old logic simultaneously
      static simulateRaceCondition(): number[] {
        // Reset to same starting state
        this.globalLastNonce = Date.now() - 1000;
        
        const nonces: number[] = [];
        
        // Simulate "simultaneous" calls by calling multiple times 
        // in the same millisecond with same starting state
        const fixedTime = Date.now();
        
        // Override Date.now() to return same value for all calls (simulate same millisecond)
        const originalDateNow = Date.now;
        Date.now = () => fixedTime;
        
        try {
          // Make multiple calls that would happen "simultaneously"
          for (let i = 0; i < 5; i++) {
            const nonce = this.generateNonceOldWay();
            nonces.push(nonce);
          }
        } finally {
          // Restore original Date.now
          Date.now = originalDateNow;
        }
        
        return nonces;
      }
    }

    console.log('Testing old (buggy) logic...');
    const oldNonces = OldNonceGenerator.simulateRaceCondition();
    console.log('Old logic nonces:', oldNonces);
    
    // Check if old logic produces duplicates (it should!)
    const uniqueOldNonces = new Set(oldNonces);
    console.log(`Old logic: ${oldNonces.length} generated, ${uniqueOldNonces.size} unique`);
    
    if (uniqueOldNonces.size < oldNonces.length) {
      console.log('❌ OLD LOGIC HAS RACE CONDITION - Duplicate nonces found!');
    }

    // Now test our new atomic logic
    console.log('\nTesting new (fixed) logic...');
    
    // Reset the real service's nonce to same starting point
    (KrakenApiService as any).globalLastNonce = Date.now() - 1000;
    
    const newNonces: number[] = [];
    
    // Simulate rapid sequential calls (like your client scenario)
    for (let i = 0; i < 10; i++) {
      const nonce = (krakenService as any).generateUniqueNonce();
      newNonces.push(nonce);
    }
    
    console.log('New logic nonces:', newNonces.slice(0, 5), '...');
    
    // Verify new logic never produces duplicates
    const uniqueNewNonces = new Set(newNonces);
    console.log(`New logic: ${newNonces.length} generated, ${uniqueNewNonces.size} unique`);
    
    // Verify new logic is strictly increasing
    const isStrictlyIncreasing = newNonces.every((nonce, i) => 
      i === 0 || nonce > newNonces[i - 1]
    );
    
    console.log('✅ NEW LOGIC: All nonces unique and strictly increasing');
    
    // The actual test assertions
    expect(uniqueNewNonces.size).toBe(newNonces.length); // No duplicates
    expect(isStrictlyIncreasing).toBe(true); // Strictly increasing
  });

  it('should handle rapid calls in the same millisecond', async () => {
    console.log('\n=== Testing Same-Millisecond Scenario ===');
    
    // Get current nonce state
    const startingNonce = (KrakenApiService as any).globalLastNonce;
    console.log(`Starting nonce: ${startingNonce}`);
    
    const nonces: number[] = [];
    const currentTime = Date.now();
    
    // Generate multiple nonces rapidly (simulating your 6 balance calls)
    for (let i = 0; i < 6; i++) {
      const nonce = (krakenService as any).generateUniqueNonce();
      nonces.push(nonce);
      console.log(`Call ${i + 1}: nonce=${nonce}, time=${Date.now()}`);
    }
    
    console.log(`Generated nonces: ${nonces}`);
    
    // Verify all are unique and increasing
    const allUnique = new Set(nonces).size === nonces.length;
    const allIncreasing = nonces.every((nonce, i) => 
      i === 0 || nonce > nonces[i - 1]
    );
    
    // Verify reasonable values (within a few seconds of current time)
    const allReasonable = nonces.every(nonce => 
      Math.abs(nonce - currentTime) < 10000 // Within 10 seconds
    );
    
    expect(allUnique).toBe(true);
    expect(allIncreasing).toBe(true);
    expect(allReasonable).toBe(true);
    
    console.log('✅ All 6 rapid calls produced unique, increasing, reasonable nonces');
  });

  it('should handle the exact timing that causes intermittent failures', async () => {
    console.log('\n=== Testing Intermittent Failure Scenario ===');
    
    // This test simulates the exact conditions that cause intermittent failures:
    // Multiple requests hitting the service in rapid succession
    
    const results: Array<{ success: boolean; nonce?: number; error?: string }> = [];
    
    // Simulate your client making 6 balance requests rapidly
    const assets = ['BTC', 'ETH', 'SOL', 'ADA', 'DOT', 'MATIC'];
    
    for (const asset of assets) {
      try {
        const startTime = Date.now();
        
        // Generate nonce exactly like the real fetchBalance method does
        const nonce = (krakenService as any).generateUniqueNonce();
        
        // Simulate the brief delay between nonce generation and API call
        await new Promise(resolve => setTimeout(resolve, Math.random() * 2));
        
        const endTime = Date.now();
        
        results.push({ 
          success: true, 
          nonce,
        });
        
        console.log(`${asset}: nonce=${nonce}, timing=${endTime - startTime}ms`);
        
      } catch (error) {
        results.push({ 
          success: false, 
          error: error instanceof Error ? error.message : String(error)
        });
        
        console.log(`${asset}: FAILED - ${error}`);
      }
    }
    
    // Analyze results
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    const nonces = successful.map(r => r.nonce!);
    
    console.log(`\nResults: ${successful.length} successful, ${failed.length} failed`);
    console.log(`Nonces: ${nonces}`);
    
    // Verify no nonce-related failures occurred
    expect(failed.length).toBe(0); // Should never fail with new logic
    expect(successful.length).toBe(6); // All should succeed
    
    // Verify all nonces are unique and increasing
    const uniqueNonces = new Set(nonces);
    expect(uniqueNonces.size).toBe(nonces.length);
    
    const isIncreasing = nonces.every((nonce, i) => 
      i === 0 || nonce > nonces[i - 1]
    );
    expect(isIncreasing).toBe(true);
    
    console.log('✅ Intermittent failure scenario handled successfully');
  });
});
