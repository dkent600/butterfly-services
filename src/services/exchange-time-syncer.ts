import { injectable } from 'tsyringe';
import { IExchangeTimeSyncer } from '../types/interfaces.js';

/**
 * Time unit configuration for different exchanges
 */
export type TimeUnit = 'seconds' | 'milliseconds';

/**
 * Configuration for exchange-specific time synchronization
 */
export interface ExchangeTimeConfig {
  /** The time unit this exchange expects for nonces and timestamps */
  timeUnit: TimeUnit;
}

/**
 * ExchangeTimeSyncer is used to synchronize the local time with the server time for a specific exchange.
 */
@injectable()
export class ExchangeTimeSyncer implements IExchangeTimeSyncer {
  private static instances: Map<string, ExchangeTimeSyncer> = new Map();
  private static initializationPromises: Map<string, Promise<void>> = new Map();
  private cachedTimeOffset: number = 0;
  private isInitialized: boolean = false;
  private timeUnit: TimeUnit = 'milliseconds'; // Default to milliseconds

  /**
   * Factory method to get or create a singleton ExchangeTimeSyncer for a specific exchange.
   * This method is reentrant-safe and handles concurrent initialization properly.
   * 
   * @param exchangeName - The name of the exchange (e.g., 'kraken', 'mexc')
   * @param serverTimeProvider - Optional function to get server time for initialization
   * @param config - Optional configuration for the exchange time syncer
   * @returns ExchangeTimeSyncer - Singleton instance for the specified exchange
   */
  static async getForExchange(
    exchangeName: string, 
    serverTimeProvider?: () => Promise<number>,
    config?: ExchangeTimeConfig,
  ): Promise<ExchangeTimeSyncer> {
    const key = exchangeName.toLowerCase();
    
    // Create instance if it doesn't exist
    if (!this.instances.has(key)) {
      const instance = new ExchangeTimeSyncer();
      
      // Configure time unit based on exchange requirements
      if (config?.timeUnit) {
        instance.timeUnit = config.timeUnit;
        console.log(`[TIME SYNCER] Created singleton for exchange: ${exchangeName} with time unit: ${config.timeUnit}`);
      } else {
        console.log(`[TIME SYNCER] Created singleton for exchange: ${exchangeName} with default time unit: milliseconds`);
      }
      
      this.instances.set(key, instance);
    }
    
    const instance = this.instances.get(key);
    if (!instance) {
      throw new Error(`Failed to create time syncer for exchange: ${exchangeName}`);
    }

    // Handle initialization in a reentrant-safe way
    if (!instance.isInitialized && serverTimeProvider) {
      // Check if initialization is already in progress
      if (!this.initializationPromises.has(key)) {
        console.log(`[TIME SYNCER] Starting initialization for exchange: ${exchangeName}`);
        
        // Start initialization and store the promise
        const initPromise = this.initializeInstance(instance, serverTimeProvider, exchangeName);
        this.initializationPromises.set(key, initPromise);
        
        // Clean up the promise when done (success or failure)
        void initPromise.finally(() => {
          this.initializationPromises.delete(key);
        });
      }
      
      // Wait for initialization to complete (whether we started it or someone else did)
      await this.initializationPromises.get(key);
    }
    
    return instance;
  }

  /**
   * Private helper method to initialize an instance
   */
  private static async initializeInstance(
    instance: ExchangeTimeSyncer, 
    serverTimeProvider: () => Promise<number>,
    exchangeName: string,
  ): Promise<void> {
    try {
      const serverTime = await serverTimeProvider();
      await instance.initFromServer(serverTime);
      console.log(`[TIME SYNCER] Successfully initialized for exchange: ${exchangeName}`);
    } catch (error) {
      console.error(`[TIME SYNCER] Failed to initialize for exchange: ${exchangeName}`, error);
      throw error;
    }
  }

  /**
   * Clear all cached instances (mainly for testing purposes).
   */
  static clearInstances(): void {
    this.instances.clear();
    this.initializationPromises.clear();
  }

  /**
   * Call this to initialize the time syncer with the server time.
   * This should be called once before using the time syncer.
   * @param serverTime Obtained from the exchange's server time endpoint.
   * It should be the server time in milliseconds.
   * This will set the cached time offset to the difference between the server time and the local time.
   * This is used to synchronize the local time with the server time.
   */
  async initFromServer(serverTime: number): Promise<void> {
    this.cachedTimeOffset = serverTime - Date.now();
    this.isInitialized = true;
  }

  /**
   * `getTimestampString()` returns the server time as a string.
   * It is used to create a timestamp string for API requests.
   */
  getTimestampString(): string {
    return this.now().toString();
  }

  /**
   * @returns the current server time in the configured time unit for this exchange
   * This method is used to synchronize the local time with the server time.
   * It can be used to calculate the time offset between the server and the local machine.
   */
  now(): number {
    const timestampMs = this.getSynchronizedTimestamp();
    
    // Return time in the appropriate unit for this exchange
    if (this.timeUnit === 'seconds') {
      return Math.floor(timestampMs / 1000);
    }
    
    return timestampMs;
  }

  getSynchronizedTimestamp(): number {
    return Date.now() + this.cachedTimeOffset;
  }
}
