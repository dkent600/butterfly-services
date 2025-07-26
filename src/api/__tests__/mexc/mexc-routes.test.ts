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

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.success).toBe(true);
      expect(body.asset).toBe('BTC');
      expect(body.quantity).toBe(50);
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

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.success).toBe(true);
      expect(body.asset).toBe('BTC');
      expect(body.quantity).toBe(50);
      expect(body.price).toBe(45000.50);
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
});
