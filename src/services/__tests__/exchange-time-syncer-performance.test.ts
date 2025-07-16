import { describe, it, expect, beforeEach } from 'vitest';
import { ExchangeTimeSyncer } from '../exchange-time-syncer.js';

describe('ExchangeTimeSyncer Performance Tests', () => {
  let timeSyncer: ExchangeTimeSyncer;

  beforeEach(() => {
    timeSyncer = new ExchangeTimeSyncer();
  });

  describe('real-world rapid successive calls', () => {
    it('should handle burst API call patterns efficiently', async () => {
      // Initialize with current time
      const serverTime = Date.now();
      await timeSyncer.initFromServer(serverTime);

      // Simulate burst of API calls (like order submissions)
      const startTime = performance.now();
      const burstSize = 1000;
      const timestamps: number[] = [];

      for (let i = 0; i < burstSize; i++) {
        timestamps.push(timeSyncer.now());
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Performance assertions
      expect(duration).toBeLessThan(50); // Should complete in under 50ms
      expect(timestamps).toHaveLength(burstSize);

      // Verify timestamps are reasonable (within a few seconds of actual time)
      const actualTime = Date.now();
      timestamps.forEach(timestamp => {
        expect(Math.abs(timestamp - actualTime)).toBeLessThan(5000); // Within 5 seconds
      });
    });

    it('should maintain consistency across multiple burst periods', async () => {
      await timeSyncer.initFromServer(Date.now());

      const burstPeriods = 5;
      const callsPerBurst = 100;
      const allTimestamps: number[][] = [];

      for (let period = 0; period < burstPeriods; period++) {
        const burstTimestamps: number[] = [];
        
        for (let call = 0; call < callsPerBurst; call++) {
          burstTimestamps.push(timeSyncer.now());
        }
        
        allTimestamps.push(burstTimestamps);
        
        // Small delay between bursts
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Verify consistency across bursts
      for (let period = 0; period < burstPeriods - 1; period++) {
        const currentBurst = allTimestamps[period];
        const nextBurst = allTimestamps[period + 1];
        
        // Last timestamp of current burst should be <= first timestamp of next burst
        expect(currentBurst[currentBurst.length - 1]).toBeLessThanOrEqual(nextBurst[0]);
      }
    });

    it('should demonstrate thread-safe behavior in concurrent scenarios', async () => {
      await timeSyncer.initFromServer(Date.now());

      // Simulate concurrent API operations
      const concurrentOperations = 10;
      const callsPerOperation = 50;

      const operations = Array.from({ length: concurrentOperations }, async (_, opIndex) => {
        const timestamps: number[] = [];
        
        for (let i = 0; i < callsPerOperation; i++) {
          timestamps.push(timeSyncer.now());
          // Micro-delay to simulate real processing
          await new Promise(resolve => setImmediate(resolve));
        }
        
        return { opIndex, timestamps };
      });

      const results = await Promise.all(operations);

      // Verify all operations completed successfully
      expect(results).toHaveLength(concurrentOperations);
      
      results.forEach((result, index) => {
        expect(result.opIndex).toBe(index);
        expect(result.timestamps).toHaveLength(callsPerOperation);
        
        // Verify timestamps within each operation are reasonable
        for (let i = 1; i < result.timestamps.length; i++) {
          expect(result.timestamps[i]).toBeGreaterThanOrEqual(result.timestamps[i - 1]);
        }
      });
    });
  });

  describe('edge case handling', () => {
    it('should handle calls before and after initialization gracefully', async () => {
      // Call before initialization
      const beforeInit = timeSyncer.now();
      expect(typeof beforeInit).toBe('number');

      // Initialize
      await timeSyncer.initFromServer(Date.now() + 5000); // 5 seconds in future

      // Call after initialization
      const afterInit = timeSyncer.now();
      expect(afterInit).toBeGreaterThan(beforeInit);

      // Rapid calls after initialization
      const rapidCalls: number[] = [];
      for (let i = 0; i < 100; i++) {
        rapidCalls.push(timeSyncer.now());
      }

      // All should be consistent with the offset
      const firstCall = rapidCalls[0];
      rapidCalls.forEach(timestamp => {
        // Should be within a reasonable range of the first call
        expect(Math.abs(timestamp - firstCall)).toBeLessThan(100);
      });
    });

    it('should handle re-initialization without breaking existing behavior', async () => {
      // First initialization
      await timeSyncer.initFromServer(Date.now());
      const firstBatch = Array.from({ length: 50 }, () => timeSyncer.now());

      // Re-initialize with different offset
      await timeSyncer.initFromServer(Date.now() + 10000); // 10 seconds in future
      const secondBatch = Array.from({ length: 50 }, () => timeSyncer.now());

      // Second batch should be significantly higher due to new offset
      expect(secondBatch[0]).toBeGreaterThan(firstBatch[firstBatch.length - 1]);

      // Both batches should be internally consistent
      for (let i = 1; i < firstBatch.length; i++) {
        expect(firstBatch[i]).toBeGreaterThanOrEqual(firstBatch[i - 1]);
      }
      for (let i = 1; i < secondBatch.length; i++) {
        expect(secondBatch[i]).toBeGreaterThanOrEqual(secondBatch[i - 1]);
      }
    });
  });
});
