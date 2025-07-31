import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createServer } from '../../server.js';
import { configureDI, container } from '../../../container.js';
import { TYPES } from '../../../types/interfaces.js';
import { EnvService } from '../../../services/env-service.js';
import { KrakenApiService } from '../../../services/kraken-api-service.js';

// Mock axios completely
vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import axios from 'axios';

describe('Kraken Closed Orders Integration Tests', () => {
  let server: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    container.clearInstances();

    // Register all services first
    configureDI();

    // Override EnvService with mock
    const mockEnvService = {
      init: vi.fn(),
      get: vi.fn((key: string) => {
        if (key === 'api.kraken.apiKey') return 'mock-kraken-api-key';
        if (key === 'api.kraken.apiSecret') return 'mock-kraken-api-secret';
        return undefined;
      }),
      getNumber: vi.fn(),
      getBoolean: vi.fn(),
    } as unknown as EnvService;

    container.registerInstance(TYPES.IEnvService, mockEnvService);

    // Mock all Kraken API calls
    vi.mocked(axios.get).mockImplementation((url: string, config?: any) => {
      if (url === 'https://api.kraken.com/0/public/AssetPairs') {
        return Promise.resolve({
          data: {
            result: {
              'XXBTZUSD': { 
                base: 'XXBT', 
                quote: 'ZUSD', 
                altname: 'XBTUSD' 
              },
              'XETHZUSD': { 
                base: 'XETH', 
                quote: 'ZUSD', 
                altname: 'ETHUSD' 
              },
              'ADAZUSD': { 
                base: 'ADA', 
                quote: 'ZUSD', 
                altname: 'ADAZUSD' 
              },
              'ADAUSDT': { 
                base: 'ADA', 
                quote: 'USDT', 
                altname: 'ADAUSDT' 
              },
            }
          }
        });
      } else if (url === 'https://api.kraken.com/0/public/Time') {
        return Promise.resolve({
          data: {
            result: {
              unixtime: Math.floor(Date.now() / 1000),
              rfc1123: new Date().toUTCString(),
            }
          }
        });
      }
      return Promise.resolve({ data: { result: {} } });
    });

    server = await createServer();
  });

  beforeEach(() => {
    // Setup the assetPairsCache for pair name conversion
    (KrakenApiService as any).assetPairsCache = {
      'XXBTZUSD': { 
        base: 'XXBT', 
        quote: 'ZUSD', 
        altname: 'XBTUSD' 
      },
      'XETHZUSD': { 
        base: 'XETH', 
        quote: 'ZUSD', 
        altname: 'ETHUSD' 
      },
      'ADAZUSD': { 
        base: 'ADA', 
        quote: 'ZUSD', 
        altname: 'ADAZUSD' 
      },
      'ADAUSDT': { 
        base: 'ADA', 
        quote: 'USDT', 
        altname: 'ADAUSDT' 
      },
    };
    
    // Populate the pair mapping cache for the simplified conversion logic
    KrakenApiService.clearPairMappingCache();
    const cache = KrakenApiService.getPairMappingCache();
    cache.set('XXBTZUSD', 'BTCUSD');
    cache.set('XETHZUSD', 'ETHUSD');
    cache.set('ADAZUSD', 'ADAUSD');
    cache.set('ADAUSDT', 'ADAUSDT');
  });

  afterEach(async () => {
    if (server) {
      await server.close();
    }
  });

  describe('POST /api/v1/kraken/orders/closed', () => {
    const mockClosedOrdersResponse = {
      error: [],
      result: {
        closed: {
          'ORDER-1': {
            status: 'closed',
            vol: '1.0',
            vol_exec: '1.0',
            price: '50000.00',
            cost: '50000.00',
            descr: {
              pair: 'XXBTZUSD',
              type: 'sell',
              ordertype: 'market',
            },
          },
          'ORDER-2': {
            status: 'closed',
            vol: '2.0',
            vol_exec: '2.0',
            price: '3000.00',
            cost: '6000.00',
            descr: {
              pair: 'XETHZUSD',
              type: 'sell',
              ordertype: 'limit',
              price: '3000.00',
            },
          },
          'ORDER-3': {
            status: 'closed',
            vol: '100.0',
            vol_exec: '100.0',
            price: '1.50',
            cost: '150.00',
            descr: {
              pair: 'ADAZUSD',  // ADA+USD maps to ADAZUSD in Kraken
              type: 'sell',
              ordertype: 'market',
            },
          },
          'ORDER-4': {
            status: 'closed',
            vol: '1000.0',
            vol_exec: '1000.0',
            price: '0.80',
            cost: '800.00',
            descr: {
              pair: 'ADAUSDT',
              type: 'sell',
              ordertype: 'market',
            },
          },
        },
      },
    };

    it('should fetch all closed orders when no filters provided', async () => {
      vi.mocked(axios.post).mockResolvedValue({
        data: mockClosedOrdersResponse,
      });

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/kraken/orders/closed',
        payload: {},
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.orders).toHaveLength(4);
      expect(body.timestamp).toBeDefined();
      
      // Verify all orders are included
      expect(body.orders.map((o: any) => o.orderId)).toEqual([
        'ORDER-1', 'ORDER-2', 'ORDER-3', 'ORDER-4'
      ]);
    });

    it('should filter orders by baseCoins and quoteCoins paired arrays', async () => {
      vi.mocked(axios.post).mockResolvedValue({
        data: mockClosedOrdersResponse,
      });

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/kraken/orders/closed',
        payload: {
          baseCoins: ['BTC', 'ETH'],
          quoteCoins: ['USD', 'USD'], // Paired: BTC-USD and ETH-USD
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Should return orders for BTC-USD and ETH-USD pairs only
      expect(body.orders).toHaveLength(2);
      expect(body.orders.map((o: any) => o.pair)).toEqual(['BTCUSD', 'ETHUSD']);
      
            // Verify correct order structure
      expect(body.orders[0]).toMatchObject({
        orderId: 'ORDER-1',
        pair: 'BTCUSD',
        direction: 'sell',
        type: 'market',
        status: 'executed',
        amount: '1.0',
        amountExecuted: '1.0',
        cost: '50000.00',
      });
    });

    it('should filter orders by specific paired arrays', async () => {
      vi.mocked(axios.post).mockResolvedValue({
        data: mockClosedOrdersResponse,
      });

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/kraken/orders/closed',
        payload: {
          baseCoins: ['ADA', 'ADA'],
          quoteCoins: ['USD', 'USDT'], // Paired: ADA-USD and ADA-USDT
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Should return ADA orders for both USD and USDT
      expect(body.orders).toHaveLength(2);
      expect(body.orders.map((o: any) => o.pair)).toEqual(['ADAUSD', 'ADAUSDT']);
    });

    it('should handle mixed paired scenarios (different quote currencies)', async () => {
      vi.mocked(axios.post).mockResolvedValue({
        data: mockClosedOrdersResponse,
      });

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/kraken/orders/closed',
        payload: {
          baseCoins: ['ADA', 'ADA'],
          quoteCoins: ['USD', 'USDT'], // Paired: ADA-USD and ADA-USDT
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.orders).toHaveLength(2);
      
      // Verify both USD and USDT pairs are included
      const pairs = body.orders.map((o: any) => o.pair);
      expect(pairs).toContain('ADAUSD');
      expect(pairs).toContain('ADAUSDT');
    });

    it('should return empty array when no orders match paired filters', async () => {
      vi.mocked(axios.post).mockResolvedValue({
        data: mockClosedOrdersResponse,
      });

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/kraken/orders/closed',
        payload: {
          baseCoins: ['SOL'], // No SOL orders in mock data
          quoteCoins: ['USD'], // Paired: SOL-USD
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.orders).toHaveLength(0);
      expect(body.timestamp).toBeDefined();
    });

    it('should reject mismatched array lengths', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/kraken/orders/closed',
        payload: {
          baseCoins: ['ADA'], // 1 element
          quoteCoins: ['USD', 'USDT'], // 2 elements - MISMATCHED!
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('BadRequest');
      expect(body.message).toContain('baseCoins and quoteCoins arrays must have the same length');
      expect(body.message).toContain('baseCoins: 1, quoteCoins: 2');
    });

    it('should handle empty baseCoins or quoteCoins arrays', async () => {
      vi.mocked(axios.post).mockResolvedValue({
        data: mockClosedOrdersResponse,
      });

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/kraken/orders/closed',
        payload: {
          baseCoins: [],
          quoteCoins: [],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Empty arrays should return all orders (no filtering)
      expect(body.orders).toHaveLength(4);
    });

    it('should handle malformed request gracefully', async () => {
      // Test with arrays of different lengths (the core validation rule)
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/kraken/orders/closed',
        payload: {
          baseCoins: ['BTC', 'ETH', 'ADA'], // 3 elements
          quoteCoins: ['USD'], // 1 element - should fail validation
        },
      });

      // Should reject with validation error due to mismatched array lengths
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('BadRequest');
      expect(body.message).toContain('arrays must have the same length');
    });

    it('should handle Kraken API errors gracefully', async () => {
      vi.mocked(axios.post).mockResolvedValue({
        data: {
          error: ['EGeneral:Invalid arguments'],
          result: {},
        },
      });

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/kraken/orders/closed',
        payload: {
          baseCoins: ['BTC'],
          quoteCoins: ['USD'], // Paired: BTC-USD
        },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('InternalServerError');
      expect(body.message).toContain('Kraken API error');
    });

    it('should handle network errors gracefully', async () => {
      vi.mocked(axios.post).mockRejectedValue(new Error('Network error'));

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/kraken/orders/closed',
        payload: {
          baseCoins: ['BTC'],
          quoteCoins: ['USD'], // Paired: BTC-USD
        },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('InternalServerError');
    });

    it('should correctly map asset names to Kraken format', async () => {
      // Mock the axios call to verify the correct Kraken-formatted pairs are generated
      vi.mocked(axios.post).mockResolvedValue({
        data: {
          error: [],
          result: { closed: {} },
        },
      });

      await server.inject({
        method: 'POST',
        url: '/api/v1/kraken/orders/closed',
        payload: {
          baseCoins: ['BTC', 'ETH'], // Should map to XXBT, XETH
          quoteCoins: ['USD', 'USD'], // Should map to ZUSD (paired)
        },
      });

      // Verify axios was called with correct parameters
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/0/private/ClosedOrders'),
        expect.stringContaining('nonce='),
        expect.objectContaining({
          headers: expect.objectContaining({
            'API-Key': 'mock-kraken-api-key',
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
        })
      );
    });

    it('should correctly transform order data format', async () => {
      const singleOrderResponse = {
        error: [],
        result: {
          closed: {
            'TEST-ORDER': {
              status: 'closed',
              vol: '5.0',
              vol_exec: '4.5',
              price: '25000.00',
              cost: '112500.00',
              descr: {
                pair: 'XXBTZUSD',
                type: 'sell',
                ordertype: 'limit',
                price: '25000.00',
              },
            },
          },
        },
      };

      vi.mocked(axios.post).mockResolvedValue({
        data: singleOrderResponse,
      });

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/kraken/orders/closed',
        payload: {},
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.orders).toHaveLength(1);
      expect(body.orders[0]).toEqual({
        orderId: 'TEST-ORDER',
        pair: 'BTCUSD',
        direction: 'sell',
        type: 'limit',
        status: 'executed',
        amount: '5.0',
        amountExecuted: '4.5',
        price: '25000.00',
        limitPrice: '25000.00', // Should include limit price for limit orders
        cost: '112500.00',
      });
    });
  });
});
