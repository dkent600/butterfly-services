import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExchangeTimeSyncer } from '../exchange-time-syncer.js';

describe('ExchangeTimeSyncer', () => {
  let timeSyncer: ExchangeTimeSyncer;

  beforeEach(() => {
    timeSyncer = new ExchangeTimeSyncer();
    vi.clearAllMocks();
  });

  describe('initFromServer', () => {
    it('should initialize time offset correctly', async () => {
      const mockServerTime = 1640000000000; // Fixed server time
      const mockLocalTime = 1639999995000; // 5 seconds behind

      // Mock Date.now to return consistent local time
      const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(mockLocalTime);

      await timeSyncer.initFromServer(mockServerTime);

      // The offset should be 5000ms (5 seconds)
      expect(timeSyncer.getSynchronizedTimestamp()).toBe(mockServerTime);

      dateSpy.mockRestore();
    });
  });

  describe('getSynchronizedTimestamp', () => {
    it('should return synchronized timestamp', async () => {
      const serverTime = 1640000000000;
      const localTime = 1639999990000; // 10 seconds behind

      vi.spyOn(Date, 'now').mockReturnValue(localTime);

      await timeSyncer.initFromServer(serverTime);

      // After init, when local time moves forward by 1 second
      vi.spyOn(Date, 'now').mockReturnValue(localTime + 1000);

      const result = timeSyncer.getSynchronizedTimestamp();
      expect(result).toBe(serverTime + 1000);

      vi.restoreAllMocks();
    });
  });

  describe('getTimestampString', () => {
    it('should return timestamp as string', async () => {
      const serverTime = 1640000000000;
      vi.spyOn(Date, 'now').mockReturnValue(serverTime);

      await timeSyncer.initFromServer(serverTime);

      const result = timeSyncer.getTimestampString();
      expect(result).toBe(serverTime.toString());

      vi.restoreAllMocks();
    });
  });

  describe('now', () => {
    it('should return synchronized time', async () => {
      const serverTime = 1640000000000;
      vi.spyOn(Date, 'now').mockReturnValue(serverTime);

      await timeSyncer.initFromServer(serverTime);

      const result = timeSyncer.now();
      expect(result).toBe(serverTime);

      vi.restoreAllMocks();
    });
  });

  describe('before initialization', () => {
    it('should work with zero offset before init', () => {
      const localTime = 1640000000000;
      vi.spyOn(Date, 'now').mockReturnValue(localTime);

      const result = timeSyncer.getSynchronizedTimestamp();
      expect(result).toBe(localTime);

      vi.restoreAllMocks();
    });
  });
});
