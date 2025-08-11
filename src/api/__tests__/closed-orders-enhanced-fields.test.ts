import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createServer } from '../server.js';
import { configureDI, container } from '../../container.js';
import { TYPES } from '../../types/interfaces.js';
import { EnvService } from '../../services/env-service.js';
import { KrakenApiService } from '../../services/kraken-api-service.js';

// Mock axios completely
vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import axios from 'axios';

describe('Closed Orders Enhanced Fields Tests', () => {
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
        if (key === 'api.mexc.apiKey') return 'mock-mexc-api-key';
        if (key === 'api.mexc.apiSecret') return 'mock-mexc-api-secret';
        return undefined;
      }),
      getNumber: vi.fn(),
      getBoolean: vi.fn(),
    } as unknown as EnvService;

    container.registerInstance(TYPES.IEnvService, mockEnvService);

    // Mock all API calls
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
      } else if (url.includes('/api/v3/time')) {
        return Promise.resolve({ data: { serverTime: Date.now() } });
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
    };
  });

  afterEach(async () => {
    if (server) {
      await server.close();
    }
  });

  describe('Kraken Closed Orders - Enhanced Fields', () => {
    const mockKrakenClosedOrdersResponse = {
      error: [],
      result: {
        closed: {
          'KRAKEN-ORDER-1': {
            status: 'closed',
            vol: '1.0',
            vol_exec: '1.0',
            price: '50000.00',
            cost: '50000.00',
            opentm: '1672531200.000', // Unix timestamp: 2023-01-01 00:00:00 UTC
            descr: {
              pair: 'BTCUSD',
              type: 'sell',
              ordertype: 'market',
            },
          },
          'KRAKEN-ORDER-2': {
            status: 'closed',
            vol: '2.0',
            vol_exec: '2.0',
            price: '3000.00',
            cost: '6000.00',
            opentm: '1672617600.000', // Unix timestamp: 2023-01-02 00:00:00 UTC
            descr: {
              pair: 'ETHUSD',
              type: 'buy',
              ordertype: 'limit',
              price: '3000.00',
            },
          },
        },
      },
    };

    it('should include createdAt and exchange fields in Kraken closed orders response', async () => {
      vi.mocked(axios.post).mockResolvedValue({
        data: mockKrakenClosedOrdersResponse,
      });

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/kraken/orders/closed',
        payload: {},
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.orders).toHaveLength(2);
      expect(body.timestamp).toBeDefined();

      // Verify first order has required enhanced fields
      const order1 = body.orders.find((o: any) => o.orderId === 'KRAKEN-ORDER-1');
      expect(order1).toBeDefined();
      expect(order1.createdAt).toBe('2023-01-01T00:00:00.000Z');
      expect(order1.exchange).toBe('kraken');

      // Verify second order has required enhanced fields
      const order2 = body.orders.find((o: any) => o.orderId === 'KRAKEN-ORDER-2');
      expect(order2).toBeDefined();
      expect(order2.createdAt).toBe('2023-01-02T00:00:00.000Z');
      expect(order2.exchange).toBe('kraken');

      // Verify all orders have the enhanced fields
      body.orders.forEach((order: any) => {
        expect(order.createdAt).toBeDefined();
        expect(typeof order.createdAt).toBe('string');
        expect(order.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/); // ISO format
        expect(order.exchange).toBe('kraken');
      });
    });

    it('should handle missing opentm field gracefully in Kraken orders', async () => {
      const mockResponseWithoutOpentm = {
        error: [],
        result: {
          closed: {
            'KRAKEN-ORDER-NO-TIME': {
              status: 'closed',
              vol: '1.0',
              vol_exec: '1.0',
              price: '50000.00',
              cost: '50000.00',
              // opentm field is missing
              descr: {
                pair: 'BTCUSD',
                type: 'sell',
                ordertype: 'market',
              },
            },
          },
        },
      };

      vi.mocked(axios.post).mockResolvedValue({
        data: mockResponseWithoutOpentm,
      });

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/kraken/orders/closed',
        payload: {},
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.orders).toHaveLength(1);
      const order = body.orders[0];

      // Should have empty createdAt when timestamp is missing and exchange
      expect(order.createdAt).toBeDefined();
      expect(typeof order.createdAt).toBe('string');
      expect(order.createdAt).toBe(''); // Empty string when timestamp is missing
      expect(order.exchange).toBe('kraken');
    });
  });

  describe('MEXC Closed Orders - Enhanced Fields', () => {
    const mockMexcClosedOrdersResponse = [
      {
        orderId: 123456789,
        clientOrderId: 'mexc-client-123',
        symbol: 'BTCUSDT',
        status: 'FILLED',
        side: 'SELL',
        type: 'LIMIT',
        origQty: '0.001',
        executedQty: '0.001',
        price: '50000.00',
        cummulativeQuoteQty: '50.00',
        time: 1672531200000, // Unix timestamp in milliseconds: 2023-01-01 00:00:00 UTC
      },
      {
        orderId: 987654321,
        clientOrderId: 'mexc-client-456',
        symbol: 'ETHUSDT',
        status: 'CANCELED',
        side: 'BUY',
        type: 'MARKET',
        origQty: '1.0',
        executedQty: '0.0',
        price: '3000.00',
        cummulativeQuoteQty: '0.00',
        time: 1672617600000, // Unix timestamp in milliseconds: 2023-01-02 00:00:00 UTC
      },
    ];

    beforeEach(() => {
      const mockAxiosGet = vi.mocked(axios.get);
      mockAxiosGet.mockClear();

      mockAxiosGet.mockImplementation((url: any) => {
        const urlStr = typeof url === 'string' ? url : url?.toString?.() || '';

        if (urlStr.includes('/api/v3/time')) {
          return Promise.resolve({ data: { serverTime: Date.now() } });
        } else if (urlStr.includes('/api/v3/allOrders')) {
          // Return specific orders based on symbol parameter
          if (urlStr.includes('symbol=BTCUSDT')) {
            return Promise.resolve({
              data: [mockMexcClosedOrdersResponse[0]], // Only BTC order
            });
          } else if (urlStr.includes('symbol=ETHUSDT')) {
            return Promise.resolve({
              data: [mockMexcClosedOrdersResponse[1]], // Only ETH order
            });
          } else {
            return Promise.resolve({
              data: mockMexcClosedOrdersResponse,
            });
          }
        } else {
          return Promise.resolve({ data: { serverTime: Date.now() } });
        }
      });
    });

    it('should include createdAt and exchange fields in MEXC closed orders response', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/mexc/orders/closed',
        payload: {
          baseCoins: ['BTC', 'ETH'],
          quoteCoins: ['USDT'],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.orders).toHaveLength(2);
      expect(body.timestamp).toBeDefined();

      // Verify first order has required enhanced fields
      const order1 = body.orders.find((o: any) => o.orderId === '123456789');
      expect(order1).toBeDefined();
      expect(order1.createdAt).toBe('2023-01-01T00:00:00.000Z');
      expect(order1.exchange).toBe('mexc');

      // Verify second order has required enhanced fields
      const order2 = body.orders.find((o: any) => o.orderId === '987654321');
      expect(order2).toBeDefined();
      expect(order2.createdAt).toBe('2023-01-02T00:00:00.000Z');
      expect(order2.exchange).toBe('mexc');

      // Verify all orders have the enhanced fields
      body.orders.forEach((order: any) => {
        expect(order.createdAt).toBeDefined();
        expect(typeof order.createdAt).toBe('string');
        expect(order.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/); // ISO format
        expect(order.exchange).toBe('mexc');
      });
    });

    it('should handle missing time field gracefully in MEXC orders', async () => {
      const mockResponseWithoutTime = [
        {
          orderId: 111111111,
          clientOrderId: 'mexc-no-time',
          symbol: 'BTCUSDT',
          status: 'FILLED',
          side: 'SELL',
          type: 'LIMIT',
          origQty: '0.001',
          executedQty: '0.001',
          price: '50000.00',
          cummulativeQuoteQty: '50.00',
          // time field is missing
        },
      ];

      vi.mocked(axios.get).mockImplementation((url: any) => {
        const urlStr = typeof url === 'string' ? url : url?.toString?.() || '';

        if (urlStr.includes('/api/v3/time')) {
          return Promise.resolve({ data: { serverTime: Date.now() } });
        } else if (urlStr.includes('/api/v3/allOrders')) {
          return Promise.resolve({
            data: mockResponseWithoutTime,
          });
        } else {
          return Promise.resolve({ data: { serverTime: Date.now() } });
        }
      });

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/mexc/orders/closed',
        payload: {
          baseCoins: ['BTC'],
          quoteCoins: ['USDT'],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.orders).toHaveLength(1);
      const order = body.orders[0];

      // Should have empty createdAt when timestamp is missing and exchange
      expect(order.createdAt).toBeDefined();
      expect(typeof order.createdAt).toBe('string');
      expect(order.createdAt).toBe(''); // Empty string when timestamp is missing
      expect(order.exchange).toBe('mexc');
    });
  });

  describe('Schema Validation', () => {
    it('should validate that all closed orders have required enhanced fields', async () => {
      // Test Kraken first
      const mockKrakenResponse = {
        error: [],
        result: {
          closed: {
            'TEST-ORDER': {
              status: 'closed',
              vol: '1.0',
              vol_exec: '1.0',
              price: '50000.00',
              cost: '50000.00',
              opentm: '1672531200.000',
              descr: {
                pair: 'BTCUSD',
                type: 'sell',
                ordertype: 'market',
              },
            },
          },
        },
      };

      vi.mocked(axios.post).mockResolvedValue({
        data: mockKrakenResponse,
      });

      const krakenResponse = await server.inject({
        method: 'POST',
        url: '/api/v1/kraken/orders/closed',
        payload: {},
      });

      expect(krakenResponse.statusCode).toBe(200);
      const krakenBody = JSON.parse(krakenResponse.body);

      // Verify schema compliance for Kraken
      krakenBody.orders.forEach((order: any) => {
        expect(order).toHaveProperty('orderId');
        expect(order).toHaveProperty('pair');
        expect(order).toHaveProperty('direction');
        expect(order).toHaveProperty('type');
        expect(order).toHaveProperty('status');
        expect(order).toHaveProperty('amount');
        expect(order).toHaveProperty('amountExecuted');
        expect(order).toHaveProperty('price');
        expect(order).toHaveProperty('limitPrice');
        expect(order).toHaveProperty('cost');
        expect(order).toHaveProperty('createdAt'); // New field
        expect(order).toHaveProperty('exchange'); // New field
      });

      // Test MEXC
      const mockMexcResponse = [
        {
          orderId: 123456789,
          symbol: 'BTCUSDT',
          status: 'FILLED',
          side: 'SELL',
          type: 'LIMIT',
          origQty: '0.001',
          executedQty: '0.001',
          price: '50000.00',
          cummulativeQuoteQty: '50.00',
          time: 1672531200000,
        },
      ];

      vi.mocked(axios.get).mockImplementation((url: any) => {
        const urlStr = typeof url === 'string' ? url : url?.toString?.() || '';

        if (urlStr.includes('/api/v3/time')) {
          return Promise.resolve({ data: { serverTime: Date.now() } });
        } else if (urlStr.includes('/api/v3/allOrders')) {
          return Promise.resolve({
            data: mockMexcResponse,
          });
        } else {
          return Promise.resolve({ data: { serverTime: Date.now() } });
        }
      });

      const mexcResponse = await server.inject({
        method: 'POST',
        url: '/api/v1/mexc/orders/closed',
        payload: {
          baseCoins: ['BTC'],
          quoteCoins: ['USDT'],
        },
      });

      expect(mexcResponse.statusCode).toBe(200);
      const mexcBody = JSON.parse(mexcResponse.body);

      // Verify schema compliance for MEXC
      mexcBody.orders.forEach((order: any) => {
        expect(order).toHaveProperty('orderId');
        expect(order).toHaveProperty('pair');
        expect(order).toHaveProperty('direction');
        expect(order).toHaveProperty('type');
        expect(order).toHaveProperty('status');
        expect(order).toHaveProperty('amount');
        expect(order).toHaveProperty('amountExecuted');
        expect(order).toHaveProperty('price');
        expect(order).toHaveProperty('limitPrice');
        expect(order).toHaveProperty('cost');
        expect(order).toHaveProperty('createdAt'); // New field
        expect(order).toHaveProperty('exchange'); // New field
      });
    });
  });
});
