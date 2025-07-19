import { describe, it, expect, beforeEach } from 'vitest';
import { container, configureDI } from '../../container.js';
import { KrakenApiService } from '../kraken-api-service.js';

describe('KrakenApiService Nonce Stress Test', () => {
  let krakenService: KrakenApiService;

  beforeEach(() => {
    configureDI();
    krakenService = container.resolve(KrakenApiService);
  });

  it('should handle rapid nonce generation without duplicates', async () => {
    console.log('\n=== Stress Testing Nonce Generation ===');
    
    const nonces: number[] = [];
    const iterations = 100; // Generate 100 nonces rapidly
    
    // Simulate rapid sequential calls (like your client)
    for (let i = 0; i < iterations; i++) {
      const nonce = (krakenService as any).generateUniqueNonce();
      nonces.push(nonce);
      
      // Log every 10th nonce to see progression
      if (i % 10 === 0) {
        console.log(`Nonce ${i + 1}: ${nonce}`);
      }
    }

    console.log(`\n=== Generated ${iterations} nonces ===`);
    console.log(`First: ${nonces[0]}`);
    console.log(`Last: ${nonces[nonces.length - 1]}`);
    console.log(`Range: ${nonces[nonces.length - 1] - nonces[0]}`);

    // Verify all nonces are unique
    const uniqueNonces = new Set(nonces);
    expect(uniqueNonces.size).toBe(nonces.length);
    console.log(`✅ All ${nonces.length} nonces are unique`);

    // Verify all nonces are strictly increasing
    for (let i = 1; i < nonces.length; i++) {
      expect(nonces[i]).toBeGreaterThan(nonces[i - 1]);
    }
    console.log(`✅ All nonces are strictly increasing`);

    // Check for any suspicious patterns
    const gaps = nonces.slice(1).map((nonce, i) => nonce - nonces[i]);
    const maxGap = Math.max(...gaps);
    const minGap = Math.min(...gaps);
    
    console.log(`Gap analysis: min=${minGap}, max=${maxGap}`);
    expect(minGap).toBeGreaterThan(0); // All gaps must be positive (increasing)
    console.log(`✅ No duplicate or decreasing nonces detected`);
  });

  it('should generate nonces that simulate your exact timing', async () => {
    console.log('\n=== Simulating Client Request Pattern ===');
    
    const assets = ['BTC', 'ETH', 'SOL', 'ADA', 'DOT', 'MATIC'];
    const nonces: number[] = [];
    
    for (const asset of assets) {
      // Simulate the exact timing of balance requests
      const startTime = Date.now();
      const nonce = (krakenService as any).generateUniqueNonce();
      nonces.push(nonce);
      
      console.log(`${asset}: nonce=${nonce}, time=${startTime}, generated_at=${Date.now()}`);
      
      // Small delay to simulate network request time
      await new Promise(resolve => setTimeout(resolve, Math.random() * 5));
    }

    // Verify this specific pattern works
    expect(nonces.length).toBe(6);
    
    const allUnique = new Set(nonces).size === nonces.length;
    expect(allUnique).toBe(true);
    
    const allIncreasing = nonces.every((nonce, i) => i === 0 || nonce > nonces[i - 1]);
    expect(allIncreasing).toBe(true);
    
    console.log(`✅ Client pattern simulation successful: ${nonces}`);
  });
});
