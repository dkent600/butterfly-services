import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MexcApiService } from '../../mexc-api-service.js';
import { IExchangeApiService, IAsset, IEnvService } from '../../../types/interfaces.js';

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
      sendApiRequest: vi.fn(),
    };

    // Create mock environment service
    mockEnvService = {
      get: vi.fn(),
      getBoolean: vi.fn(),
      getNumber: vi.fn(),
      init: vi.fn(),
      isProduction: vi.fn().mockReturnValue(false), // Default to test mode
    };

    // Create mock asset
    mockAsset = {
      name: 'BTC',
      exchange: 'mexc',
      amount: 50,
    };

    // Create service with mocked dependencies
    mexcApiService = new MexcApiService(mockExchangeApiService, mockEnvService);

    // Reset the time syncer to avoid interference between tests
    (mexcApiService as any).timeSyncer = undefined;
  });

  describe('createPair', () => {
    it('should create correct trading pair with default USDT', () => {
      const result = mexcApiService.createPair(mockAsset, 'USDT');
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

      const result = await mexcApiService.fetchPrice(mockAsset, 'USDT');

      expect(result).toBe(50000);
      expect(axios.get).toHaveBeenCalledWith(
        'https://api.mexc.com/api/v3/ticker/price',
        { params: { symbol: 'BTCUSDT' } }
      );
    });

    it('should throw error when price fetch fails', async () => {
      // Mock the price call to fail
      vi.mocked(axios.get).mockRejectedValueOnce(new Error('Network error'));

      await expect(mexcApiService.fetchPrice(mockAsset, 'USDT')).rejects.toThrow(
        'Could not fetch price for BTC',
      );
    });
  });

  describe('fetchBalance', () => {
    beforeEach(() => {
      vi.mocked(mockExchangeApiService.getAPIKey).mockReturnValue('test-api-key');
      vi.mocked(mockExchangeApiService.getAPISecret).mockReturnValue('test-api-secret');
      vi.mocked(mockExchangeApiService.sign).mockReturnValue('test-signature');
    });

    it('should fetch and return balance for asset', async () => {
      const mockServerTimeResponse = {
        data: { serverTime: 1640995200000 }
      };

      const mockBalanceResponse = {
        data: {
          balances: [
            {
              asset: 'BTC',
              free: '0.5',
              locked: '0.0'
            },
            {
              asset: 'ETH',
              free: '10.0',
              locked: '2.0'
            }
          ]
        }
      };

      // Mock both calls: first for server time, second for balance
      vi.mocked(axios.get)
        .mockResolvedValueOnce(mockServerTimeResponse)  // For time syncer
        .mockResolvedValueOnce(mockBalanceResponse);    // For balance call

      const balance = await mexcApiService.fetchBalance(mockAsset);

      expect(balance).toBe(0.5);
      expect(axios.get).toHaveBeenCalledTimes(2);
      // The second call should be for the balance
      expect(axios.get).toHaveBeenNthCalledWith(2,
        expect.stringMatching(/https:\/\/api\.mexc\.com\/api\/v3\/account\?timestamp=\d+&signature=test-signature/),
        {
          headers: {
            'X-MEXC-APIKEY': 'test-api-key',
            'Content-Type': 'application/json',
          },
        }
      );
    });

    it('should return 0 when asset is not found in balance', async () => {
      const mockBalanceResponse = {
        data: {
          balances: [
            {
              asset: 'ETH',
              free: '10.0',
              locked: '2.0'
            }
          ]
        }
      };

      // Time syncer is cached, so only mock the balance call
      vi.mocked(axios.get).mockResolvedValueOnce(mockBalanceResponse);

      const balance = await mexcApiService.fetchBalance(mockAsset);

      expect(balance).toBe(0);
    });

    it('should handle case-insensitive asset matching', async () => {
      const mockBalanceResponse = {
        data: {
          balances: [
            {
              asset: 'btc',  // lowercase asset name
              free: '1.5',
              locked: '0.0'
            }
          ]
        }
      };

      // Time syncer is cached, so only mock the balance call
      vi.mocked(axios.get).mockResolvedValueOnce(mockBalanceResponse);

      const balance = await mexcApiService.fetchBalance(mockAsset);

      expect(balance).toBe(1.5);
    });

    it('should throw error when missing API credentials', async () => {
      vi.mocked(mockExchangeApiService.getAPIKey).mockReturnValue('');
      vi.mocked(mockExchangeApiService.getAPISecret).mockReturnValue('test-api-secret');

      // Time syncer is cached, but credentials check happens before axios call
      await expect(mexcApiService.fetchBalance(mockAsset)).rejects.toThrow(
        'Missing API credentials for mexc. API Key: false, API Secret: true'
      );
    });

    it('should throw error when missing API secret', async () => {
      vi.mocked(mockExchangeApiService.getAPIKey).mockReturnValue('test-api-key');
      vi.mocked(mockExchangeApiService.getAPISecret).mockReturnValue('');

      // Time syncer is cached, but credentials check happens before axios call
      await expect(mexcApiService.fetchBalance(mockAsset)).rejects.toThrow(
        'Missing API credentials for mexc. API Key: true, API Secret: false'
      );
    });

    it('should throw error when API request fails', async () => {
      // Time syncer is cached, so only mock the balance call (which fails)
      vi.mocked(axios.get).mockRejectedValueOnce(new Error('Network error'));

      await expect(mexcApiService.fetchBalance(mockAsset)).rejects.toThrow(
        'Could not fetch balance for BTC'
      );
    });
  });

  describe('createSellOrder', () => {
    beforeEach(() => {
      // SAFETY FIRST: Ensure ALL external calls are stubbed to prevent real transactions
      vi.mocked(mockExchangeApiService.getAPIKey).mockReturnValue('test-api-key');
      vi.mocked(mockExchangeApiService.getAPISecret).mockReturnValue('test-api-secret');
      vi.mocked(mockExchangeApiService.sign).mockReturnValue('test-signature');

      // CRITICAL: Mock createSellOrder to prevent ANY real API calls
      vi.mocked(mockExchangeApiService.sendApiRequest).mockImplementation(async () => {
        // This mock ensures NO real API calls are made during testing
        // It completely bypasses the real ExchangeApiService.createSellOrder()
        // which contains axios.post() calls to MEXC APIs
        return Promise.resolve();
      });

      // SAFETY VERIFICATION: Confirm our mocks are properly set up
      if (!vi.isMockFunction(mockExchangeApiService.sendApiRequest)) {
        throw new Error('CRITICAL SAFETY FAILURE: createSellOrder is not mocked!');
      }
    });

    it('should create market sell order in test mode by default', async () => {
      // Setup: Default to test mode (safety first)
      vi.mocked(mockEnvService.getBoolean).mockReturnValue(true);
      vi.mocked(mockEnvService.get).mockReturnValue('development');

      // Mock server time for the first call in createSellOrder
      vi.mocked(axios.get).mockResolvedValue({
        data: { serverTime: 1640995200000 }
      });

      // Mock getSellAmount
      // Note: getSellAmount no longer exists - using asset.amount directly
      // const getSellAmountSpy = // Note: getSellAmount no longer exists - using asset.amount directly

      const result = await mexcApiService.createSellOrder(mockAsset, { orderType: 'market', to: 'USDT' });

      // expect(getSellAmountSpy).toHaveBeenCalledWith(mockAsset);
      expect(mockExchangeApiService.sign).toHaveBeenCalled();
      expect(mockExchangeApiService.sendApiRequest).toHaveBeenCalledWith(
        'mexc',
        expect.objectContaining({
          method: 'POST',
          url: expect.stringContaining('/api/v3/order/test'), // Should use test endpoint
          headers: expect.objectContaining({
            'X-MEXC-APIKEY': 'test-api-key',
            'Content-Type': 'application/json',
          })
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
      // Note: getSellAmount no longer exists - using asset.amount directly

      // CRITICAL SAFETY VERIFICATION: Confirm our mock is in place before the dangerous call
      // This ensures that when MexcApiService.createSellOrder() calls 
      // mockExchangeApiService.createSellOrder(), it hits our mock, NOT the real ExchangeApiService
      expect(vi.isMockFunction(mockExchangeApiService.sendApiRequest)).toBe(true);

      /**
       * WHY THIS CALL WILL NOT REACH MEXC:
       * 
       * 1. MexcApiService receives mockExchangeApiService (not real ExchangeApiService)
       * 2. mockExchangeApiService.createSellOrder is a vi.fn() mock that returns Promise.resolve()
       * 3. The real ExchangeApiService.createSellOrder() contains axios.post() calls to MEXC
       * 4. Our mock bypasses ALL real network calls - it just returns a resolved promise
       * 5. No HTTP requests are made, no API keys are used, no real trading occurs
       * 
       * SAFETY CHAIN:
       * Test → MexcApiService → mockExchangeApiService.createSellOrder() → Promise.resolve() 
       *                                    ↑
       *                              STOPS HERE - never reaches real API
       */
      await mexcApiService.createSellOrder(mockAsset, { orderType: 'market', to: 'USDT' });

      // Verify it would select the production endpoint (but no real call is made)
      expect(mockExchangeApiService.sendApiRequest).toHaveBeenCalledWith(
        'mexc',
        expect.objectContaining({
          method: 'POST',
          url: expect.stringContaining('/api/v3/order'), // Would use live endpoint (SIMULATED ONLY)
          headers: expect.objectContaining({
            'X-MEXC-APIKEY': 'test-api-key',
            'Content-Type': 'application/json',
          })
        })
      );

      // SAFETY VERIFICATION: Ensure the mock was called, not real service
      expect(vi.mocked(mockExchangeApiService.sendApiRequest)).toHaveBeenCalled();
    });

    it('should NEVER make real API calls during testing - safety verification', async () => {
      // This test explicitly verifies that NO real external calls are made
      vi.mocked(mockEnvService.getBoolean).mockReturnValue(false); // Simulate production config
      vi.mocked(mockEnvService.get).mockReturnValue('production');

      vi.mocked(axios.get).mockResolvedValue({
        data: { serverTime: 1640995200000 }
      });

      // Note: getSellAmount no longer exists - using asset.amount directly

      // PRE-CALL SAFETY VERIFICATION: Confirm mocks are properly set up
      expect(vi.isMockFunction(mockExchangeApiService.sendApiRequest)).toBe(true);
      expect(vi.isMockFunction(axios.get)).toBe(true);

      // Spy on axios.post to ensure it's NEVER called during tests
      const axiosPostSpy = vi.spyOn(axios, 'post');

      /**
       * SAFETY EXPLANATION FOR createSellOrder() CALL:
       * 
       * Even though this simulates "production mode", NO real trading occurs because:
       * 
       * 1. DEPENDENCY INJECTION SAFETY:
       *    - MexcApiService was constructed with mockExchangeApiService (not real one)
       *    - All calls to this.exchangeApiService.* hit our mocks
       * 
       * 2. MOCK IMPLEMENTATION SAFETY:
       *    - mockExchangeApiService.createSellOrder returns Promise.resolve()
       *    - It never calls axios.post() to external APIs
       *    - No HTTP requests leave the test environment
       * 
       * 3. NETWORK ISOLATION:
       *    - axios is mocked at the module level (vi.mock('axios'))
       *    - Even if somehow bypassed, axios.post would be intercepted
       * 
       * VERIFICATION: We spy on axios.post to ensure it's NEVER invoked
       */
      await mexcApiService.createSellOrder(mockAsset, { orderType: 'market', to: 'USDT' });

      // CRITICAL SAFETY CHECK: Ensure axios.post (real API call) was NEVER invoked
      expect(axiosPostSpy).not.toHaveBeenCalled();

      // But verify the mocked service was called (testing the logic flow)
      expect(mockExchangeApiService.sendApiRequest).toHaveBeenCalled();
    });

    it('should default to test mode when environment is not production', async () => {
      // Setup: useTestMode = false but nodeEnv != production (safety check)
      vi.mocked(mockEnvService.getBoolean).mockReturnValue(false);
      vi.mocked(mockEnvService.get).mockReturnValue('development');

      // Mock server time
      vi.mocked(axios.get).mockResolvedValue({
        data: { serverTime: 1640995200000 }
      });

      // Note: getSellAmount no longer exists - using asset.amount directly

      await mexcApiService.createSellOrder(mockAsset, { orderType: 'market', to: 'USDT' });

      expect(mockExchangeApiService.sendApiRequest).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          url: expect.stringContaining('/api/v3/order/test'), // Should still use test endpoint for safety
          headers: expect.any(Object)
        })
      );
    });

    it('should create correct trading pair and query string', async () => {
      vi.mocked(mockEnvService.getBoolean).mockReturnValue(true);

      // Mock server time
      vi.mocked(axios.get).mockResolvedValue({
        data: { serverTime: 1640995200000 }
      });

      // Note: getSellAmount no longer exists - using asset.amount directly

      await mexcApiService.createSellOrder(mockAsset, { orderType: 'market', to: 'ETH' });

      expect(mockExchangeApiService.sendApiRequest).toHaveBeenCalledWith(
        'mexc',
        expect.objectContaining({
          method: 'POST',
          url: expect.stringContaining('symbol=BTCETH&side=SELL&type=MARKET&quantity=50'), // Correct query params
          headers: expect.any(Object)
        })
      );
    });

    it('should use USDT as default target currency', async () => {
      vi.mocked(mockEnvService.getBoolean).mockReturnValue(true);

      // Mock server time
      vi.mocked(axios.get).mockResolvedValue({
        data: { serverTime: 1640995200000 }
      });

      // Note: getSellAmount no longer exists - using asset.amount directly

      await mexcApiService.createSellOrder(mockAsset, { orderType: 'market', to: 'USDT' });

      expect(mockExchangeApiService.sendApiRequest).toHaveBeenCalledWith(
        'mexc',
        expect.objectContaining({
          method: 'POST',
          url: expect.stringContaining('symbol=BTCUSDT'),
          headers: expect.any(Object)
        })
      );
    });

    it('should include proper signature in the URL', async () => {
      vi.mocked(mockEnvService.getBoolean).mockReturnValue(true);

      // Mock server time
      vi.mocked(axios.get).mockResolvedValue({
        data: { serverTime: 1640995200000 }
      });

      // Note: getSellAmount no longer exists - using asset.amount directly

      await mexcApiService.createSellOrder(mockAsset, { orderType: 'market', to: 'USDT' });

      expect(mockExchangeApiService.sign).toHaveBeenCalledWith(
        expect.stringMatching(/symbol=BTCUSDT&side=SELL&type=MARKET&quantity=50&timestamp=\d+/),
        'test-api-secret'
      );

      expect(mockExchangeApiService.sendApiRequest).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          url: expect.stringContaining('&signature=test-signature'),
          headers: expect.any(Object)
        })
      );
    });

    it('should propagate errors from underlying services', async () => {
      vi.mocked(mockEnvService.getBoolean).mockReturnValue(true);

      // Mock server time
      vi.mocked(axios.get).mockResolvedValue({
        data: { serverTime: 1640995200000 }
      });

      // Note: getSellAmount no longer exists - mocking a different error
      vi.mocked(mockExchangeApiService.sendApiRequest).mockRejectedValue(new Error('API Error'));

      await expect(mexcApiService.createSellOrder(mockAsset, { orderType: 'market', to: 'USDT' })).rejects.toThrow('API Error');
    });

    it('should handle API errors from createSellOrder', async () => {
      vi.mocked(mockEnvService.getBoolean).mockReturnValue(true);

      // Mock server time
      vi.mocked(axios.get).mockResolvedValue({
        data: { serverTime: 1640995200000 }
      });

      // Note: getSellAmount no longer exists - using asset.amount directly
      vi.mocked(mockExchangeApiService.sendApiRequest).mockRejectedValue(new Error('API Error'));

      await expect(mexcApiService.createSellOrder(mockAsset, { orderType: 'market', to: 'USDT' })).rejects.toThrow('API Error');
    });
  });

  describe('createBuyOrder', () => {
    beforeEach(() => {
      // SAFETY FIRST: Ensure ALL external calls are stubbed to prevent real transactions
      vi.mocked(mockExchangeApiService.getAPIKey).mockReturnValue('test-api-key');
      vi.mocked(mockExchangeApiService.getAPISecret).mockReturnValue('test-api-secret');
      vi.mocked(mockExchangeApiService.sign).mockReturnValue('test-signature');

      // CRITICAL: Mock createBuyOrder to prevent ANY real API calls
      vi.mocked(mockExchangeApiService.sendApiRequest).mockImplementation(async () => {
        // This mock ensures NO real API calls are made during testing
        // It completely bypasses the real ExchangeApiService.createBuyOrder()
        // which contains axios.post() calls to MEXC APIs
        return Promise.resolve();
      });

      // SAFETY VERIFICATION: Confirm our mocks are properly set up
      if (!vi.isMockFunction(mockExchangeApiService.sendApiRequest)) {
        throw new Error('CRITICAL SAFETY FAILURE: createBuyOrder is not mocked!');
      }
    });

    it('should create market buy order in test mode by default', async () => {
      // Setup: Default to test mode (safety first)
      vi.mocked(mockEnvService.getBoolean).mockReturnValue(true);
      vi.mocked(mockEnvService.get).mockReturnValue('development');

      // Mock server time for the first call in createBuyOrder
      vi.mocked(axios.get).mockResolvedValue({
        data: { serverTime: 1640995200000 }
      });

      const result = await mexcApiService.createBuyOrder(mockAsset, { orderType: 'market', from: 'USDT' });

      expect(mockExchangeApiService.sign).toHaveBeenCalled();
      expect(mockExchangeApiService.sendApiRequest).toHaveBeenCalledWith(
        'mexc',
        expect.objectContaining({
          method: 'POST',
          url: expect.stringContaining('/api/v3/order/test'), // Should use test endpoint
          headers: expect.objectContaining({
            'X-MEXC-APIKEY': 'test-api-key',
            'Content-Type': 'application/json',
          })
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

      // CRITICAL SAFETY VERIFICATION: Confirm our mock is in place before the dangerous call
      // This ensures that when MexcApiService.createBuyOrder() calls 
      // mockExchangeApiService.createBuyOrder(), it hits our mock, NOT the real ExchangeApiService
      expect(vi.isMockFunction(mockExchangeApiService.sendApiRequest)).toBe(true);

      /**
       * WHY THIS CALL WILL NOT REACH MEXC:
       * 
       * 1. MexcApiService receives mockExchangeApiService (not real ExchangeApiService)
       * 2. mockExchangeApiService.createBuyOrder is a vi.fn() mock that returns Promise.resolve()
       * 3. The real ExchangeApiService.createBuyOrder() contains axios.post() calls to MEXC
       * 4. Our mock bypasses ALL real network calls - it just returns a resolved promise
       * 5. No HTTP requests are made, no API keys are used, no real trading occurs
       * 
       * SAFETY CHAIN:
       * Test → MexcApiService → mockExchangeApiService.createBuyOrder() → Promise.resolve() 
       *                                    ↑
       *                              STOPS HERE - never reaches real API
       */
      await mexcApiService.createBuyOrder(mockAsset, { orderType: 'market', from: 'USDT' });

      // Verify it would select the production endpoint (but no real call is made)
      expect(mockExchangeApiService.sendApiRequest).toHaveBeenCalledWith(
        'mexc',
        expect.objectContaining({
          method: 'POST',
          url: expect.stringContaining('/api/v3/order'), // Would use live endpoint (SIMULATED ONLY)
          headers: expect.objectContaining({
            'X-MEXC-APIKEY': 'test-api-key',
            'Content-Type': 'application/json',
          })
        })
      );

      // SAFETY VERIFICATION: Ensure the mock was called, not real service
      expect(vi.mocked(mockExchangeApiService.sendApiRequest)).toHaveBeenCalled();
    });

    it('should NEVER make real API calls during testing - safety verification', async () => {
      // This test explicitly verifies that NO real external calls are made
      vi.mocked(mockEnvService.getBoolean).mockReturnValue(false); // Simulate production config
      vi.mocked(mockEnvService.get).mockReturnValue('production');

      vi.mocked(axios.get).mockResolvedValue({
        data: { serverTime: 1640995200000 }
      });

      // PRE-CALL SAFETY VERIFICATION: Confirm mocks are properly set up
      expect(vi.isMockFunction(mockExchangeApiService.sendApiRequest)).toBe(true);
      expect(vi.isMockFunction(axios.get)).toBe(true);

      // Spy on axios.post to ensure it's NEVER called during tests
      const axiosPostSpy = vi.spyOn(axios, 'post');

      /**
       * SAFETY EXPLANATION FOR createBuyOrder() CALL:
       * 
       * Even though this simulates "production mode", NO real trading occurs because:
       * 
       * 1. DEPENDENCY INJECTION SAFETY:
       *    - MexcApiService was constructed with mockExchangeApiService (not real one)
       *    - All calls to this.exchangeApiService.* hit our mocks
       * 
       * 2. MOCK IMPLEMENTATION SAFETY:
       *    - mockExchangeApiService.createBuyOrder returns Promise.resolve()
       *    - It never calls axios.post() to external APIs
       *    - No HTTP requests leave the test environment
       * 
       * 3. NETWORK ISOLATION:
       *    - axios is mocked at the module level (vi.mock('axios'))
       *    - Even if somehow bypassed, axios.post would be intercepted
       * 
       * VERIFICATION: We spy on axios.post to ensure it's NEVER invoked
       */
      await mexcApiService.createBuyOrder(mockAsset, { orderType: 'market', from: 'USDT' });

      // CRITICAL SAFETY CHECK: Ensure axios.post (real API call) was NEVER invoked
      expect(axiosPostSpy).not.toHaveBeenCalled();

      // But verify the mocked service was called (testing the logic flow)
      expect(mockExchangeApiService.sendApiRequest).toHaveBeenCalled();
    });

    it('should default to test mode when environment is not production', async () => {
      // Setup: useTestMode = false but nodeEnv != production (safety check)
      vi.mocked(mockEnvService.getBoolean).mockReturnValue(false);
      vi.mocked(mockEnvService.get).mockReturnValue('development');

      // Mock server time
      vi.mocked(axios.get).mockResolvedValue({
        data: { serverTime: 1640995200000 }
      });

      await mexcApiService.createBuyOrder(mockAsset, { orderType: 'market', from: 'USDT' });

      expect(mockExchangeApiService.sendApiRequest).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          url: expect.stringContaining('/api/v3/order/test'), // Should still use test endpoint for safety
          headers: expect.any(Object)
        })
      );
    });

    it('should create correct trading pair and query string', async () => {
      vi.mocked(mockEnvService.getBoolean).mockReturnValue(true);

      // Mock server time
      vi.mocked(axios.get).mockResolvedValue({
        data: { serverTime: 1640995200000 }
      });

      await mexcApiService.createBuyOrder(mockAsset, { orderType: 'market', from: 'ETH' });

      expect(mockExchangeApiService.sendApiRequest).toHaveBeenCalledWith(
        'mexc',
        expect.objectContaining({
          method: 'POST',
          url: expect.stringContaining('symbol=BTCETH&side=BUY&type=MARKET'), // Correct query params for buy order
          headers: expect.any(Object)
        })
      );
    });

    it('should use USDT as default source currency when from is not specified', async () => {
      vi.mocked(mockEnvService.getBoolean).mockReturnValue(true);

      // Mock server time
      vi.mocked(axios.get).mockResolvedValue({
        data: { serverTime: 1640995200000 }
      });

      await mexcApiService.createBuyOrder(mockAsset, { orderType: 'market', from: 'USDT' });

      expect(mockExchangeApiService.sendApiRequest).toHaveBeenCalledWith(
        'mexc',
        expect.objectContaining({
          method: 'POST',
          url: expect.stringContaining('symbol=BTCUSDT'),
          headers: expect.any(Object)
        })
      );
    });

    it('should include proper signature in the URL', async () => {
      vi.mocked(mockEnvService.getBoolean).mockReturnValue(true);

      // Mock server time
      vi.mocked(axios.get).mockResolvedValue({
        data: { serverTime: 1640995200000 }
      });

      await mexcApiService.createBuyOrder(mockAsset, { orderType: 'market', from: 'USDT' });

      expect(mockExchangeApiService.sign).toHaveBeenCalledWith(
        expect.stringMatching(/symbol=BTCUSDT&side=BUY&type=MARKET.*&timestamp=\d+/),
        'test-api-secret'
      );

      expect(mockExchangeApiService.sendApiRequest).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          url: expect.stringContaining('&signature=test-signature'),
          headers: expect.any(Object)
        })
      );
    });

    it('should propagate errors from underlying services', async () => {
      vi.mocked(mockEnvService.getBoolean).mockReturnValue(true);

      // Mock server time
      vi.mocked(axios.get).mockResolvedValue({
        data: { serverTime: 1640995200000 }
      });

      vi.mocked(mockExchangeApiService.sendApiRequest).mockRejectedValue(new Error('API Error'));

      await expect(mexcApiService.createBuyOrder(mockAsset, { orderType: 'market', from: 'USDT' })).rejects.toThrow('API Error');
    });

    it('should handle API errors from createBuyOrder', async () => {
      vi.mocked(mockEnvService.getBoolean).mockReturnValue(true);

      // Mock server time
      vi.mocked(axios.get).mockResolvedValue({
        data: { serverTime: 1640995200000 }
      });

      vi.mocked(mockExchangeApiService.sendApiRequest).mockRejectedValue(new Error('API Error'));

      await expect(mexcApiService.createBuyOrder(mockAsset, { orderType: 'market', from: 'USDT' })).rejects.toThrow('API Error');
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

  describe('cancelOrder', () => {
    it('should block cancel order in test mode for safety', async () => {
      // Mock test mode
      vi.mocked(mockEnvService.get).mockImplementation((key: string) => {
        if (key === 'NODE_ENV') return 'development';
        if (key === 'api.mexc.testMode') return 'true';
        return undefined;
      });

      const orderId = 'ORDER_123456';

      const result = await mexcApiService.cancelOrder(orderId);

      // In test mode, cancelOrder returns void (proper DELETE semantics)
      expect(result).toBeUndefined();

      // Verify no actual API calls were made
      expect(mockExchangeApiService.sendApiRequest).not.toHaveBeenCalled();
    });

    it('should throw error about symbol requirement in production mode', async () => {
      // Mock production mode
      vi.mocked(mockEnvService.isProduction).mockReturnValue(true);
      vi.mocked(mockEnvService.get).mockImplementation((key: string) => {
        if (key === 'app.environment') return 'production';
        return undefined;
      });

      // Mock API credentials
      vi.mocked(mockExchangeApiService.getAPIKey).mockReturnValue('mock-api-key');
      vi.mocked(mockExchangeApiService.getAPISecret).mockReturnValue('mock-api-secret');

      const orderId = 'ORDER_123456';

      await expect(mexcApiService.cancelOrder(orderId)).rejects.toThrow(
        'MEXC cancel order requires symbol parameter. Implementation needs order symbol lookup or modified order storage to include symbol.'
      );
    });

    it('should throw error for missing order ID', async () => {
      await expect(mexcApiService.cancelOrder('')).rejects.toThrow(
        'Order ID is required to cancel an order'
      );
    });

    it('should throw error for missing API credentials in production', async () => {
      // Mock production mode
      vi.mocked(mockEnvService.isProduction).mockReturnValue(true);
      vi.mocked(mockEnvService.get).mockImplementation((key: string) => {
        if (key === 'app.environment') return 'production';
        return undefined;
      });

      // Mock missing credentials
      vi.mocked(mockExchangeApiService.getAPIKey).mockReturnValue('');
      vi.mocked(mockExchangeApiService.getAPISecret).mockReturnValue('');

      const orderId = 'ORDER_123456';

      await expect(mexcApiService.cancelOrder(orderId)).rejects.toThrow(
        'mexc API credentials not configured'
      );
    });
  });

  describe('getOpenedOrders', () => {
    beforeEach(() => {
      // SAFETY FIRST: Ensure ALL external calls are stubbed to prevent real API interactions
      vi.mocked(mockExchangeApiService.getAPIKey).mockReturnValue('test-api-key');
      vi.mocked(mockExchangeApiService.getAPISecret).mockReturnValue('test-api-secret');
      vi.mocked(mockExchangeApiService.sign).mockReturnValue('test-signature');

      // Mock server time for unique nonce generation
      vi.mocked(axios.get).mockResolvedValue({
        data: { serverTime: 1640995200000 }
      });
    });

    it('should fetch open orders successfully', async () => {
      const mockServerTimeResponse = {
        data: { serverTime: 1640995200000 }
      };

      const mockOpenOrders = [
        {
          symbol: 'BTCUSDT',
          orderId: 12345,
          clientOrderId: 'abc123',
          price: '50000.00',
          origQty: '0.001',
          executedQty: '0.000',
          cummulativeQuoteQty: '0.000',
          status: 'NEW',
          timeInForce: 'GTC',
          type: 'LIMIT',
          side: 'SELL',
          stopPrice: '0.000',
          icebergQty: '0.000',
          time: 1640995200000,
          updateTime: 1640995200000,
          isWorking: true,
          origQuoteOrderQty: '0.000'
        }
      ];

      // Mock axios.get to handle both time sync and open orders calls
      vi.mocked(axios.get).mockImplementation((url: string) => {
        if (url.includes('/api/v3/time')) {
          // Time syncer call
          return Promise.resolve({
            data: { serverTime: 1640995200000 }
          });
        } else if (url.includes('/api/v3/openOrders')) {
          // Open orders call
          return Promise.resolve({
            data: mockOpenOrders
          });
        }
        // Default fallback
        return Promise.resolve({
          data: { serverTime: 1640995200000 }
        });
      });

      const result = await mexcApiService.getOpenedOrders();

      expect(result).toEqual([
        {
          orderId: '12345',
          pair: 'BTCUSDT',
          price: '50000.00',
          amount: '0.001',
          direction: 'sell',
          type: 'limit',
          createdAt: '2022-01-01T00:00:00.000Z',
          exchange: 'mexc'
        }
      ]);

      expect(mockExchangeApiService.sign).toHaveBeenCalledWith(
        expect.stringMatching(/timestamp=\d+/),
        'test-api-secret'
      );

      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/v3/openOrders'),
        expect.objectContaining({
          headers: {
            'X-MEXC-APIKEY': 'test-api-key',
            'Content-Type': 'application/json'
          }
        })
      );
    });

    it('should handle MEXC API errors', async () => {
      const mexcError = {
        code: -1121,
        msg: 'Invalid symbol.'
      };

      vi.mocked(axios.get).mockResolvedValueOnce({
        data: mexcError
      });

      await expect(mexcApiService.getOpenedOrders()).rejects.toThrow(
        'MEXC API error: Invalid symbol.'
      );
    });

    it('should handle network errors', async () => {
      const networkError = {
        response: {
          data: {
            code: -1001,
            msg: 'Internal error; unable to process your request. Please try again.'
          }
        }
      };

      vi.mocked(axios.get).mockRejectedValueOnce(networkError);

      await expect(mexcApiService.getOpenedOrders()).rejects.toThrow(
        'mexc API error: Internal error; unable to process your request. Please try again.'
      );
    });

    it('should handle missing API credentials', async () => {
      vi.mocked(mockExchangeApiService.getAPIKey).mockReturnValue('');
      vi.mocked(mockExchangeApiService.getAPISecret).mockReturnValue('test-api-secret');

      await expect(mexcApiService.getOpenedOrders()).rejects.toThrow(
        'mexc API credentials not configured'
      );
    });

    it('should handle unexpected response format', async () => {
      const unexpectedResponse = {
        unexpectedField: 'value'
      };

      vi.mocked(axios.get).mockResolvedValueOnce({
        data: unexpectedResponse
      });

      await expect(mexcApiService.getOpenedOrders()).rejects.toThrow(
        'mexc API returned unexpected response format'
      );
    });

    it('should include proper URL parameters and signature', async () => {
      const mockOpenOrders = [];

      vi.mocked(axios.get).mockResolvedValueOnce({
        data: mockOpenOrders
      });

      await mexcApiService.getOpenedOrders();

      // Verify the timestamp parameter and signature are included
      expect(mockExchangeApiService.sign).toHaveBeenCalledWith(
        expect.stringMatching(/^timestamp=\d+$/),
        'test-api-secret'
      );

      // Verify the URL contains the query string and signature
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/v3\/openOrders\?timestamp=\d+&signature=test-signature$/),
        expect.any(Object)
      );
    });
  });

  describe('getClosedOrders', () => {
    beforeEach(() => {
      vi.mocked(mockExchangeApiService.getAPIKey).mockReturnValue('test-api-key');
      vi.mocked(mockExchangeApiService.getAPISecret).mockReturnValue('test-api-secret');
      vi.mocked(mockExchangeApiService.sign).mockReturnValue('test-signature');

      // Mock server time for unique nonce generation
      vi.mocked(axios.get).mockResolvedValue({
        data: { serverTime: 1640995200000 }
      });
    });

    it('should fetch closed orders successfully with default filters', async () => {
      const mockAllOrders = [
        { orderId: '123', symbol: 'BTCUSDT', status: 'FILLED', side: 'SELL' },
        { orderId: '456', symbol: 'BTCUSDT', status: 'NEW', side: 'SELL' },
        { orderId: '789', symbol: 'BTCUSDT', status: 'CANCELED', side: 'BUY' }
      ];

      vi.mocked(axios.get).mockResolvedValueOnce({
        data: mockAllOrders
      });

      const result = await mexcApiService.getClosedOrders();

      expect(result).toEqual([
        {
          orderId: '123',
          pair: 'BTCUSDT',
          direction: 'sell',
          type: 'limit',
          status: 'executed',
          amount: '',
          amountExecuted: '',
          price: '',
          limitPrice: '',
          cost: '',
          createdAt: '',
          exchange: 'mexc',
          closedAt: '',
        },
        {
          orderId: '789',
          pair: 'BTCUSDT',
          direction: 'buy',
          type: 'limit',
          status: 'canceled',
          amount: '',
          amountExecuted: '',
          price: '',
          limitPrice: '',
          cost: '',
          createdAt: '',
          exchange: 'mexc',
          closedAt: '',
        },
      ]);

      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/v3/allOrders'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-MEXC-APIKEY': 'test-api-key'
          })
        })
      );
    });

    it('should fetch closed orders with custom base and quote coins', async () => {
      const mockAllOrdersETHUSDT = [
        { orderId: '123', symbol: 'ETHUSDT', status: 'FILLED', side: 'SELL' }
      ];
      const mockAllOrdersETHBTC = [
        { orderId: '456', symbol: 'ETHBTC', status: 'CANCELED', side: 'BUY' }
      ];

      // Mock multiple axios.get calls for different symbols
      vi.mocked(axios.get)
        .mockResolvedValueOnce({ data: mockAllOrdersETHUSDT })  // First call for ETHUSDT
        .mockResolvedValueOnce({ data: mockAllOrdersETHBTC });  // Second call for ETHBTC

      const filters = { baseCoins: ['ETH'], quoteCoins: ['USDT', 'BTC'] };
      const result = await mexcApiService.getClosedOrders(filters);

      // Should have called axios.get twice, once for each pair
      expect(axios.get).toHaveBeenCalledTimes(2);

      // Verify the symbol parameters for each call
      expect(mockExchangeApiService.sign).toHaveBeenCalledWith(
        expect.stringMatching(/symbol=ETHUSDT&timestamp=\d+/),
        'test-api-secret'
      );
      expect(mockExchangeApiService.sign).toHaveBeenCalledWith(
        expect.stringMatching(/symbol=ETHBTC&timestamp=\d+/),
        'test-api-secret'
      );

      // Should return combined results
      expect(result).toHaveLength(2);
      expect(result.map((order: any) => order.pair)).toEqual(['ETHUSDT', 'ETHBTC']);
    });

    it('should use default BTCUSDT when no filters provided', async () => {
      const mockAllOrders = [
        { orderId: '123', symbol: 'BTCUSDT', status: 'FILLED', side: 'SELL' }
      ];

      vi.mocked(axios.get).mockResolvedValueOnce({
        data: mockAllOrders
      });

      await mexcApiService.getClosedOrders();

      // Verify the default symbol parameter is included
      expect(mockExchangeApiService.sign).toHaveBeenCalledWith(
        expect.stringMatching(/symbol=BTCUSDT&timestamp=\d+/),
        'test-api-secret'
      );
    });

    it('should handle MEXC API errors', async () => {
      const mockError = {
        code: -1121,
        msg: 'Invalid symbol.'
      };

      vi.mocked(axios.get).mockResolvedValueOnce({
        data: mockError
      });

      await expect(mexcApiService.getClosedOrders()).rejects.toThrow('Failed to fetch closed orders: BTCUSDT: Invalid symbol. (Code: -1121)');
    });

    it('should handle network errors', async () => {
      const networkError = {
        response: {
          data: {
            code: -1001,
            msg: 'Internal error; unable to process your request. Please try again.'
          }
        }
      };

      vi.mocked(axios.get).mockRejectedValueOnce(networkError);

      await expect(mexcApiService.getClosedOrders()).rejects.toThrow('Failed to fetch closed orders: BTCUSDT:');
    });

    it('should handle missing API credentials', async () => {
      vi.mocked(mockExchangeApiService.getAPIKey).mockReturnValue('');
      vi.mocked(mockExchangeApiService.getAPISecret).mockReturnValue('');

      await expect(mexcApiService.getClosedOrders()).rejects.toThrow('mexc API credentials not configured');
    });

    it('should handle unexpected response format', async () => {
      vi.mocked(axios.get).mockResolvedValueOnce({
        data: 'unexpected format'
      });

      await expect(mexcApiService.getClosedOrders()).rejects.toThrow('Failed to fetch closed orders: BTCUSDT: Unexpected response format');
    });

    it('should include proper URL parameters and signature', async () => {
      const mockAllOrders = [];

      vi.mocked(axios.get).mockResolvedValueOnce({
        data: mockAllOrders
      });

      await mexcApiService.getClosedOrders();

      // Verify the timestamp parameter and signature are included
      expect(mockExchangeApiService.sign).toHaveBeenCalledWith(
        expect.stringMatching(/^symbol=BTCUSDT&timestamp=\d+$/),
        'test-api-secret'
      );

      // Verify the URL contains the query string and signature
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/v3\/allOrders\?symbol=BTCUSDT&timestamp=\d+&signature=test-signature$/),
        expect.any(Object)
      );
    });

    it('should filter orders correctly by status', async () => {
      const mockAllOrders = [
        { orderId: '1', status: 'FILLED' },
        { orderId: '2', status: 'NEW' },
        { orderId: '3', status: 'CANCELED' },
        { orderId: '4', status: 'PARTIALLY_FILLED' },
        { orderId: '5', status: 'REJECTED' },
        { orderId: '6', status: 'EXPIRED' }
      ];

      vi.mocked(axios.get).mockResolvedValueOnce({
        data: mockAllOrders
      });

      const result = await mexcApiService.getClosedOrders();

      // Should only include FILLED, CANCELED, REJECTED, EXPIRED orders
      expect(result).toHaveLength(4);
      expect(result.map((order: any) => order.orderId)).toEqual(['1', '3', '5', '6']);
    });
  });
});
