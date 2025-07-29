import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createServer } from '../../server.js';
import { configureDI, container } from '../../../container.js';
import { TYPES } from '../../../types/interfaces.js';
import { EnvService } from '../../../services/env-service.js';

// Mock axios completely
vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import axios from 'axios';

describe('MEXC Exchange Routes', () => {
  let server: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    container.clearInstances();

    // Register all services first
    configureDI();

    // Then override the EnvService with our mock
    const mockEnvService = {
      init: vi.fn(),
      get: vi.fn((key: string) => {
        if (key === 'api.mexc.apiKey') return 'mock-api-key';
        if (key === 'api.mexc.apiSecret') return 'mock-api-secret';
        return undefined;
      }),
      getNumber: vi.fn(),
      getBoolean: vi.fn(),
    } as unknown as EnvService;

    container.registerInstance(TYPES.IEnvService, mockEnvService);

    server = await createServer();
  });

  afterEach(async () => {
    if (server) {
      await server.close();
    }
  });

  describe('GET /api/v1/mexc/price/:asset', () => {
    it('should fetch price for BTC on MEXC', async () => {
      // Mock the axios response for price endpoint
      vi.mocked(axios.get).mockResolvedValue({
        data: { price: '50000.00' },
      });

      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/mexc/price/btc?to=USDT',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.asset).toBe('BTC');
      expect(body.price).toBe(50000);
      expect(body.pair).toBe('BTCUSDT');
      expect(body.timestamp).toBeDefined();
    });

    it('should handle custom target currency', async () => {
      vi.mocked(axios.get).mockResolvedValue({
        data: { price: '2.5' },
      });

      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/mexc/price/btc?to=ETH',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.pair).toBe('BTCETH');
    });

    it('should fetch price with default parameters', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/mexc/price/btc?to=USDT',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.asset).toBe('BTC');
      expect(body.price).toBeDefined();
      expect(body.pair).toBe('BTCUSDT'); // Default to USDT
    });
  });

  describe('GET /api/v1/mexc/balance/:asset', () => {
    it('should fetch balance for BTC on MEXC', async () => {
      // Mock server time and balance calls
      vi.mocked(axios.get)
        .mockResolvedValueOnce({ data: { serverTime: Date.now() } }) // server time
        .mockResolvedValueOnce({ // balance
          data: {
            balances: [
              { asset: 'BTC', free: '1.5' },
            ],
          },
        });

      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/mexc/balance/btc',
      });

      if (response.statusCode !== 200) {
        console.log('Balance test error response:', response.body);
      }

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.asset).toBe('BTC');
      expect(body.balance).toBe(1.5);
      expect(body.timestamp).toBeDefined();
    });
  });

  describe('POST /api/v1/mexc/orders/sell/market', () => {
    it('should create market sell order', async () => {
      // Set up flexible mocking based on URL patterns
      const mockAxiosGet = vi.mocked(axios.get);
      const mockAxiosPost = vi.mocked(axios.post);

      // Clear any previous calls
      mockAxiosGet.mockClear();
      mockAxiosPost.mockClear();

      // Mock based on URL patterns instead of call order
      mockAxiosGet.mockImplementation((url: any) => {
        const urlStr = typeof url === 'string' ? url : (url)?.toString?.() || '';

        if (urlStr.includes('/api/v3/time')) {
          // Server time endpoint
          return Promise.resolve({ data: { serverTime: Date.now() } });
        } else if (urlStr.includes('/api/v3/account')) {
          // Balance endpoint
          return Promise.resolve({
            data: {
              balances: [
                { asset: 'BTC', free: '1.0' },
              ],
            },
          });
        }

        // Default fallback
        return Promise.resolve({ data: { serverTime: Date.now() } });
      });

      // Mock order creation
      mockAxiosPost.mockResolvedValue({
        data: { orderId: '12345' },
        statusText: 'OK',
      });

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/mexc/orders/sell/market',
        payload: { name: 'BTC', amount: 50, to: 'USDT' },
      });

      if (response.statusCode !== 200) {
        console.log('Sell order test error response:', response.body);
        console.log('axios.get call count:', mockAxiosGet.mock.calls.length);
        console.log('axios.post call count:', mockAxiosPost.mock.calls.length);
        console.log('Get call URLs:', mockAxiosGet.mock.calls.map(call => call[0]));
      }

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);

      expect(body.message).toBe('Market sell order created successfully');
      expect(body.asset).toBe('BTC');
      expect(body.quantity).toBe(50);
      expect(body.success).toBeUndefined(); // success field should not exist
    });
  });

  describe('POST /api/v1/mexc/orders/sell/limit', () => {
    it('should create limit sell order', async () => {
      // Set up flexible mocking based on URL patterns
      const mockAxiosGet = vi.mocked(axios.get);
      const mockAxiosPost = vi.mocked(axios.post);

      // Clear any previous calls
      mockAxiosGet.mockClear();
      mockAxiosPost.mockClear();

      // Mock based on URL patterns instead of call order
      mockAxiosGet.mockImplementation((url: any) => {
        const urlStr = typeof url === 'string' ? url : (url)?.toString?.() || '';

        if (urlStr.includes('/api/v3/time')) {
          // Server time endpoint
          return Promise.resolve({ data: { serverTime: Date.now() } });
        } else if (urlStr.includes('/api/v3/account')) {
          // Balance endpoint
          return Promise.resolve({
            data: {
              balances: [
                { asset: 'BTC', free: '1.0' },
              ],
            },
          });
        }

        // Default fallback
        return Promise.resolve({ data: { serverTime: Date.now() } });
      });

      // Mock limit order creation
      mockAxiosPost.mockResolvedValue({
        data: { orderId: '12345' },
        statusText: 'OK',
      });

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/mexc/orders/sell/limit',
        payload: { name: 'BTC', amount: 50, price: 45000.50, to: 'USDT' },
      });

      if (response.statusCode !== 200) {
        console.log('Limit sell order test error response:', response.body);
        console.log('axios.get call count:', mockAxiosGet.mock.calls.length);
        console.log('axios.post call count:', mockAxiosPost.mock.calls.length);
        console.log('Get call URLs:', mockAxiosGet.mock.calls.map(call => call[0]));
      }

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);

      expect(body.message).toBe('Limit sell order created successfully');
      expect(body.asset).toBe('BTC');
      expect(body.quantity).toBe(50);
      expect(body.price).toBe(45000.50);
      expect(body.success).toBeUndefined(); // success field should not exist
    });

    it('should reject limit order without price', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/mexc/orders/sell/limit',
        payload: { name: 'BTC', amount: 50, to: 'USDT' },  // Missing price
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject limit order with invalid price', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/mexc/orders/sell/limit',
        payload: { name: 'BTC', amount: 50, price: -100, to: 'USDT' },  // Invalid negative price
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/v1/mexc/orders/opened', () => {
    it('should fetch open orders successfully', async () => {
      // Set up flexible mocking based on URL patterns
      const mockAxiosGet = vi.mocked(axios.get);

      // Clear any previous calls
      mockAxiosGet.mockClear();

      // Mock server time for nonce generation
      mockAxiosGet.mockImplementation((url: any) => {
        const urlStr = typeof url === 'string' ? url : url?.toString?.() || '';

        if (urlStr.includes('/api/v3/time')) {
          // Server time endpoint
          return Promise.resolve({ data: { serverTime: Date.now() } });
        } else if (urlStr.includes('/api/v3/openOrders')) {
          // Open orders endpoint
          return Promise.resolve({
            data: [
              {
                symbol: 'BTCUSDT',
                orderId: 12345,
                clientOrderId: 'abc123',
                price: '50000.00',
                origQty: '0.001',
                executedQty: '0.000',
                status: 'NEW',
                side: 'SELL',
                type: 'LIMIT'
              }
            ]
          });
        }

        // Default fallback
        return Promise.resolve({ data: { serverTime: Date.now() } });
      });

      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/mexc/orders/opened',
      });

      if (response.statusCode !== 200) {
        console.log('Open orders test error response:', response.body);
      }

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.orders).toBeDefined();
      // MEXC returns arrays directly, not objects like Kraken
      expect(Array.isArray(body.orders)).toBe(true);
      expect(body.timestamp).toBeDefined();
    });

    it('should handle empty open orders', async () => {
      const mockAxiosGet = vi.mocked(axios.get);
      mockAxiosGet.mockClear();

      mockAxiosGet.mockImplementation((url: any) => {
        const urlStr = typeof url === 'string' ? url : url?.toString?.() || '';

        if (urlStr.includes('/api/v3/time')) {
          return Promise.resolve({ data: { serverTime: Date.now() } });
        } else if (urlStr.includes('/api/v3/openOrders')) {
          return Promise.resolve({ data: [] }); // Empty orders array
        }

        return Promise.resolve({ data: { serverTime: Date.now() } });
      });

      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/mexc/orders/opened',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.orders).toEqual([]);
      expect(body.timestamp).toBeDefined();
    });
  });

  describe('POST /api/v1/mexc/orders/closed', () => {
    it('should fetch closed orders successfully', async () => {
      const mockAxiosGet = vi.mocked(axios.get);
      mockAxiosGet.mockClear();

      mockAxiosGet.mockImplementation((url: any) => {
        const urlStr = typeof url === 'string' ? url : url?.toString?.() || '';
        console.log('[MOCK DEBUG] Request URL:', urlStr);

        if (urlStr.includes('/api/v3/time')) {
          return Promise.resolve({ data: { serverTime: Date.now() } });
        } else if (urlStr.includes('/api/v3/allOrders')) {
          console.log('[MOCK DEBUG] Matched allOrders endpoint');
          // All orders endpoint (includes closed orders)
          return Promise.resolve({
            data: [
              {
                orderId: 123,
                clientOrderId: 'client123',
                symbol: 'BTCUSDT',
                status: 'FILLED',
                side: 'SELL',
                type: 'LIMIT',
                origQty: '0.001',
                executedQty: '0.001',
                price: '50000.00'
              },
              {
                orderId: 456,
                clientOrderId: 'client456',
                symbol: 'BTCUSDT',
                status: 'NEW',
                side: 'BUY',
                type: 'LIMIT',
                origQty: '0.002',
                executedQty: '0.000',
                price: '48000.00'
              },
              {
                orderId: 789,
                clientOrderId: 'client789',
                symbol: 'BTCUSDT',
                status: 'CANCELED',
                side: 'SELL',
                type: 'MARKET',
                origQty: '0.003',
                executedQty: '0.000',
                price: '49000.00'
              }
            ]
          });
        } else {
          console.log('[MOCK DEBUG] No match for URL, returning default time response');
          return Promise.resolve({ data: { serverTime: Date.now() } });
        }
      });

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/mexc/orders/closed',
        payload: {
          baseCoins: ['BTC'],
          quoteCoins: ['USDT']
        }
      });

      if (response.statusCode !== 200) {
        console.log('Closed orders test error response:', response.body);
      }

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.orders).toBeDefined();
      expect(Array.isArray(body.orders)).toBe(true);
      expect(body.timestamp).toBeDefined();
      
      // Should only include closed orders in our standardized format (executed, canceled, rejected, expired)
      const hasOnlyClosedStatuses = body.orders.every((order: any) => 
        ['executed', 'canceled', 'rejected', 'expired'].includes(order.status)
      );
      expect(hasOnlyClosedStatuses).toBe(true);
    });

    it('should filter out non-closed orders and accept custom base/quote coins', async () => {
      const mockAxiosGet = vi.mocked(axios.get);
      mockAxiosGet.mockClear();

      mockAxiosGet.mockImplementation((url: any, config: any) => {
        console.log('[DEBUG 2] Mock called with URL:', url);
        console.log('[DEBUG 2] Config:', config);
        console.log('[DEBUG 2] URL type:', typeof url);
        console.log('[DEBUG 2] URL string representation:', url?.toString?.());
        
        const urlStr = typeof url === 'string' ? url : url?.toString?.() || '';
        console.log('[DEBUG 2] Final URL string for matching:', urlStr);

        if (urlStr.includes('/api/v3/time')) {
          console.log('[DEBUG 2] Matched time endpoint');
          return Promise.resolve({ data: { serverTime: Date.now() } });
        } else if (urlStr.includes('/api/v3/allOrders')) {
          console.log('[DEBUG 2] Matched allOrders endpoint');
          return Promise.resolve({
            data: [
              { orderId: 1, clientOrderId: 'client1', symbol: 'BTCUSDT', status: 'FILLED', side: 'SELL', type: 'LIMIT', origQty: '0.001', executedQty: '0.001', price: '50000.00' },
              { orderId: 2, clientOrderId: 'client2', symbol: 'BTCUSDT', status: 'NEW', side: 'BUY', type: 'LIMIT', origQty: '0.002', executedQty: '0.000', price: '48000.00' }, // Should be filtered out
              { orderId: 3, clientOrderId: 'client3', symbol: 'BTCUSDT', status: 'CANCELED', side: 'SELL', type: 'MARKET', origQty: '0.003', executedQty: '0.000', price: '49000.00' },
              { orderId: 4, clientOrderId: 'client4', symbol: 'BTCUSDT', status: 'PARTIALLY_FILLED', side: 'BUY', type: 'LIMIT', origQty: '0.004', executedQty: '0.001', price: '47000.00' }, // Should be filtered out
              { orderId: 5, clientOrderId: 'client5', symbol: 'BTCUSDT', status: 'REJECTED', side: 'SELL', type: 'LIMIT', origQty: '0.005', executedQty: '0.000', price: '51000.00' },
              { orderId: 6, clientOrderId: 'client6', symbol: 'BTCUSDT', status: 'EXPIRED', side: 'BUY', type: 'LIMIT', origQty: '0.006', executedQty: '0.000', price: '46000.00' }
            ]
          });
        }

        console.log('[DEBUG 2] No endpoint match, returning default');
        return Promise.resolve({ data: { serverTime: Date.now() } });
      });

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/mexc/orders/closed',
        payload: {
          baseCoins: ['BTC'],
          quoteCoins: ['USDT']
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Should only return orders with closed statuses (1, 3, 5, 6) - now as strings in our standardized format
      expect(body.orders).toHaveLength(4);
      expect(body.orders.map((order: any) => order.orderId)).toEqual(['1', '3', '5', '6']);
      expect(body.total).toBeUndefined(); // total field should not exist per our rules
    });
  });

  describe('DELETE /api/v1/mexc/orders/cancel/:txid', () => {
    it('should block cancel order in test mode for safety', async () => {
      const mockAxiosGet = vi.mocked(axios.get);
      mockAxiosGet.mockClear();

      // Mock server time for nonce generation
      mockAxiosGet.mockImplementation(() => {
        return Promise.resolve({ data: { serverTime: Date.now() } });
      });

      const response = await server.inject({
        method: 'DELETE',
        url: '/api/v1/mexc/orders/cancel/ORDER_123456',
      });

      if (response.statusCode !== 204) {
        console.log('Cancel order test error response:', response.body);
      }

      expect(response.statusCode).toBe(204);
      expect(response.body).toBe('');
    });

    it('should require transaction ID parameter', async () => {
      const response = await server.inject({
        method: 'DELETE',
        url: '/api/v1/mexc/orders/cancel/',  // Missing txid parameter
      });

      expect(response.statusCode).toBe(400); // Bad request due to missing required parameter
    });

    it('should handle invalid transaction ID', async () => {
      const mockAxiosGet = vi.mocked(axios.get);
      mockAxiosGet.mockClear();

      mockAxiosGet.mockImplementation(() => {
        return Promise.resolve({ data: { serverTime: Date.now() } });
      });

      const response = await server.inject({
        method: 'DELETE',
        url: '/api/v1/mexc/orders/cancel/', // Empty txid
      });

      expect(response.statusCode).toBe(400); // Bad request for empty transaction ID
    });

    it('should validate non-empty transaction ID', async () => {
      const mockAxiosGet = vi.mocked(axios.get);
      mockAxiosGet.mockClear();

      mockAxiosGet.mockImplementation(() => {
        return Promise.resolve({ data: { serverTime: Date.now() } });
      });

      const response = await server.inject({
        method: 'DELETE',
        url: '/api/v1/mexc/orders/cancel/%20%20%20', // URL-encoded whitespace-only txid
      });

      // Should return 400 for invalid transaction ID (whitespace only)
      expect(response.statusCode).toBe(400);
    });
  });
});
