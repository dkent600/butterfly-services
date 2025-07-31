import { describe, it, expect, beforeEach } from 'vitest';
import { KrakenApiService } from '../kraken-api-service.js';
import { IEnvService, IExchangeApiService } from '../../types/interfaces.js';

// Mock dependencies
const mockEnvService = {
  get: () => 'test',
  getBoolean: () => false,
} as IEnvService;

const mockExchangeApiService = {
  getAPIKey: () => 'mock-api-key',
  getAPISecret: () => 'mock-api-secret',
  sendApiRequest: () => Promise.resolve({ success: true }),
} as IExchangeApiService;

describe('KrakenApiService Pair Mapping Cache', () => {
  let krakenService: KrakenApiService;

  beforeEach(() => {
    // Clear cache before each test
    KrakenApiService.clearPairMappingCache();
    krakenService = new KrakenApiService(mockExchangeApiService, mockEnvService);
  });

  it('should populate cache when generating pairs from filters', () => {
    // Act: Generate pairs from filters (this should populate the cache)
    const filters = {
      baseCoins: ['BTC', 'ETH'],
      quoteCoins: ['USD', 'USD'],
    };
    
    // Access the private method for testing
    const pairs = (krakenService as any).generateClosedOrderPairs(filters);
    
    // Assert: Check that pairs were generated correctly
    expect(pairs).toEqual(['XXBTZUSD', 'XETHZUSD']);
    
    // Assert: Check that cache was populated
    const cache = KrakenApiService.getPairMappingCache();
    expect(cache.get('XXBTZUSD')).toBe('BTCUSD');
    expect(cache.get('XETHZUSD')).toBe('ETHUSD');
    expect(cache.size).toBe(2);
  });

  it('should use cache for efficient reverse conversion', () => {
    // Arrange: Populate cache first
    const filters = {
      baseCoins: ['BTC'],
      quoteCoins: ['USD'],
    };
    (krakenService as any).generateClosedOrderPairs(filters);
    
    // Act: Convert using the cache (should hit cache)
    const standardPair = (krakenService as any).convertKrakenPairToStandard('XXBTZUSD');
    
    // Assert: Should return the cached value
    expect(standardPair).toBe('BTCUSD');
  });

  it('should handle empty filters without populating cache', () => {
    // Act: Generate pairs from empty filters
    const pairs1 = (krakenService as any).generateClosedOrderPairs();
    const pairs2 = (krakenService as any).generateClosedOrderPairs({ baseCoins: [], quoteCoins: [] });
    
    // Assert: Should return empty arrays
    expect(pairs1).toEqual([]);
    expect(pairs2).toEqual([]);
    
    // Assert: Cache should remain empty
    const cache = KrakenApiService.getPairMappingCache();
    expect(cache.size).toBe(0);
  });

  it('should cache conversions from pair generation', () => {
    // Arrange: Start with empty cache
    expect(KrakenApiService.getPairMappingCache().size).toBe(0);
    
    // Act: Generate pairs which populates the cache
    const filters = {
      baseCoins: ['ADA'],
      quoteCoins: ['USD'],
    };
    (krakenService as any).generateClosedOrderPairs(filters);
    
    // Assert: Should have cached the mapping during generation
    const cache = KrakenApiService.getPairMappingCache();
    expect(cache.get('ADAZUSD')).toBe('ADAUSD');
    expect(cache.size).toBe(1);
    
    // Act: Now conversion should work using the cache
    const standardPair = (krakenService as any).convertKrakenPairToStandard('ADAZUSD');
    expect(standardPair).toBe('ADAUSD');
  });

  it('should clear cache correctly', () => {
    // Arrange: Populate cache
    const filters = {
      baseCoins: ['BTC', 'ETH'],
      quoteCoins: ['USD', 'USD'],
    };
    (krakenService as any).generateClosedOrderPairs(filters);
    expect(KrakenApiService.getPairMappingCache().size).toBe(2);
    
    // Act: Clear cache
    KrakenApiService.clearPairMappingCache();
    
    // Assert: Cache should be empty
    expect(KrakenApiService.getPairMappingCache().size).toBe(0);
  });

  it('should validate paired array lengths', () => {
    // Act & Assert: Should throw error for mismatched array lengths
    expect(() => {
      (krakenService as any).generateClosedOrderPairs({
        baseCoins: ['BTC', 'ETH'],
        quoteCoins: ['USD'], // Different length
      });
    }).toThrow('baseCoins and quoteCoins arrays must have the same length');
  });
});
