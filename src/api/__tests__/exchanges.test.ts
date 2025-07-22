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

  describe('Kraken Exchange Routes', () => {
    beforeEach(async () => {
      // Mock AssetPairs and Ticker endpoints for Kraken
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
                'XXBTUSDT': { 
                  base: 'XXBT', 
                  quote: 'USDT', 
                  altname: 'BTCUSDT' 
                },
                'XETHXXBT': { 
                  base: 'XETH', 
                  quote: 'XXBT', 
                  altname: 'ETHXBT'  // Real Kraken pair
                },
                'XETHZUSD': { 
                  base: 'XETH', 
                  quote: 'ZUSD', 
                  altname: 'ETHUSD' 
                },
              }
            }
          });
        } else if (url === 'https://api.kraken.com/0/public/Ticker') {
          // Handle Ticker endpoint based on pair parameter
          const pair = config?.params?.pair;
          if (pair === 'BTCUSDT') {
            return Promise.resolve({
              data: {
                result: {
                  'BTCUSDT': {
                    c: ['45000.00', '1.50000000'], // Last trade closed [price, lot volume]
                  }
                }
              }
            });
          } else if (pair === 'ETHXBT') {
            return Promise.resolve({
              data: {
                result: {
                  'ETHXBT': {
                    c: ['0.04000000', '2.50000000'], // ETH priced in BTC
                  }
                }
              }
            });
          }
        }
        // For other URLs, return empty results for now
        return Promise.resolve({ data: { result: {} } });
      });
    });

    describe('GET /api/v1/kraken/price/:asset', () => {
      it('should fetch price for BTC on Kraken', async () => {
        // Mock the axios response for AssetPairs and Ticker endpoints
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
                  'XXBTUSDT': { 
                    base: 'XXBT', 
                    quote: 'USDT', 
                    altname: 'BTCUSDT' 
                  },
                  'XXBTXETH': { 
                    base: 'XXBT', 
                    quote: 'XETH', 
                    altname: 'BTCETH' 
                  },
                  'XETHZUSD': { 
                    base: 'XETH', 
                    quote: 'ZUSD', 
                    altname: 'ETHUSD' 
                  },
                }
              }
            });
          } else if (url === 'https://api.kraken.com/0/public/Ticker') {
            const pair = config?.params?.pair;
            if (pair === 'BTCUSDT') {
              return Promise.resolve({
                data: { 
                  result: {
                    'BTCUSDT': {  // Use altname since createPair returns altname
                      c: ['50000.00', '0.5'], // Kraken format: [price, volume]
                    },
                  },
                },
              });
            }
          }
          return Promise.resolve({ data: { result: {} } });
        });

        const response = await server.inject({
          method: 'GET',
          url: '/api/v1/kraken/price/btc?to=USDT',
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);

        expect(body.asset).toBe('BTC');
        expect(body.price).toBe(50000);
        expect(body.pair).toBe('BTCUSDT'); // Returns altname, not full key
        expect(body.timestamp).toBeDefined();
      });

      it('should handle custom target currency', async () => {
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
                  'XXBTUSDT': { 
                    base: 'XXBT', 
                    quote: 'USDT', 
                    altname: 'BTCUSDT' 
                  },
                  'XETHZUSD': { 
                    base: 'XETH', 
                    quote: 'ZUSD', 
                    altname: 'ETHUSD'  // ETH to USD pair
                  },
                }
              }
            });
          } else if (url === 'https://api.kraken.com/0/public/Ticker') {
            const pair = config?.params?.pair;
            if (pair === 'ETHUSD') {
              return Promise.resolve({
                data: { 
                  result: {
                    'ETHUSD': {  // Use altname since createPair returns altname
                      c: ['2500.00', '1.5'],  // ETH priced in USD
                    },
                  },
                },
              });
            }
          }
          return Promise.resolve({ data: { result: {} } });
        });

        const response = await server.inject({
          method: 'GET',
          url: '/api/v1/kraken/price/eth?to=USD',  // ETH to USD (a real pair)
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);

        expect(body.pair).toBe('ETHUSD');  // Real Kraken pair
      });

      it('should fetch price with default parameters', async () => {
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
                  'XXBTUSDT': { 
                    base: 'XXBT', 
                    quote: 'USDT', 
                    altname: 'BTCUSDT' 
                  },
                  'XXBTXETH': { 
                    base: 'XXBT', 
                    quote: 'XETH', 
                    altname: 'BTCETH' 
                  },
                  'XETHZUSD': { 
                    base: 'XETH', 
                    quote: 'ZUSD', 
                    altname: 'ETHUSD' 
                  },
                }
              }
            });
          } else if (url === 'https://api.kraken.com/0/public/Ticker') {
            const pair = config?.params?.pair;
            if (pair === 'BTCUSDT') {
              return Promise.resolve({
                data: { 
                  result: {
                    'BTCUSDT': {  // Use altname since createPair returns altname
                      c: ['50000.00', '0.5'],
                    },
                  },
                },
              });
            }
          }
          return Promise.resolve({ data: { result: {} } });
        });

        const response = await server.inject({
          method: 'GET',
          url: '/api/v1/kraken/price/btc?to=USDT',
        });

        expect(response.statusCode).toBe(200);
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
          url: '/api/v1/kraken/balance/btc',
        });

        if (response.statusCode !== 200) {
          console.log('Kraken balance test error response:', response.body);
        }

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);

        expect(body.asset).toBe('BTC');
        expect(body.balance).toBe(1.5);
        expect(body.timestamp).toBeDefined();
      });
    });

    describe('POST /api/v1/kraken/orders/sell/market', () => {
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
          } else if (urlStr.includes('/0/public/AssetPairs')) {
            // AssetPairs endpoint
            return Promise.resolve({
              data: {
                result: {
                  'XXBTZUSD': { 
                    base: 'XXBT', 
                    quote: 'ZUSD', 
                    altname: 'XBTUSD' 
                  },
                  'XXBTUSDT': { 
                    base: 'XXBT', 
                    quote: 'USDT', 
                    altname: 'BTCUSDT' 
                  },
                  'XXBTXETH': { 
                    base: 'XXBT', 
                    quote: 'XETH', 
                    altname: 'BTCETH' 
                  },
                  'XETHZUSD': { 
                    base: 'XETH', 
                    quote: 'ZUSD', 
                    altname: 'ETHUSD' 
                  },
                }
              }
            });
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

        const response = await server.inject({
          method: 'POST',
          url: '/api/v1/kraken/orders/sell/market',
          payload: { name: 'BTC', amount: 50, to: 'USDT' },
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
        expect(body.quantity).toBe(50);
      });
    });

    describe('POST /api/v1/kraken/orders/sell/limit', () => {
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

          if (urlStr.includes('/0/public/Time')) {
            // Server time endpoint
            return Promise.resolve({ data: { result: { unixtime: 1640995200 } } });
          } else if (urlStr.includes('/0/public/AssetPairs')) {
            // AssetPairs endpoint
            return Promise.resolve({
              data: {
                result: {
                  'XXBTZUSD': { 
                    base: 'XXBT', 
                    quote: 'ZUSD', 
                    altname: 'XBTUSD' 
                  },
                  'XXBTUSDT': { 
                    base: 'XXBT', 
                    quote: 'USDT', 
                    altname: 'BTCUSDT' 
                  },
                  'XXBTXETH': { 
                    base: 'XXBT', 
                    quote: 'XETH', 
                    altname: 'BTCETH' 
                  },
                  'XETHZUSD': { 
                    base: 'XETH', 
                    quote: 'ZUSD', 
                    altname: 'ETHUSD' 
                  },
                }
              }
            });
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

        const response = await server.inject({
          method: 'POST',
          url: '/api/v1/kraken/orders/sell/limit',
          payload: { name: 'BTC', amount: 50, price: 48000.75, to: 'USDT' },
        });

        if (response.statusCode !== 200) {
          console.log('Kraken limit sell order test error response:', response.body);
          console.log('axios.get call count:', mockAxiosGet.mock.calls.length);
          console.log('axios.post call count:', mockAxiosPost.mock.calls.length);
          console.log('Get call URLs:', mockAxiosGet.mock.calls.map(call => call[0]));
        }

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);

        expect(body.success).toBe(true);
        expect(body.asset).toBe('BTC');
        expect(body.quantity).toBe(50);
        expect(body.price).toBe(48000.75);
      });

      it('should reject limit order without price', async () => {
        const response = await server.inject({
          method: 'POST',
          url: '/api/v1/kraken/orders/sell/limit',
          payload: { name: 'BTC', amount: 50, to: 'USDT' },  // Missing price
        });

        expect(response.statusCode).toBe(400);
      });

      it('should reject limit order with invalid price', async () => {
        const response = await server.inject({
          method: 'POST',
          url: '/api/v1/kraken/orders/sell/limit',
          payload: { name: 'BTC', amount: 50, price: 0, to: 'USDT' },  // Invalid zero price
        });

        expect(response.statusCode).toBe(400);
      });
    });

    describe('GET /api/v1/kraken/orders/opened', () => {
      it('should fetch open orders from Kraken', async () => {
        // Set up flexible mocking based on URL patterns
        const mockAxiosGet = vi.mocked(axios.get);
        const mockAxiosPost = vi.mocked(axios.post);

        // Clear any previous calls
        mockAxiosGet.mockClear();
        mockAxiosPost.mockClear();

        // Mock based on URL patterns
        mockAxiosGet.mockImplementation((url: any) => {
          const urlStr = typeof url === 'string' ? url : (url)?.toString?.() || '';

          if (urlStr.includes('/0/public/Time')) {
            return Promise.resolve({ data: { result: { unixtime: 1640995200 } } });
          } else if (urlStr.includes('/0/public/AssetPairs')) {
            return Promise.resolve({
              data: {
                result: {
                  'XXBTZUSD': { base: 'XXBT', quote: 'ZUSD', altname: 'XBTUSD' },
                  'XXBTUSDT': { base: 'XXBT', quote: 'USDT', altname: 'BTCUSDT' },
                }
              }
            });
          }

          return Promise.resolve({ data: { result: { unixtime: Date.now() / 1000 } } });
        });

        // Mock POST for open orders endpoint
        mockAxiosPost.mockImplementation((url: any) => {
          const urlStr = typeof url === 'string' ? url : (url)?.toString?.() || '';

          if (urlStr.includes('/0/private/OpenOrders')) {
            return Promise.resolve({
              data: {
                error: [],
                result: {
                  open: {
                    'OGTT3Y-C6I3P-XRI6HX': {
                      refid: null,
                      userref: 0,
                      status: 'open',
                      opentm: 1688635200.123,
                      starttm: 0,
                      expiretm: 0,
                      descr: {
                        pair: 'XBTUSD',
                        type: 'sell',
                        ordertype: 'limit',
                        price: '50000.0',
                        price2: '0',
                        leverage: 'none',
                        order: 'sell 0.5 XBTUSD @ limit 50000.0',
                        close: ''
                      },
                      vol: '0.50000000',
                      vol_exec: '0.00000000',
                      cost: '0.00000000',
                      fee: '0.00000000',
                      price: '0.00000000',
                      stopprice: '0.00000000',
                      limitprice: '0.00000000',
                      misc: '',
                      oflags: 'fciq'
                    }
                  }
                }
              },
              statusText: 'OK',
            });
          }

          return Promise.resolve({ data: { error: [], result: {} }, statusText: 'OK' });
        });

        const response = await server.inject({
          method: 'GET',
          url: '/api/v1/kraken/orders/opened',
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);

        expect(body.orders).toBeDefined();
        expect(body.timestamp).toBeDefined();
        expect(Array.isArray(body.orders)).toBe(true);
        expect(body.orders.length).toBe(1);
        expect(body.orders[0].status).toBe('open');
        expect(body.orders[0].descr.type).toBe('sell');
      });

      it('should handle empty open orders response', async () => {
        const mockAxiosGet = vi.mocked(axios.get);
        const mockAxiosPost = vi.mocked(axios.post);

        mockAxiosGet.mockClear();
        mockAxiosPost.mockClear();

        mockAxiosGet.mockImplementation((url: any) => {
          const urlStr = typeof url === 'string' ? url : (url)?.toString?.() || '';
          if (urlStr.includes('/0/public/Time')) {
            return Promise.resolve({ data: { result: { unixtime: 1640995200 } } });
          }
          return Promise.resolve({ data: { result: { unixtime: Date.now() / 1000 } } });
        });

        mockAxiosPost.mockImplementation((url: any) => {
          const urlStr = typeof url === 'string' ? url : (url)?.toString?.() || '';
          if (urlStr.includes('/0/private/OpenOrders')) {
            return Promise.resolve({
              data: { error: [], result: { open: {} } },
              statusText: 'OK',
            });
          }
          return Promise.resolve({ data: { error: [], result: {} }, statusText: 'OK' });
        });

        const response = await server.inject({
          method: 'GET',
          url: '/api/v1/kraken/orders/opened',
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);

        expect(Array.isArray(body.orders)).toBe(true);
        expect(body.orders).toEqual([]);
        expect(body.timestamp).toBeDefined();
      });
    });

    describe('GET /api/v1/kraken/orders/closed', () => {
      it('should fetch closed orders from Kraken', async () => {
        // Set up flexible mocking based on URL patterns
        const mockAxiosGet = vi.mocked(axios.get);
        const mockAxiosPost = vi.mocked(axios.post);

        // Clear any previous calls
        mockAxiosGet.mockClear();
        mockAxiosPost.mockClear();

        // Mock based on URL patterns
        mockAxiosGet.mockImplementation((url: any) => {
          const urlStr = typeof url === 'string' ? url : (url)?.toString?.() || '';

          if (urlStr.includes('/0/public/Time')) {
            return Promise.resolve({ data: { result: { unixtime: 1640995200 } } });
          } else if (urlStr.includes('/0/public/AssetPairs')) {
            return Promise.resolve({
              data: {
                result: {
                  'XXBTZUSD': { base: 'XXBT', quote: 'ZUSD', altname: 'XBTUSD' },
                  'XXBTUSDT': { base: 'XXBT', quote: 'USDT', altname: 'BTCUSDT' },
                }
              }
            });
          }

          return Promise.resolve({ data: { result: { unixtime: Date.now() / 1000 } } });
        });

        // Mock POST for closed orders endpoint
        mockAxiosPost.mockImplementation((url: any) => {
          const urlStr = typeof url === 'string' ? url : (url)?.toString?.() || '';

          if (urlStr.includes('/0/private/ClosedOrders')) {
            return Promise.resolve({
              data: {
                error: [],
                result: {
                  closed: {
                    'OGTT3Y-C6I3P-XRI6HX': {
                      refid: null,
                      userref: 0,
                      status: 'closed',
                      reason: 'User requested',
                      opentm: 1688635200.123,
                      closetm: 1688635260.456,
                      starttm: 0,
                      expiretm: 0,
                      descr: {
                        pair: 'XBTUSD',
                        type: 'sell',
                        ordertype: 'market',
                        price: '0',
                        price2: '0',
                        leverage: 'none',
                        order: 'sell 0.5 XBTUSD @ market',
                        close: ''
                      },
                      vol: '0.50000000',
                      vol_exec: '0.50000000',
                      cost: '25000.00000',
                      fee: '65.00000',
                      price: '50000.00000',
                      stopprice: '0.00000000',
                      limitprice: '0.00000000',
                      misc: '',
                      oflags: 'fciq'
                    }
                  },
                  count: 1
                }
              },
              statusText: 'OK',
            });
          }

          return Promise.resolve({ data: { error: [], result: {} }, statusText: 'OK' });
        });

        const response = await server.inject({
          method: 'GET',
          url: '/api/v1/kraken/orders/closed',
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);

        expect(body.orders).toBeDefined();
        expect(body.timestamp).toBeDefined();
        expect(Array.isArray(body.orders)).toBe(true);
        expect(body.orders.length).toBe(1);
        expect(body.orders[0].status).toBe('closed');
        expect(body.orders[0].reason).toBe('User requested');
        expect(body.orders[0].vol_exec).toBe('0.50000000');
      });

      it('should handle empty closed orders response', async () => {
        const mockAxiosGet = vi.mocked(axios.get);
        const mockAxiosPost = vi.mocked(axios.post);

        mockAxiosGet.mockClear();
        mockAxiosPost.mockClear();

        mockAxiosGet.mockImplementation((url: any) => {
          const urlStr = typeof url === 'string' ? url : (url)?.toString?.() || '';
          if (urlStr.includes('/0/public/Time')) {
            return Promise.resolve({ data: { result: { unixtime: 1640995200 } } });
          }
          return Promise.resolve({ data: { result: { unixtime: Date.now() / 1000 } } });
        });

        mockAxiosPost.mockImplementation((url: any) => {
          const urlStr = typeof url === 'string' ? url : (url)?.toString?.() || '';
          if (urlStr.includes('/0/private/ClosedOrders')) {
            return Promise.resolve({
              data: { error: [], result: { closed: {}, count: 0 } },
              statusText: 'OK',
            });
          }
          return Promise.resolve({ data: { error: [], result: {} }, statusText: 'OK' });
        });

        const response = await server.inject({
          method: 'GET',
          url: '/api/v1/kraken/orders/closed',
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);

        expect(Array.isArray(body.orders)).toBe(true);
        expect(body.orders).toEqual([]);
        expect(body.timestamp).toBeDefined();
      });
    });

    describe('DELETE /api/v1/kraken/orders/cancel/:txid', () => {
      it('should cancel an order successfully', async () => {
        const mockCancelResponse = {
          error: [],
          result: {
            count: 1,
            pending: false,
          },
        };

        (axios.post as any).mockImplementation(() => {
          return Promise.resolve({ data: mockCancelResponse, statusText: 'OK' });
        });

        const response = await server.inject({
          method: 'DELETE',
          url: '/api/v1/kraken/orders/cancel/OQCLML-BW3P3-BUCMWZ',
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);

        expect(body.count).toBe(1);
        expect(body.pending).toBe(false);
        expect(body.timestamp).toBeDefined();

        // Verify the API call was made correctly
        expect(axios.post).toHaveBeenCalledWith(
          'https://api.kraken.com/0/private/CancelOrder',
          expect.stringContaining('nonce='),
          expect.objectContaining({
            headers: expect.objectContaining({
              'API-Key': 'mock-kraken-api-key',
              'API-Sign': expect.any(String),
              'Content-Type': 'application/x-www-form-urlencoded',
              'User-Agent': 'butterfly-services/1.0',
            }),
          }),
        );

        // Verify the post data contains the transaction ID
        const postData = (axios.post as any).mock.calls[0][1];
        expect(postData).toContain('txid=OQCLML-BW3P3-BUCMWZ');
      });

      it('should handle Kraken API error for cancel order', async () => {
        const mockErrorResponse = {
          error: ['EOrder:Unknown order'],
          result: null,
        };

        (axios.post as any).mockImplementation(() => {
          return Promise.resolve({ data: mockErrorResponse, statusText: 'OK' });
        });

        const response = await server.inject({
          method: 'DELETE',
          url: '/api/v1/kraken/orders/cancel/INVALID-ORDER-ID',
        });

        expect(response.statusCode).toBe(500);
        const body = JSON.parse(response.body);

        expect(body.error).toBe('InternalServerError');
        expect(body.message).toContain('Kraken API error: EOrder:Unknown order');
        expect(body.timestamp).toBeDefined();
      });

      it('should handle network error for cancel order', async () => {
        (axios.post as any).mockImplementation(() => {
          return Promise.reject(new Error('Network error'));
        });

        const response = await server.inject({
          method: 'DELETE',
          url: '/api/v1/kraken/orders/cancel/OQCLML-BW3P3-BUCMWZ',
        });

        expect(response.statusCode).toBe(500);
        const body = JSON.parse(response.body);

        expect(body.error).toBe('InternalServerError');
        expect(body.message).toContain('Failed to cancel kraken order');
        expect(body.timestamp).toBeDefined();
      });

      it('should handle cancel order with pending status', async () => {
        const mockPendingResponse = {
          error: [],
          result: {
            count: 1,
            pending: true,
          },
        };

        (axios.post as any).mockImplementation(() => {
          return Promise.resolve({ data: mockPendingResponse, statusText: 'OK' });
        });

        const response = await server.inject({
          method: 'DELETE',
          url: '/api/v1/kraken/orders/cancel/OQCLML-BW3P3-BUCMWZ',
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);

        expect(body.count).toBe(1);
        expect(body.pending).toBe(true);
        expect(body.timestamp).toBeDefined();
      });

      it('should handle empty result for cancel order', async () => {
        (axios.post as any).mockImplementation(() => {
          return Promise.resolve({ data: { error: [], result: null }, statusText: 'OK' });
        });

        const response = await server.inject({
          method: 'DELETE',
          url: '/api/v1/kraken/orders/cancel/OQCLML-BW3P3-BUCMWZ',
        });

        expect(response.statusCode).toBe(500);
        const body = JSON.parse(response.body);

        expect(body.error).toBe('InternalServerError');
        expect(body.message).toContain('kraken API returned empty result');
        expect(body.timestamp).toBeDefined();
      });
    });
  });
});
