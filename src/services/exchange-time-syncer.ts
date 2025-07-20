import { injectable } from 'tsyringe';
import { IExchangeTimeSyncer } from '../types/interfaces.js';

/**
 * ExchangeTimeSyncer is used to synchronize the local time with the server time for a specific exchange.
 * Always returns time in milliseconds for consistency and simplicity.
 */
@injectable()
export class ExchangeTimeSyncer implements IExchangeTimeSyncer {
  private static instances: Map<string, ExchangeTimeSyncer> = new Map();
  private static initializationPromises: Map<string, Promise<void>> = new Map();
  private cachedTimeOffset: number = 0;
  private isInitialized: boolean = false;

  /**
   * Factory method to get or create a singleton ExchangeTimeSyncer for a specific exchange.
   * This method is reentrant-safe and handles concurrent initialization properly.
   * 
   * @param exchangeName - The name of the exchange (e.g., 'kraken', 'mexc')
   * @param serverTimeProvider - Optional function to get server time for initialization
   * @returns ExchangeTimeSyncer - Singleton instance for the specified exchange
   */
  static async getForExchange(
    exchangeName: string, 
    serverTimeProvider?: () => Promise<number>,
  ): Promise<ExchangeTimeSyncer> {
    const key = exchangeName.toLowerCase();
    
    // Create instance if it doesn't exist
    if (!this.instances.has(key)) {
      const instance = new ExchangeTimeSyncer();
      console.log(`[TIME SYNCER] Created singleton for exchange: ${exchangeName} (always returns milliseconds)`);
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
   * @returns the current server time in milliseconds
   * This method is used to synchronize the local time with the server time.
   * It can be used to calculate the time offset between the server and the local machine.
   * If not initialized, falls back to local time with a warning.
   */
  now(): number {
    if (!this.isInitialized) {
      console.warn('[TIME SYNCER] Warning: Time syncer not initialized, using local time. This may cause nonce issues.');
      return Date.now();
    }
    return this.getSynchronizedTimestamp();
  }

  getSynchronizedTimestamp(): number {
    return Date.now() + this.cachedTimeOffset;
  }
}
