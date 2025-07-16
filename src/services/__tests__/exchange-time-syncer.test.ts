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

  describe('rapid successive calls', () => {
    it('should handle rapid successive calls consistently', async () => {
      const serverTime = 1640000000000;
      const localTime = 1639999995000; // 5 seconds behind
      
      // Mock Date.now to return consistent time for initialization
      let mockTime = localTime;
      const dateSpy = vi.spyOn(Date, 'now').mockImplementation(() => mockTime);

      await timeSyncer.initFromServer(serverTime);

      // Perform rapid successive calls and verify consistency
      const results: number[] = [];
      const numCalls = 100;
      
      for (let i = 0; i < numCalls; i++) {
        // Simulate time advancing slightly for each call (microseconds)
        mockTime = localTime + i;
        results.push(timeSyncer.now());
      }

      // Verify all results are monotonically increasing
      for (let i = 1; i < results.length; i++) {
        expect(results[i]).toBeGreaterThanOrEqual(results[i - 1]);
      }

      // Verify offset consistency - all calls should use the same offset
      const expectedOffset = serverTime - localTime; // 5000ms
      for (let i = 0; i < results.length; i++) {
        const expectedResult = (localTime + i) + expectedOffset;
        expect(results[i]).toBe(expectedResult);
      }

      dateSpy.mockRestore();
    });

    it('should handle rapid calls to different methods consistently', async () => {
      const serverTime = 1640000000000;
      const localTime = 1639999990000; // 10 seconds behind
      
      vi.spyOn(Date, 'now').mockReturnValue(localTime);
      await timeSyncer.initFromServer(serverTime);

      // Perform rapid calls to different methods
      const results = {
        now: [] as number[],
        getSynchronizedTimestamp: [] as number[],
        getTimestampString: [] as string[]
      };

      for (let i = 0; i < 50; i++) {
        results.now.push(timeSyncer.now());
        results.getSynchronizedTimestamp.push(timeSyncer.getSynchronizedTimestamp());
        results.getTimestampString.push(timeSyncer.getTimestampString());
      }

      // Verify all methods return the same values for the same point in time
      for (let i = 0; i < 50; i++) {
        expect(results.now[i]).toBe(results.getSynchronizedTimestamp[i]);
        expect(results.getTimestampString[i]).toBe(results.now[i].toString());
      }

      vi.restoreAllMocks();
    });

    it('should be thread-safe for concurrent access patterns', async () => {
      const serverTime = 1640000000000;
      const localTime = 1639999985000; // 15 seconds behind
      
      vi.spyOn(Date, 'now').mockReturnValue(localTime);
      await timeSyncer.initFromServer(serverTime);

      // Simulate concurrent access pattern by creating multiple promises
      const concurrentCalls = Array.from({ length: 20 }, (_, index) => {
        return new Promise<number[]>((resolve) => {
          const results: number[] = [];
          // Each "thread" makes multiple rapid calls
          for (let i = 0; i < 10; i++) {
            results.push(timeSyncer.now());
          }
          resolve(results);
        });
      });

      const allResults = await Promise.all(concurrentCalls);
      
      // Flatten results and verify consistency
      const flatResults = allResults.flat();
      
      // All results should be the same since Date.now() is mocked to return constant value
      const expectedValue = serverTime;
      flatResults.forEach(result => {
        expect(result).toBe(expectedValue);
      });

      vi.restoreAllMocks();
    });

    it('should maintain accuracy during high-frequency timestamp generation', async () => {
      const serverTime = 1640000000000;
      let mockTime = 1639999980000; // 20 seconds behind
      
      // Mock advancing time for each call
      const dateSpy = vi.spyOn(Date, 'now').mockImplementation(() => {
        mockTime += 1; // Advance by 1ms each call
        return mockTime;
      });

      await timeSyncer.initFromServer(serverTime);

      // Generate timestamps rapidly
      const timestamps: number[] = [];
      const iterations = 1000;
      
      for (let i = 0; i < iterations; i++) {
        timestamps.push(timeSyncer.now());
      }

      // Verify timestamps are strictly increasing
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i]).toBe(timestamps[i - 1] + 1);
      }

      // Verify offset remains constant throughout
      const initialOffset = serverTime - (1639999980000 + 1); // +1 because time advanced during init
      for (let i = 0; i < timestamps.length; i++) {
        const currentLocalTime = 1639999980000 + 1 + (i + 1); // +1 for init call, +(i+1) for each timestamp call
        expect(timestamps[i]).toBe(currentLocalTime + initialOffset);
      }

      dateSpy.mockRestore();
    });
  });
});
