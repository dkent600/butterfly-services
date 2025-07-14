import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExchangeApiService } from '../exchange-api-service.js';
import { ILogService, IEnvService } from '../../types/interfaces.js';

describe('ExchangeApiService', () => {
  let exchangeApiService: ExchangeApiService;
  let mockLogService: ILogService;
  let mockEnvService: IEnvService;

  beforeEach(() => {
    // Create mock services
    mockLogService = {
      log: vi.fn(),
      logError: vi.fn(),
      logReport: vi.fn(),
    };

    mockEnvService = {
      init: vi.fn(),
      get: vi.fn(),
      getNumber: vi.fn(),
      getBoolean: vi.fn(),
    };

    // Create service with mocked dependencies
    exchangeApiService = new ExchangeApiService(mockLogService, mockEnvService);
  });

  describe('getAPIKey', () => {
    it('should return API key from env service', () => {
      const expectedKey = 'test-api-key';
      vi.mocked(mockEnvService.get).mockReturnValue(expectedKey);

      const result = exchangeApiService.getAPIKey('mexc');

      expect(mockEnvService.get).toHaveBeenCalledWith('api.mexc.apiKey');
      expect(result).toBe(expectedKey);
    });

    it('should throw error when API key is not found', () => {
      vi.mocked(mockEnvService.get).mockReturnValue(undefined);

      expect(() => exchangeApiService.getAPIKey('mexc')).toThrow('API key not found for exchange: mexc');
    });
  });

  describe('getAPISecret', () => {
    it('should return API secret from env service', () => {
      const expectedSecret = 'test-api-secret';
      vi.mocked(mockEnvService.get).mockReturnValue(expectedSecret);

      const result = exchangeApiService.getAPISecret('mexc');

      expect(mockEnvService.get).toHaveBeenCalledWith('api.mexc.apiSecret');
      expect(result).toBe(expectedSecret);
    });

    it('should throw error when API secret is not found', () => {
      vi.mocked(mockEnvService.get).mockReturnValue(undefined);

      expect(() => exchangeApiService.getAPISecret('mexc')).toThrow('API secret not found for exchange: mexc');
    });
  });

  describe('sign', () => {
    it('should create HMAC SHA256 signature', () => {
      const queryString = 'symbol=BTCUSDT&side=SELL&type=MARKET&quantity=0.001&timestamp=1234567890';
      const apiSecret = 'test-secret';

      const result = exchangeApiService.sign(queryString, apiSecret);

      // The result should be a 64-character hex string (SHA256 hash)
      expect(result).toMatch(/^[a-f0-9]{64}$/);
      expect(typeof result).toBe('string');
    });

    it('should produce consistent signatures for same input', () => {
      const queryString = 'test-query';
      const apiSecret = 'test-secret';

      const result1 = exchangeApiService.sign(queryString, apiSecret);
      const result2 = exchangeApiService.sign(queryString, apiSecret);

      expect(result1).toBe(result2);
    });

    it('should produce different signatures for different inputs', () => {
      const apiSecret = 'test-secret';

      const result1 = exchangeApiService.sign('query1', apiSecret);
      const result2 = exchangeApiService.sign('query2', apiSecret);

      expect(result1).not.toBe(result2);
    });
  });
});
