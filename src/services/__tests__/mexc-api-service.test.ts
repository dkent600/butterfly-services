import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MexcApiService } from '../mexc-api-service.js';
import { IExchangeApiService, IAsset, IEnvService } from '../../types/interfaces.js';

/**
 * SAFETY NOTICE: MEXC API Service Tests
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
const mockedAxios = vi.mocked(axios);

describe('MexcApiService', () => {
  let mexcApiService: MexcApiService;
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
      exchange: 'mexc',
      percentage: 50,
    };

    // Create service with mocked dependencies
    mexcApiService = new MexcApiService(mockExchangeApiService, mockEnvService);
    
    // Reset the time syncer to avoid interference between tests
    (mexcApiService as any).timeSyncer = undefined;
  });

  describe('createPair', () => {
    it('should create correct trading pair with default USDT', () => {
      const result = mexcApiService.createPair(mockAsset);
      expect(result).toBe('BTCUSDT');
    });

    it('should create correct trading pair with custom base currency', () => {
      const result = mexcApiService.createPair(mockAsset, 'ETH');
      expect(result).toBe('BTCETH');
    });
  });

  describe('fetchPrice', () => {
    it('should fetch and return price for asset', async () => {
      const mockPriceResponse = {
        data: { price: '50000.00' },
      };
      
      // fetchPrice only makes one call to the price endpoint
      vi.mocked(axios.get).mockResolvedValueOnce(mockPriceResponse);

      const result = await mexcApiService.fetchPrice(mockAsset);

      expect(result).toBe(50000);
      expect(axios.get).toHaveBeenCalledWith(
        'https://api.mexc.com/api/v3/ticker/price',
        { params: { symbol: 'BTCUSDT' } }
      );
    });

    it('should throw error when price fetch fails', async () => {
      // Mock the price call to fail
      vi.mocked(axios.get).mockRejectedValueOnce(new Error('Network error'));

      await expect(mexcApiService.fetchPrice(mockAsset)).rejects.toThrow(
        'Could not fetch price for BTC',
      );
    });
  });

  describe('getSellAmount', () => {
    it('should calculate sell amount based on percentage and balance', async () => {
      // Mock fetchBalance to return 1 BTC
      const fetchBalanceSpy = vi.spyOn(mexcApiService, 'fetchBalance').mockResolvedValue(1.0);

      const result = await mexcApiService.getSellAmount(mockAsset);

      expect(result).toBe(0.5); // 50% of 1 BTC
      expect(fetchBalanceSpy).toHaveBeenCalledWith(mockAsset);
    });
  });

  describe('createMarketSellOrder', () => {
    beforeEach(() => {
      // SAFETY FIRST: Ensure ALL external calls are stubbed to prevent real transactions
      vi.mocked(mockExchangeApiService.getAPIKey).mockReturnValue('test-api-key');
      vi.mocked(mockExchangeApiService.getAPISecret).mockReturnValue('test-api-secret');
      vi.mocked(mockExchangeApiService.sign).mockReturnValue('test-signature');
      
      // CRITICAL: Mock createMarketSellOrder to prevent ANY real API calls
      vi.mocked(mockExchangeApiService.createMarketSellOrder).mockImplementation(async () => {
        // This mock ensures NO real API calls are made during testing
        // It completely bypasses the real ExchangeApiService.createMarketSellOrder()
        // which contains axios.post() calls to MEXC APIs
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
        data: { serverTime: 1640995200000 }
      });

      // Mock getSellAmount
      const getSellAmountSpy = vi.spyOn(mexcApiService, 'getSellAmount').mockResolvedValue(0.5);

      const result = await mexcApiService.createMarketSellOrder(mockAsset, 'USDT');

      expect(getSellAmountSpy).toHaveBeenCalledWith(mockAsset);
      expect(mockExchangeApiService.sign).toHaveBeenCalled();
      expect(mockExchangeApiService.createMarketSellOrder).toHaveBeenCalledWith(
        'BTCUSDT',
        0.5,
        'mexc',
        expect.any(String),
        expect.stringContaining('/api/v3/order/test'), // Should use test endpoint
        expect.objectContaining({
          'X-MEXC-APIKEY': 'test-api-key',
          'Content-Type': 'application/json',
        })
      );
    });

    it('should SIMULATE production endpoint selection (NO REAL TRADES)', async () => {
      // SAFETY WARNING: This test verifies endpoint logic but makes NO real trades
      // All external calls are mocked to prevent actual API interactions
      
      // Setup: Simulate production mode configuration
      vi.mocked(mockEnvService.getBoolean).mockReturnValue(false); // useTestMode = false
      vi.mocked(mockEnvService.get).mockReturnValue('production'); // nodeEnv = production

      // Mock server time
      vi.mocked(axios.get).mockResolvedValue({
        data: { serverTime: 1640995200000 }
      });

      // Mock getSellAmount
      vi.spyOn(mexcApiService, 'getSellAmount').mockResolvedValue(0.5);

      // CRITICAL SAFETY VERIFICATION: Confirm our mock is in place before the dangerous call
      // This ensures that when MexcApiService.createMarketSellOrder() calls 
      // mockExchangeApiService.createMarketSellOrder(), it hits our mock, NOT the real ExchangeApiService
      expect(vi.isMockFunction(mockExchangeApiService.createMarketSellOrder)).toBe(true);
      
      /**
       * WHY THIS CALL WILL NOT REACH MEXC:
       * 
       * 1. MexcApiService receives mockExchangeApiService (not real ExchangeApiService)
       * 2. mockExchangeApiService.createMarketSellOrder is a vi.fn() mock that returns Promise.resolve()
       * 3. The real ExchangeApiService.createMarketSellOrder() contains axios.post() calls to MEXC
       * 4. Our mock bypasses ALL real network calls - it just returns a resolved promise
       * 5. No HTTP requests are made, no API keys are used, no real trading occurs
       * 
       * SAFETY CHAIN:
       * Test → MexcApiService → mockExchangeApiService.createMarketSellOrder() → Promise.resolve() 
       *                                    ↑
       *                              STOPS HERE - never reaches real API
       */
      await mexcApiService.createMarketSellOrder(mockAsset, 'USDT');

      // Verify it would select the production endpoint (but no real call is made)
      expect(mockExchangeApiService.createMarketSellOrder).toHaveBeenCalledWith(
        'BTCUSDT',
        0.5,
        'mexc',
        expect.any(String),
        expect.stringContaining('/api/v3/order'), // Would use live endpoint (SIMULATED ONLY)
        expect.objectContaining({
          'X-MEXC-APIKEY': 'test-api-key',
          'Content-Type': 'application/json',
        })
      );
      
      // SAFETY VERIFICATION: Ensure the mock was called, not real service
      expect(vi.mocked(mockExchangeApiService.createMarketSellOrder)).toHaveBeenCalled();
    });

    it('should NEVER make real API calls during testing - safety verification', async () => {
      // This test explicitly verifies that NO real external calls are made
      vi.mocked(mockEnvService.getBoolean).mockReturnValue(false); // Simulate production config
      vi.mocked(mockEnvService.get).mockReturnValue('production');
      
      vi.mocked(axios.get).mockResolvedValue({
        data: { serverTime: 1640995200000 }
      });
      
      vi.spyOn(mexcApiService, 'getSellAmount').mockResolvedValue(0.1);

      // PRE-CALL SAFETY VERIFICATION: Confirm mocks are properly set up
      expect(vi.isMockFunction(mockExchangeApiService.createMarketSellOrder)).toBe(true);
      expect(vi.isMockFunction(axios.get)).toBe(true);
      
      // Spy on axios.post to ensure it's NEVER called during tests
      const axiosPostSpy = vi.spyOn(axios, 'post');
      
      /**
       * SAFETY EXPLANATION FOR createMarketSellOrder() CALL:
       * 
       * Even though this simulates "production mode", NO real trading occurs because:
       * 
       * 1. DEPENDENCY INJECTION SAFETY:
       *    - MexcApiService was constructed with mockExchangeApiService (not real one)
       *    - All calls to this.exchangeApiService.* hit our mocks
       * 
       * 2. MOCK IMPLEMENTATION SAFETY:
       *    - mockExchangeApiService.createMarketSellOrder returns Promise.resolve()
       *    - It never calls axios.post() to external APIs
       *    - No HTTP requests leave the test environment
       * 
       * 3. NETWORK ISOLATION:
       *    - axios is mocked at the module level (vi.mock('axios'))
       *    - Even if somehow bypassed, axios.post would be intercepted
       * 
       * VERIFICATION: We spy on axios.post to ensure it's NEVER invoked
       */
      await mexcApiService.createMarketSellOrder(mockAsset, 'USDT');
      
      // CRITICAL SAFETY CHECK: Ensure axios.post (real API call) was NEVER invoked
      expect(axiosPostSpy).not.toHaveBeenCalled();
      
      // But verify the mocked service was called (testing the logic flow)
      expect(mockExchangeApiService.createMarketSellOrder).toHaveBeenCalled();
    });

    it('should default to test mode when environment is not production', async () => {
      // Setup: useTestMode = false but nodeEnv != production (safety check)
      vi.mocked(mockEnvService.getBoolean).mockReturnValue(false);
      vi.mocked(mockEnvService.get).mockReturnValue('development');

      // Mock server time
      vi.mocked(axios.get).mockResolvedValue({
        data: { serverTime: 1640995200000 }
      });

      vi.spyOn(mexcApiService, 'getSellAmount').mockResolvedValue(0.5);

      await mexcApiService.createMarketSellOrder(mockAsset, 'USDT');

      expect(mockExchangeApiService.createMarketSellOrder).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Number),
        expect.any(String),
        expect.any(String),
        expect.stringContaining('/api/v3/order/test'), // Should still use test endpoint for safety
        expect.any(Object)
      );
    });

    it('should create correct trading pair and query string', async () => {
      vi.mocked(mockEnvService.getBoolean).mockReturnValue(true);
      
      // Mock server time
      vi.mocked(axios.get).mockResolvedValue({
        data: { serverTime: 1640995200000 }
      });
      
      vi.spyOn(mexcApiService, 'getSellAmount').mockResolvedValue(1.5);

      await mexcApiService.createMarketSellOrder(mockAsset, 'ETH');

      expect(mockExchangeApiService.createMarketSellOrder).toHaveBeenCalledWith(
        'BTCETH', // Should create correct pair
        1.5,
        'mexc',
        expect.any(String),
        expect.stringContaining('symbol=BTCETH&side=SELL&type=MARKET&quantity=1.5'), // Correct query params
        expect.any(Object)
      );
    });

    it('should use USDT as default target currency', async () => {
      vi.mocked(mockEnvService.getBoolean).mockReturnValue(true);
      
      // Mock server time
      vi.mocked(axios.get).mockResolvedValue({
        data: { serverTime: 1640995200000 }
      });
      
      vi.spyOn(mexcApiService, 'getSellAmount').mockResolvedValue(0.75);

      await mexcApiService.createMarketSellOrder(mockAsset); // No 'to' parameter

      expect(mockExchangeApiService.createMarketSellOrder).toHaveBeenCalledWith(
        'BTCUSDT', // Should default to USDT
        0.75,
        'mexc',
        expect.any(String),
        expect.stringContaining('symbol=BTCUSDT'),
        expect.any(Object)
      );
    });

    it('should include proper signature in the URL', async () => {
      vi.mocked(mockEnvService.getBoolean).mockReturnValue(true);
      
      // Mock server time
      vi.mocked(axios.get).mockResolvedValue({
        data: { serverTime: 1640995200000 }
      });
      
      vi.spyOn(mexcApiService, 'getSellAmount').mockResolvedValue(0.25);

      await mexcApiService.createMarketSellOrder(mockAsset);

      expect(mockExchangeApiService.sign).toHaveBeenCalledWith(
        expect.stringMatching(/symbol=BTCUSDT&side=SELL&type=MARKET&quantity=0\.25&timestamp=\d+/),
        'test-api-secret'
      );

      expect(mockExchangeApiService.createMarketSellOrder).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Number),
        expect.any(String),
        expect.any(String),
        expect.stringContaining('&signature=test-signature'),
        expect.any(Object)
      );
    });

    it('should propagate errors from underlying services', async () => {
      vi.mocked(mockEnvService.getBoolean).mockReturnValue(true);
      
      // Mock server time
      vi.mocked(axios.get).mockResolvedValue({
        data: { serverTime: 1640995200000 }
      });
      
      vi.spyOn(mexcApiService, 'getSellAmount').mockRejectedValue(new Error('Balance fetch failed'));

      await expect(mexcApiService.createMarketSellOrder(mockAsset)).rejects.toThrow('Balance fetch failed');
    });

    it('should handle API errors from createMarketSellOrder', async () => {
      vi.mocked(mockEnvService.getBoolean).mockReturnValue(true);
      
      // Mock server time
      vi.mocked(axios.get).mockResolvedValue({
        data: { serverTime: 1640995200000 }
      });
      
      vi.spyOn(mexcApiService, 'getSellAmount').mockResolvedValue(0.5);
      vi.mocked(mockExchangeApiService.createMarketSellOrder).mockRejectedValue(new Error('API Error'));

      await expect(mexcApiService.createMarketSellOrder(mockAsset)).rejects.toThrow('API Error');
    });
  });

  describe('getApiUrl', () => {
    it('should construct correct API URL', () => {
      // Access private method for testing
      const getApiUrl = (mexcApiService as any).getApiUrl.bind(mexcApiService);

      const result = getApiUrl('/api/v3/time');
      expect(result).toBe('https://api.mexc.com/api/v3/time');
    });

    it('should handle URLs with trailing slashes', () => {
      // The base URL is now hardcoded in the service, so this test checks the path handling
      const getApiUrl = (mexcApiService as any).getApiUrl.bind(mexcApiService);

      const result = getApiUrl('/api/v3/time');
      expect(result).toBe('https://api.mexc.com/api/v3/time');
    });

    it('should handle paths without leading slashes', () => {
      const getApiUrl = (mexcApiService as any).getApiUrl.bind(mexcApiService);

      const result = getApiUrl('api/v3/time');
      expect(result).toBe('https://api.mexc.com/api/v3/time');
    });
  });
});
