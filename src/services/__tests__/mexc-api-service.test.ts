import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MexcApiService } from '../mexc-api-service.js';
import { IExchangeApiService, IAsset } from '../../types/interfaces.js';

// Mock axios
vi.mock('axios');
import axios from 'axios';
const mockedAxios = vi.mocked(axios);

describe('MexcApiService', () => {
  let mexcApiService: MexcApiService;
  let mockExchangeApiService: IExchangeApiService;
  let mockAsset: IAsset;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock exchange API service
    mockExchangeApiService = {
      sign: vi.fn(),
      getAPIKey: vi.fn(),
      getAPISecret: vi.fn(),
      createMarketSellOrder: vi.fn(),
    };

    // Create mock asset
    mockAsset = {
      name: 'BTC',
      exchange: 'mexc',
      percentage: 50,
      apiUrl: 'https://api.mexc.com',
    };

    // Create service with mocked dependencies
    mexcApiService = new MexcApiService(mockExchangeApiService);
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
      const mockResponse = {
        data: { price: '50000.00' },
      };
      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await mexcApiService.fetchPrice(mockAsset);

      expect(result).toBe(50000);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.mexc.com/api/v3/ticker/price',
        { params: { symbol: 'BTCUSDT' } },
      );
    });

    it('should throw error when price fetch fails', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network error'));

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

  describe('getApiUrl', () => {
    it('should construct correct API URL', () => {
      // Access private method for testing
      const getApiUrl = (mexcApiService as any).getApiUrl.bind(mexcApiService);

      const result = getApiUrl(mockAsset, '/api/v3/time');
      expect(result).toBe('https://api.mexc.com/api/v3/time');
    });

    it('should handle URLs with trailing slashes', () => {
      const assetWithSlash = { ...mockAsset, apiUrl: 'https://api.mexc.com/' };
      const getApiUrl = (mexcApiService as any).getApiUrl.bind(mexcApiService);

      const result = getApiUrl(assetWithSlash, '/api/v3/time');
      expect(result).toBe('https://api.mexc.com/api/v3/time');
    });

    it('should handle paths without leading slashes', () => {
      const getApiUrl = (mexcApiService as any).getApiUrl.bind(mexcApiService);

      const result = getApiUrl(mockAsset, 'api/v3/time');
      expect(result).toBe('https://api.mexc.com/api/v3/time');
    });
  });
});
