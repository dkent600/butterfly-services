import { describe, it, expect, beforeEach } from 'vitest';
import { container, configureDI } from '../../container.js';
import { KrakenApiService } from '../kraken-api-service.js';
import { IAsset } from '../../types/interfaces.js';

describe('KrakenApiService Sequential Balance Tests', () => {
  let krakenService: KrakenApiService;

  beforeEach(() => {
    // Configure DI container before resolving services
    configureDI();
    // Get the singleton instance (same as your routes do)
    krakenService = container.resolve(KrakenApiService);
  });

  it('should handle fast sequential balance calls for different coins without nonce conflicts', async () => {
    // Simulate your client's exact scenario
    const assets: IAsset[] = [
      { name: 'BTC', exchange: 'kraken', amount: 0 },
      { name: 'ETH', exchange: 'kraken', amount: 0 },
      { name: 'SOL', exchange: 'kraken', amount: 0 },
      { name: 'ADA', exchange: 'kraken', amount: 0 },
      { name: 'DOT', exchange: 'kraken', amount: 0 },
      { name: 'MATIC', exchange: 'kraken', amount: 0 },
    ];

    console.log('=== Testing Sequential Balance Calls (Like Your Client) ===');
    
    const results: Array<{ asset: string; success: boolean; error?: string; nonce?: number }> = [];
    
    // Exactly like your client: sequential for...of loop with await
    for (const asset of assets) {
      try {
        console.log(`\n[${new Date().toISOString()}] Starting balance fetch for ${asset.name}`);
        
        const startTime = Date.now();
        const balance = await krakenService.fetchBalance(asset);
        const endTime = Date.now();
        
        console.log(`[${new Date().toISOString()}] ✅ ${asset.name} balance: ${balance} (took ${endTime - startTime}ms)`);
        
        results.push({ 
          asset: asset.name, 
          success: true 
        });
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(`[${new Date().toISOString()}] ❌ ${asset.name} failed: ${errorMessage}`);
        
        results.push({ 
          asset: asset.name, 
          success: false, 
          error: errorMessage 
        });
      }
    }

    console.log('\n=== Results Summary ===');
    results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      console.log(`${status} ${result.asset}: ${result.success ? 'SUCCESS' : result.error}`);
    });

    // Verify results
    const failures = results.filter(r => !r.success);
    const nonceErrors = failures.filter(r => r.error?.includes('nonce') || r.error?.includes('EAPI'));
    
    console.log(`\nTotal calls: ${results.length}`);
    console.log(`Successful: ${results.filter(r => r.success).length}`);
    console.log(`Failed: ${failures.length}`);
    console.log(`Nonce-related failures: ${nonceErrors.length}`);

    // The test passes if we have no nonce-related errors
    // (We expect some failures due to test credentials, but NOT nonce errors)
    expect(nonceErrors.length).toBe(0);
    
    // Also verify we attempted all 6 assets
    expect(results.length).toBe(6);
  }, 30000); // 30 second timeout for real API calls

  it('should generate strictly increasing nonces under rapid sequential calls', async () => {
    console.log('\n=== Testing Nonce Generation Directly ===');
    
    const generatedNonces: number[] = [];
    const assets = ['BTC', 'ETH', 'SOL', 'ADA', 'DOT', 'MATIC'];
    
    // Simulate the internal nonce generation that happens during balance calls
    for (let i = 0; i < assets.length; i++) {
      // Access the private method via reflection (for testing purposes)
      const nonce = (krakenService as any).generateUniqueNonce();
      generatedNonces.push(nonce);
      console.log(`Nonce ${i + 1}: ${nonce} (${assets[i]})`);
      
      // Small delay to simulate real API call timing
      await new Promise(resolve => setTimeout(resolve, 1));
    }

    console.log('\n=== Nonce Analysis ===');
    console.log('Generated nonces:', generatedNonces);
    
    // Verify all nonces are unique
    const uniqueNonces = new Set(generatedNonces);
    expect(uniqueNonces.size).toBe(generatedNonces.length);
    console.log(`✅ All ${generatedNonces.length} nonces are unique`);
    
    // Verify all nonces are strictly increasing
    for (let i = 1; i < generatedNonces.length; i++) {
      expect(generatedNonces[i]).toBeGreaterThan(generatedNonces[i - 1]);
    }
    console.log('✅ All nonces are strictly increasing');
    
    // Verify reasonable nonce values (should be close to current timestamp)
    const now = Date.now();
    const oldestNonce = generatedNonces[0];
    const newestNonce = generatedNonces[generatedNonces.length - 1];
    
    expect(oldestNonce).toBeGreaterThan(now - 10000); // Within 10 seconds
    expect(newestNonce).toBeLessThan(now + 10000); // Within 10 seconds
    console.log('✅ Nonces are within reasonable time range');
  });
});
