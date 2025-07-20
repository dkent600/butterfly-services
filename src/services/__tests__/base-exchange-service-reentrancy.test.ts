import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { container } from 'tsyringe';
import { BaseExchangeService } from '../base-exchange-service.js';
import { ExchangeTimeSyncer, TimeUnit } from '../exchange-time-syncer.js';
import { IEnvService, TYPES } from '../../types/interfaces.js';

// Create a concrete test implementation of BaseExchangeService
class TestExchangeService extends BaseExchangeService {
  private serverTimeCallCount = 0;
  private serverTimeDelay: number;

  constructor(envService: IEnvService, serverTimeDelay = 100) {
    super(envService);
    this.serverTimeDelay = serverTimeDelay;
  }

  protected getTimeEndpoint(): string {
    return '/api/v1/time';
  }

  protected getApiBaseUrl(): string {
    return 'https://test-exchange.com';
  }

  protected getExchangeName(): string {
    return 'test-exchange';
  }

  protected getTimeUnit(): TimeUnit {
    return 'milliseconds';
  }

  protected extractServerTime(responseData: any): number {
    return responseData.serverTime;
  }

  // Override getRealServerTime to simulate network delay and count calls
  protected async getRealServerTime(): Promise<number> {
    this.serverTimeCallCount++;
    console.log(`[TEST] Server time call #${this.serverTimeCallCount} started`);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, this.serverTimeDelay));
    
    const serverTime = Date.now();
    console.log(`[TEST] Server time call #${this.serverTimeCallCount} completed: ${serverTime}`);
    return serverTime;
  }

  // Expose methods for testing
  public async testGetTimeSyncer() {
    return this.getTimeSyncer();
  }

  public async testGetServerTimestamp() {
    return this.getServerTimestamp();
  }

  public getServerTimeCallCount(): number {
    return this.serverTimeCallCount;
  }

  public resetCallCount(): void {
    this.serverTimeCallCount = 0;
  }

  async fetchBalance(): Promise<number> {
    return 0; // Not used in this test
  }
}

describe('BaseExchangeService Reentrancy Tests', () => {
  let envService: IEnvService;
  let testService: TestExchangeService;

  beforeEach(() => {
    // Clear any existing time syncer instances
    ExchangeTimeSyncer.clearInstances();

    // Create mock environment service
    envService = {
      get: vi.fn().mockReturnValue('test'),
      getBoolean: vi.fn().mockReturnValue(true),
      getNumber: vi.fn().mockReturnValue(0),
      init: vi.fn(),
    };

    // Create test service with artificial delay to simulate concurrent scenarios
    testService = new TestExchangeService(envService, 100);
  });

  afterEach(() => {
    ExchangeTimeSyncer.clearInstances();
  });

  describe('getServerTimestamp reentrancy safety', () => {
    it('should handle concurrent calls to getServerTimestamp safely', async () => {
      const concurrentCalls = 5;
      const startTime = Date.now();
      
      console.log(`[TEST] Starting ${concurrentCalls} concurrent getServerTimestamp calls`);
      
      // Start multiple concurrent calls to getServerTimestamp
      const promises = Array.from({ length: concurrentCalls }, (_, index) => {
        console.log(`[TEST] Starting call #${index + 1}`);
        return testService.testGetServerTimestamp();
      });

      // Wait for all calls to complete
      const results = await Promise.all(promises);
      const endTime = Date.now();
      
      console.log(`[TEST] All calls completed in ${endTime - startTime}ms`);
      console.log(`[TEST] Results:`, results);
      console.log(`[TEST] Server time API was called ${testService.getServerTimeCallCount()} times`);

      // Verify results
      expect(results).toHaveLength(concurrentCalls);
      
      // All results should be valid timestamp strings
      results.forEach((result, index) => {
        expect(typeof result).toBe('string');
        expect(result).toMatch(/^\d+$/); // Should be a numeric string
        console.log(`[TEST] Call #${index + 1} result: ${result}`);
      });

      // Most importantly: server time should only be called ONCE due to singleton behavior
      // Even with concurrent calls, the initialization should be reentrant-safe
      expect(testService.getServerTimeCallCount()).toBe(1);
    });

    it('should handle rapid sequential calls efficiently', async () => {
      const sequentialCalls = 10;
      const results: string[] = [];
      
      console.log(`[TEST] Starting ${sequentialCalls} rapid sequential calls`);
      
      const startTime = Date.now();
      
      // Make rapid sequential calls
      for (let i = 0; i < sequentialCalls; i++) {
        const result = await testService.testGetServerTimestamp();
        results.push(result);
        console.log(`[TEST] Sequential call #${i + 1} result: ${result}`);
      }
      
      const endTime = Date.now();
      console.log(`[TEST] Sequential calls completed in ${endTime - startTime}ms`);
      console.log(`[TEST] Server time API was called ${testService.getServerTimeCallCount()} times`);

      // Verify results
      expect(results).toHaveLength(sequentialCalls);
      
      // All results should be valid
      results.forEach((result, index) => {
        expect(typeof result).toBe('string');
        expect(result).toMatch(/^\d+$/);
      });

      // Server time should only be called once (first call initializes, rest use cached syncer)
      expect(testService.getServerTimeCallCount()).toBe(1);
    });

    it('should handle mixed concurrent and sequential access patterns', async () => {
      console.log('[TEST] Starting mixed access pattern test');
      
      // First batch: concurrent calls
      const concurrentPromises = Array.from({ length: 3 }, (_, index) => {
        console.log(`[TEST] Starting concurrent batch call #${index + 1}`);
        return testService.testGetServerTimestamp();
      });

      const concurrentResults = await Promise.all(concurrentPromises);
      console.log('[TEST] Concurrent batch completed');

      // Second batch: sequential calls
      const sequentialResults: string[] = [];
      for (let i = 0; i < 3; i++) {
        const result = await testService.testGetServerTimestamp();
        sequentialResults.push(result);
        console.log(`[TEST] Sequential call #${i + 1} after concurrent batch: ${result}`);
      }

      // Third batch: another concurrent batch
      const secondConcurrentPromises = Array.from({ length: 2 }, (_, index) => {
        console.log(`[TEST] Starting second concurrent batch call #${index + 1}`);
        return testService.testGetServerTimestamp();
      });

      const secondConcurrentResults = await Promise.all(secondConcurrentPromises);
      
      console.log(`[TEST] Total server time API calls: ${testService.getServerTimeCallCount()}`);

      // Verify all results are valid
      const allResults = [...concurrentResults, ...sequentialResults, ...secondConcurrentResults];
      expect(allResults).toHaveLength(8);
      
      allResults.forEach(result => {
        expect(typeof result).toBe('string');
        expect(result).toMatch(/^\d+$/);
      });

      // Critical test: even with this complex access pattern, server time should only be called once
      expect(testService.getServerTimeCallCount()).toBe(1);
    });

    it('should ensure singleton behavior across multiple service instances', async () => {
      console.log('[TEST] Testing singleton behavior across multiple service instances');
      
      // Create multiple service instances for the same exchange
      const service1 = new TestExchangeService(envService, 50);
      const service2 = new TestExchangeService(envService, 50);
      const service3 = new TestExchangeService(envService, 50);

      // Override exchange name to be the same for all instances
      (service1 as any).getExchangeName = () => 'shared-exchange';
      (service2 as any).getExchangeName = () => 'shared-exchange';
      (service3 as any).getExchangeName = () => 'shared-exchange';

      // Make concurrent calls across different service instances
      const promises = [
        service1.testGetServerTimestamp(),
        service2.testGetServerTimestamp(),
        service3.testGetServerTimestamp(),
        service1.testGetServerTimestamp(), // Second call on service1
        service2.testGetServerTimestamp(), // Second call on service2
      ];

      const results = await Promise.all(promises);
      
      console.log('[TEST] Cross-instance results:', results);
      console.log(`[TEST] Service1 calls: ${service1.getServerTimeCallCount()}`);
      console.log(`[TEST] Service2 calls: ${service2.getServerTimeCallCount()}`);
      console.log(`[TEST] Service3 calls: ${service3.getServerTimeCallCount()}`);

      // Verify all results are valid
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(typeof result).toBe('string');
        expect(result).toMatch(/^\d+$/);
      });

      // Critical test: Only one service instance should have made the server time call
      // because they all share the same exchange name and should use the same singleton
      const totalApiCalls = service1.getServerTimeCallCount() + 
                           service2.getServerTimeCallCount() + 
                           service3.getServerTimeCallCount();
      
      expect(totalApiCalls).toBe(1);
    });
  });
});
