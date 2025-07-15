import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createServer } from '../server.js';
import { configureDI, container } from '../../container.js';
import { TYPES } from '../../types/interfaces.js';
import { EnvService } from '../../services/env-service.js';

// Mock axios completely
vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import axios from 'axios';

describe('Exchange Routes', () => {
  let server: FastifyInstance; beforeEach(async () => {
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
        if (key === 'api.kraken.apiKey') return 'mock-kraken-api-key';
        if (key === 'api.kraken.apiSecret') return 'mock-kraken-api-secret';
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
        url: '/api/v1/mexc/price/btc?apiUrl=https://api.mexc.com',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.asset).toBe('BTC');
      expect(body.exchange).toBe('mexc');
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
        url: '/api/v1/mexc/price/btc?apiUrl=https://api.mexc.com&to=ETH',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.pair).toBe('BTCETH');
    });

    it('should require apiUrl parameter', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/mexc/price/btc',
      });

      expect(response.statusCode).toBe(400);
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
        url: '/api/v1/mexc/balance/btc?apiUrl=https://api.mexc.com&percentage=75',
      });

      if (response.statusCode !== 200) {
        console.log('Balance test error response:', response.body);
      }

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.asset).toBe('BTC');
      expect(body.exchange).toBe('mexc');
      expect(body.balance).toBe(1.5);
      expect(body.timestamp).toBeDefined();
    });
  });

  describe('POST /api/v1/mexc/orders/sell', () => {
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

      const asset = {
        name: 'BTC',
        exchange: 'mexc',
        percentage: 50,
        apiUrl: 'https://api.mexc.com',
      };

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/mexc/orders/sell',
        payload: { asset, to: 'USDT' },
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
      expect(body.exchange).toBe('mexc');
      expect(body.quantity).toBe(0.5); // 50% of 1.0 BTC
    });

    it('should reject non-MEXC assets', async () => {
      const asset = {
        name: 'BTC',
        exchange: 'binance',
        percentage: 50,
        apiUrl: 'https://api.binance.com',
      };

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/mexc/orders/sell',
        payload: { asset },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);

      expect(body.error).toBe('InvalidExchange');
      expect(body.message).toContain('mexc');
    });
  });

  describe('Kraken Exchange Routes', () => {
    describe('GET /api/v1/kraken/price/:asset', () => {
      it('should fetch price for BTC on Kraken', async () => {
        // Mock the axios response for price endpoint
        vi.mocked(axios.get).mockResolvedValue({
          data: { 
            result: {
              'XXBTUSDT': {
                c: ['50000.00', '0.5'], // Kraken format: [price, volume]
              },
            },
          },
        });

        const response = await server.inject({
          method: 'GET',
          url: '/api/v1/kraken/price/btc?apiUrl=https://api.kraken.com',
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);

        expect(body.asset).toBe('BTC');
        expect(body.exchange).toBe('kraken');
        expect(body.price).toBe(50000);
        expect(body.pair).toBe('XXBTUSDT'); // Kraken maps BTC to XXBT
        expect(body.timestamp).toBeDefined();
      });

      it('should handle custom target currency', async () => {
        vi.mocked(axios.get).mockResolvedValue({
          data: { 
            result: {
              'XXBTXETH': {
                c: ['2.5', '0.3'],
              },
            },
          },
        });

        const response = await server.inject({
          method: 'GET',
          url: '/api/v1/kraken/price/btc?apiUrl=https://api.kraken.com&to=ETH',
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);

        expect(body.pair).toBe('XXBTXETH');
      });

      it('should require apiUrl parameter', async () => {
        const response = await server.inject({
          method: 'GET',
          url: '/api/v1/kraken/price/btc',
        });

        expect(response.statusCode).toBe(400);
      });
    });

    describe('GET /api/v1/kraken/balance/:asset', () => {
      it('should fetch balance for BTC on Kraken', async () => {
        // Mock server time and balance calls
        vi.mocked(axios.get)
          .mockResolvedValueOnce({ data: { result: { unixtime: 1640995200 } } }) // server time
          
        vi.mocked(axios.post).mockResolvedValueOnce({ // balance
          data: {
            error: [],
            result: {
              'XXBT': '1.5',
            },
          },
        });

        const response = await server.inject({
          method: 'GET',
          url: '/api/v1/kraken/balance/btc?apiUrl=https://api.kraken.com&percentage=75',
        });

        if (response.statusCode !== 200) {
          console.log('Kraken balance test error response:', response.body);
        }

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);

        expect(body.asset).toBe('BTC');
        expect(body.exchange).toBe('kraken');
        expect(body.balance).toBe(1.5);
        expect(body.timestamp).toBeDefined();
      });
    });

    describe('POST /api/v1/kraken/orders/sell', () => {
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

          if (urlStr.includes('/0/public/Time')) {
            // Server time endpoint
            return Promise.resolve({ data: { result: { unixtime: 1640995200 } } });
          }

          // Default fallback
          return Promise.resolve({ data: { result: { unixtime: Date.now() / 1000 } } });
        });

        // Mock POST for balance and order endpoints
        mockAxiosPost.mockImplementation((url: any) => {
          const urlStr = typeof url === 'string' ? url : (url)?.toString?.() || '';

          if (urlStr.includes('/0/private/Balance')) {
            // Balance endpoint
            return Promise.resolve({
              data: {
                error: [],
                result: {
                  'XXBT': '1.0',
                },
              },
            });
          } else if (urlStr.includes('/0/private/AddOrder')) {
            // Order creation endpoint
            return Promise.resolve({
              data: { 
                error: [],
                result: { txid: ['OQCLML-BW3P3-BUCMWZ'] },
              },
              statusText: 'OK',
            });
          }

          // Default fallback
          return Promise.resolve({ data: { error: [], result: {} }, statusText: 'OK' });
        });

        const asset = {
          name: 'BTC',
          exchange: 'kraken',
          percentage: 50,
          apiUrl: 'https://api.kraken.com',
        };

        const response = await server.inject({
          method: 'POST',
          url: '/api/v1/kraken/orders/sell',
          payload: { asset, to: 'USDT' },
        });

        if (response.statusCode !== 200) {
          console.log('Kraken sell order test error response:', response.body);
          console.log('axios.get call count:', mockAxiosGet.mock.calls.length);
          console.log('axios.post call count:', mockAxiosPost.mock.calls.length);
          console.log('Get call URLs:', mockAxiosGet.mock.calls.map(call => call[0]));
        }

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);

        expect(body.success).toBe(true);
        expect(body.asset).toBe('BTC');
        expect(body.exchange).toBe('kraken');
        expect(body.quantity).toBe(0.5); // 50% of 1.0 BTC
      });

      it('should reject non-Kraken assets', async () => {
        const asset = {
          name: 'BTC',
          exchange: 'binance',
          percentage: 50,
          apiUrl: 'https://api.binance.com',
        };

        const response = await server.inject({
          method: 'POST',
          url: '/api/v1/kraken/orders/sell',
          payload: { asset },
        });

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.body);

        expect(body.error).toBe('InvalidExchange');
        expect(body.message).toContain('kraken');
      });
    });
  });
});
