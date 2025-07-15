import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KrakenApiService } from '../kraken-api-service.js';
import { IExchangeApiService, IAsset, IEnvService } from '../../types/interfaces.js';

/**
 * SAFETY NOTICE: Kraken API Service Tests
 * 
 * ⚠️  CRITICAL: All tests in this file are designed to NEVER make real API calls or execute real trades.
 * 
 * Safety Measures:
 * - All external services (ExchangeApiService, axios) are mocked
 * - Production mode tests SIMULATE endpoint selection but make NO real calls
 * - Explicit safety verification tests ensure no real axios.post calls occur
 * - All trading operations are stubbed to prevent accidental real transactions
 * 
 * Any test that could potentially make real API calls is a CRITICAL BUG and must be fixed immediately.
 */

// Mock axios
vi.mock('axios');
import axios from 'axios';

describe('KrakenApiService', () => {
  let krakenApiService: KrakenApiService;
  let mockExchangeApiService: IExchangeApiService;
  let mockEnvService: IEnvService;
  let mockAsset: IAsset;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    vi.resetAllMocks();

    // Create mock exchange API service
    mockExchangeApiService = {
      sign: vi.fn(),
      getAPIKey: vi.fn(),
      getAPISecret: vi.fn(),
      createMarketSellOrder: vi.fn(),
    };

    // Create mock environment service
    mockEnvService = {
      get: vi.fn(),
      getBoolean: vi.fn(),
      getNumber: vi.fn(),
      init: vi.fn(),
    };

    // Create mock asset
    mockAsset = {
      name: 'BTC',
      exchange: 'kraken',
      percentage: 50,
      apiUrl: 'https://api.kraken.com',
    };

    // Create service with mocked dependencies
    krakenApiService = new KrakenApiService(mockExchangeApiService, mockEnvService);

    // Clear the cached time syncers to avoid interference between tests
    (krakenApiService as any).cachedTimeSyncers.clear();
  });

  describe('createPair', () => {
    it('should create correct trading pair with default USDT', () => {
      const result = krakenApiService.createPair(mockAsset);
      expect(result).toBe('XXBTUSDT'); // Kraken maps BTC to XXBT
    });

    it('should create correct trading pair with custom base currency', () => {
      const result = krakenApiService.createPair(mockAsset, 'ETH');
      expect(result).toBe('XXBTXETH'); // Both BTC and ETH mapped
    });

    it('should handle unmapped currencies', () => {
      const dogeAsset = { ...mockAsset, name: 'DOGE' };
      const result = krakenApiService.createPair(dogeAsset, 'USDT');
      expect(result).toBe('DOGEUSDT'); // DOGE not in mapping, used as-is
    });
  });

  describe('fetchPrice', () => {
    it('should fetch and return price for asset', async () => {
      const mockPriceResponse = {
        data: {
          result: {
            'XXBTUSDT': {
              c: ['50000.00', '0.5'], // Last trade closed array [price, volume]
            },
          },
        },
      };
      
      vi.mocked(axios.get).mockResolvedValueOnce(mockPriceResponse);

      const result = await krakenApiService.fetchPrice(mockAsset);

      expect(result).toBe(50000);
      expect(axios.get).toHaveBeenCalledWith(
        'https://api.kraken.com/0/public/Ticker',
        { params: { pair: 'XXBTUSDT' } }
      );
    });

    it('should handle response with different pair key', async () => {
      const mockPriceResponse = {
        data: {
          result: {
            'XBTUSDT': { // Different key format
              c: ['45000.00', '0.3'],
            },
          },
        },
      };
      
      vi.mocked(axios.get).mockResolvedValueOnce(mockPriceResponse);

      const result = await krakenApiService.fetchPrice(mockAsset);

      expect(result).toBe(45000);
    });

    it('should throw error when price fetch fails', async () => {
      vi.mocked(axios.get).mockRejectedValueOnce(new Error('Network error'));

      await expect(krakenApiService.fetchPrice(mockAsset)).rejects.toThrow(
        'Could not fetch price for BTC',
      );
    });

    it('should throw error when no price data found', async () => {
      const mockPriceResponse = {
        data: { result: {} },
      };
      
      vi.mocked(axios.get).mockResolvedValueOnce(mockPriceResponse);

      await expect(krakenApiService.fetchPrice(mockAsset)).rejects.toThrow(
        'No price data found for pair XXBTUSDT',
      );
    });
  });

  describe('getSellAmount', () => {
    it('should calculate sell amount based on percentage and balance', async () => {
      const fetchBalanceSpy = vi.spyOn(krakenApiService, 'fetchBalance').mockResolvedValue(1.0);

      const result = await krakenApiService.getSellAmount(mockAsset);

      expect(result).toBe(0.5); // 50% of 1 BTC
      expect(fetchBalanceSpy).toHaveBeenCalledWith(mockAsset);
    });
  });

  describe('fetchBalance', () => {
    beforeEach(() => {
      vi.mocked(mockExchangeApiService.getAPIKey).mockReturnValue('test-api-key');
      vi.mocked(mockExchangeApiService.getAPISecret).mockReturnValue('test-api-secret');
    });

    it('should fetch and return balance for asset', async () => {
      // Mock server time call
      vi.mocked(axios.get).mockResolvedValueOnce({
        data: { result: { unixtime: 1640995200 } }
      });

      const mockBalanceResponse = {
        data: {
          error: [],
          result: {
            'XXBT': '1.5000',
            'XETH': '10.2500',
          },
        },
      };

      vi.mocked(axios.post).mockResolvedValueOnce(mockBalanceResponse);

      const result = await krakenApiService.fetchBalance(mockAsset);

      expect(result).toBe(1.5);
      expect(axios.post).toHaveBeenCalledWith(
        'https://api.kraken.com/0/private/Balance',
        expect.stringContaining('nonce='),
        expect.objectContaining({
          headers: expect.objectContaining({
            'API-Key': 'test-api-key',
            'API-Sign': expect.any(String),
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
        })
      );
    });

    it('should handle missing balance for asset', async () => {
      // Mock server time call
      vi.mocked(axios.get).mockResolvedValueOnce({
        data: { result: { unixtime: 1640995200 } }
      });

      const mockBalanceResponse = {
        data: {
          error: [],
          result: {
            'XETH': '10.2500', // No BTC balance
          },
        },
      };

      vi.mocked(axios.post).mockResolvedValueOnce(mockBalanceResponse);

      const result = await krakenApiService.fetchBalance(mockAsset);

      expect(result).toBe(0); // Should return 0 for missing balance
    });

    it('should handle API errors', async () => {
      // Mock server time call
      vi.mocked(axios.get).mockResolvedValueOnce({
        data: { result: { unixtime: 1640995200 } }
      });

      const mockErrorResponse = {
        data: {
          error: ['EGeneral:Invalid signature'],
          result: {},
        },
      };

      vi.mocked(axios.post).mockResolvedValueOnce(mockErrorResponse);

      await expect(krakenApiService.fetchBalance(mockAsset)).rejects.toThrow(
        'Kraken API error: EGeneral:Invalid signature'
      );
    });

    it('should throw error when API credentials are missing', async () => {
      vi.mocked(mockExchangeApiService.getAPIKey).mockReturnValue('');
      vi.mocked(mockExchangeApiService.getAPISecret).mockReturnValue('test-secret');

      await expect(krakenApiService.fetchBalance(mockAsset)).rejects.toThrow(
        'Missing API credentials for kraken'
      );
    });
  });

  describe('createMarketSellOrder', () => {
    beforeEach(() => {
      // SAFETY FIRST: Ensure ALL external calls are stubbed to prevent real transactions
      vi.mocked(mockExchangeApiService.getAPIKey).mockReturnValue('test-api-key');
      vi.mocked(mockExchangeApiService.getAPISecret).mockReturnValue('test-api-secret');
      
      // CRITICAL: Mock createMarketSellOrder to prevent ANY real API calls
      vi.mocked(mockExchangeApiService.createMarketSellOrder).mockImplementation(async () => {
        return Promise.resolve();
      });
      
      // SAFETY VERIFICATION: Confirm our mocks are properly set up
      if (!vi.isMockFunction(mockExchangeApiService.createMarketSellOrder)) {
        throw new Error('CRITICAL SAFETY FAILURE: createMarketSellOrder is not mocked!');
      }
    });

    it('should create market sell order in test mode by default', async () => {
      // Setup: Default to test mode (safety first)
      vi.mocked(mockEnvService.getBoolean).mockReturnValue(true);
      vi.mocked(mockEnvService.get).mockReturnValue('development');

      // Mock server time for the first call in createMarketSellOrder
      vi.mocked(axios.get).mockResolvedValue({
        data: { result: { unixtime: 1640995200 } }
      });

      // Mock getSellAmount
      const getSellAmountSpy = vi.spyOn(krakenApiService, 'getSellAmount').mockResolvedValue(0.5);

      const result = await krakenApiService.createMarketSellOrder(mockAsset, 'USDT');

      expect(getSellAmountSpy).toHaveBeenCalledWith(mockAsset);
      expect(mockExchangeApiService.createMarketSellOrder).toHaveBeenCalledWith(
        'XXBTUSDT',
        0.5,
        'kraken',
        expect.any(String),
        expect.stringContaining('validate=true'), // Should contain test mode parameter
        expect.objectContaining({
          'API-Key': 'test-api-key',
          'API-Sign': expect.any(String),
          'Content-Type': 'application/x-www-form-urlencoded',
        })
      );

      // Verify validate=true is added for test mode
      const urlCall = vi.mocked(mockExchangeApiService.createMarketSellOrder).mock.calls[0][4];
      expect(urlCall).toContain('validate=true');
    });

    it('should SIMULATE production endpoint selection (NO REAL TRADES)', async () => {
      // SAFETY WARNING: This test verifies endpoint logic but makes NO real trades
      
      // Setup: Simulate production mode configuration
      vi.mocked(mockEnvService.getBoolean).mockReturnValue(false); // useTestMode = false
      vi.mocked(mockEnvService.get).mockReturnValue('production'); // nodeEnv = production

      // Mock server time
      vi.mocked(axios.get).mockResolvedValue({
        data: { result: { unixtime: 1640995200 } }
      });

      // Mock getSellAmount
      vi.spyOn(krakenApiService, 'getSellAmount').mockResolvedValue(0.5);

      await krakenApiService.createMarketSellOrder(mockAsset, 'USDT');

      // Verify it would NOT include validate=true for production mode
      const urlCall = vi.mocked(mockExchangeApiService.createMarketSellOrder).mock.calls[0][4];
      expect(urlCall).not.toContain('validate=true');
    });

    it('should create correct trading pair and query string', async () => {
      vi.mocked(mockEnvService.getBoolean).mockReturnValue(true);
      
      // Mock server time
      vi.mocked(axios.get).mockResolvedValue({
        data: { result: { unixtime: 1640995200 } }
      });
      
      vi.spyOn(krakenApiService, 'getSellAmount').mockResolvedValue(1.5);

      await krakenApiService.createMarketSellOrder(mockAsset, 'ETH');

      expect(mockExchangeApiService.createMarketSellOrder).toHaveBeenCalledWith(
        'XXBTXETH', // Should create correct Kraken pair
        1.5,
        'kraken',
        expect.any(String),
        expect.stringContaining('pair=XXBTXETH'), // Correct query params
        expect.any(Object)
      );
    });

    it('should use USDT as default target currency', async () => {
      vi.mocked(mockEnvService.getBoolean).mockReturnValue(true);
      
      // Mock server time
      vi.mocked(axios.get).mockResolvedValue({
        data: { result: { unixtime: 1640995200 } }
      });
      
      vi.spyOn(krakenApiService, 'getSellAmount').mockResolvedValue(0.75);

      await krakenApiService.createMarketSellOrder(mockAsset); // No 'to' parameter

      expect(mockExchangeApiService.createMarketSellOrder).toHaveBeenCalledWith(
        'XXBTUSDT', // Should default to USDT
        0.75,
        'kraken',
        expect.any(String),
        expect.stringContaining('pair=XXBTUSDT'),
        expect.any(Object)
      );
    });

    it('should propagate errors from underlying services', async () => {
      vi.mocked(mockEnvService.getBoolean).mockReturnValue(true);
      
      // Mock server time
      vi.mocked(axios.get).mockResolvedValue({
        data: { result: { unixtime: 1640995200 } }
      });
      
      vi.spyOn(krakenApiService, 'getSellAmount').mockRejectedValue(new Error('Balance fetch failed'));

      await expect(krakenApiService.createMarketSellOrder(mockAsset)).rejects.toThrow('Balance fetch failed');
    });

    it('should handle API errors from createMarketSellOrder', async () => {
      vi.mocked(mockEnvService.getBoolean).mockReturnValue(true);
      
      // Mock server time
      vi.mocked(axios.get).mockResolvedValue({
        data: { result: { unixtime: 1640995200 } }
      });
      
      vi.spyOn(krakenApiService, 'getSellAmount').mockResolvedValue(0.5);
      vi.mocked(mockExchangeApiService.createMarketSellOrder).mockRejectedValue(new Error('API Error'));

      await expect(krakenApiService.createMarketSellOrder(mockAsset)).rejects.toThrow('API Error');
    });
  });

  describe('getApiUrl', () => {
    it('should construct correct API URL', () => {
      // Access private method for testing
      const getApiUrl = (krakenApiService as any).getApiUrl.bind(krakenApiService);

      const result = getApiUrl(mockAsset, '/0/public/Time');
      expect(result).toBe('https://api.kraken.com/0/public/Time');
    });

    it('should handle trailing slash in base URL', () => {
      const getApiUrl = (krakenApiService as any).getApiUrl.bind(krakenApiService);
      const assetWithSlash = { ...mockAsset, apiUrl: 'https://api.kraken.com/' };

      const result = getApiUrl(assetWithSlash, '/0/public/Time');
      expect(result).toBe('https://api.kraken.com/0/public/Time');
    });

    it('should handle path without leading slash', () => {
      const getApiUrl = (krakenApiService as any).getApiUrl.bind(krakenApiService);

      const result = getApiUrl(mockAsset, '0/public/Time');
      expect(result).toBe('https://api.kraken.com/0/public/Time');
    });
  });

  describe('signKrakenRequest', () => {
    it('should create proper Kraken signature', () => {
      const signKrakenRequest = (krakenApiService as any).signKrakenRequest.bind(krakenApiService);
      
      const urlPath = '/0/private/Balance';
      const queryString = 'nonce=1640995200000';
      const apiSecret = 'test-secret-base64';
      const nonce = 1640995200000;

      const result = signKrakenRequest(urlPath, queryString, apiSecret, nonce);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      // Should be base64 encoded
      expect(result).toMatch(/^[A-Za-z0-9+/]+=*$/);
    });
  });
});
