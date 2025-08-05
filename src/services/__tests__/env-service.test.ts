import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EnvService } from '../env-service.js';

describe('EnvService', () => {
  let envService: EnvService;

  beforeEach(() => {
    envService = new EnvService();
    // Mock console.log to avoid test output noise
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('isProduction', () => {
    it('should return false by default (safe default)', async () => {
      // Clear any existing config
      await envService.init();
      
      const result = envService.isProduction();
      expect(result).toBe(false);
    });

    it('should return false when useTestMode is true', async () => {
      // Mock getBoolean to return true for useTestMode
      vi.spyOn(envService, 'getBoolean').mockReturnValue(true);
      vi.spyOn(envService, 'get').mockReturnValue('production');
      
      const result = envService.isProduction();
      expect(result).toBe(false);
    });

    it('should return false when environment is not production', async () => {
      // Mock getBoolean to return false for useTestMode, but environment is not production
      vi.spyOn(envService, 'getBoolean').mockReturnValue(false);
      vi.spyOn(envService, 'get').mockReturnValue('development');
      
      const result = envService.isProduction();
      expect(result).toBe(false);
    });

    it('should return true only when useTestMode is false AND environment starts with production', async () => {
      // Mock both conditions to be true for production mode
      vi.spyOn(envService, 'getBoolean').mockReturnValue(false);
      vi.spyOn(envService, 'get').mockReturnValue('production');
      
      const result = envService.isProduction();
      expect(result).toBe(true);
    });

    it('should return true when environment is production-like', async () => {
      vi.spyOn(envService, 'getBoolean').mockReturnValue(false);
      vi.spyOn(envService, 'get').mockReturnValue('production-east');
      
      const result = envService.isProduction();
      expect(result).toBe(true);
    });

    it('should return false when useTestMode is undefined (safe default)', async () => {
      vi.spyOn(envService, 'getBoolean').mockReturnValue(undefined);
      vi.spyOn(envService, 'get').mockReturnValue('production');
      
      const result = envService.isProduction();
      expect(result).toBe(false);
    });
  });
});
