import axios from 'axios';
import { IAsset, IExchangeTimeSyncer, IEnvService } from '../types/interfaces.js';
import { ExchangeTimeSyncer } from './exchange-time-syncer.js';

/**
 * Abstract base class for exchange services that provides common time synchronization functionality.
 * 
 * This class eliminates redundancy across exchange services by providing shared implementations for:
 * - Time syncer caching and management
 * - Server timestamp retrieval
 * - Test mode configuration
 * - Common utility methods
 * - Queued nonce generation for strict ordering
 * 
 * Exchange-specific services extend this class and implement the abstract methods for their specific APIs.
 */
export abstract class BaseExchangeService {

  constructor(
    protected readonly envService: IEnvService,
  ) {}

  /**
   * Abstract method to get the time endpoint for the specific exchange.
   * Each exchange provides its own endpoint path.
   * 
   * @returns string - The endpoint path for getting server time
   */
  protected abstract getTimeEndpoint(): string;

  /**
   * Abstract method to get the API base URL for the specific exchange.
   * Each exchange provides its own API URL.
   * 
   * @returns string - The base API URL for the exchange
   */
  protected abstract getApiBaseUrl(): string;

  /**
   * Abstract method to extract server time from the exchange's response.
   * Each exchange has its own response format.
   * 
   * @param responseData - The response data from the exchange API
   * @returns number - Server time in milliseconds since epoch
   */
  protected abstract extractServerTime(responseData: any): number;

  /**
   * Concrete implementation to fetch server time from any exchange.
   * Uses the abstract methods to get exchange-specific endpoint and parse response.
   * 
   * @returns Promise<number> - Server time in milliseconds since epoch
   */
  protected async getRealServerTime(): Promise<number> {
    try {
      const url = this.getApiUrl(this.getTimeEndpoint());
      const response = await axios.get(url);
      return this.extractServerTime(response.data);
    } catch (error) {
      const exchangeName = this.getExchangeName();
      console.error(`Failed to fetch server time for ${exchangeName}:`, error);
      console.error('Attempted URL was:', this.getApiUrl(this.getTimeEndpoint()));
      throw new Error(`Could not fetch server time for ${exchangeName}`);
    }
  }

  /**
   * Abstract method to get the exchange name for this service.
   * Each exchange service provides its own exchange identifier.
   * 
   * @returns string - The exchange name (e.g., 'kraken', 'mexc')
   */
  protected abstract getExchangeName(): string;

  /**
   * Gets the singleton time syncer for this exchange.
   * Uses the factory method to ensure all service instances for the same exchange share one time syncer.
   * Time syncer always returns milliseconds for consistency.
   * 
   * @returns Promise<IExchangeTimeSyncer> - Singleton time syncer instance for this exchange
   */
  protected async getTimeSyncer(): Promise<IExchangeTimeSyncer> {
    const exchangeName = this.getExchangeName();
    
    // Pass server time provider function to factory
    const serverTimeProvider = () => this.getRealServerTime();
    
    const timeSyncer = await ExchangeTimeSyncer.getForExchange(exchangeName, serverTimeProvider);
    
    return timeSyncer;
  }

  /**
   * Gets a synchronized timestamp string for this exchange.
   * Uses the cached time syncer to provide accurate timestamps for API requests.
   * 
   * @returns Promise<string> - Synchronized timestamp string
   */
  protected async getServerTimestamp(): Promise<string> {
    const timeSyncer = await this.getTimeSyncer();
    return timeSyncer.getTimestampString();
  }

  /**
   * Generates a unique, strictly increasing nonce using atomic compare-and-swap pattern.
   * This method is thread-safe and prevents race conditions in concurrent scenarios.
   * 
   * @param globalNonceRef - Reference to the global nonce counter for this exchange
   * @param exchangeName - Name of the exchange for logging purposes
   * @param instanceId - Optional instance ID for debugging
   * @returns Promise<number> - Unique nonce in milliseconds
   */
  protected async generateAtomicNonce(
    globalNonceRef: { value: number },
    exchangeName: string,
    instanceId?: number,
  ): Promise<number> {
    // Get server-synchronized time in milliseconds - do this ONCE per call
    const timeSyncer = await this.getTimeSyncer();
    const currentTimeMs = Math.floor(timeSyncer.now());
    
    // Enhanced time validation with detailed logging
    const now = Date.now();
    const timeDiff = Math.abs(currentTimeMs - now);
    
    if (timeDiff > 300000) { // More than 5 minutes off
      console.warn(`[${exchangeName.toUpperCase()} NONCE] Warning: Server time ${currentTimeMs} differs significantly from local time ${now} (diff: ${timeDiff}ms). Using local time.`);
      const fallbackTime = now;
      return this.performAtomicNonceGeneration(globalNonceRef, fallbackTime, exchangeName, instanceId);
    } else if (timeDiff > 60000) { // More than 1 minute off - warn but continue
      console.warn(`[${exchangeName.toUpperCase()} NONCE] Notice: Server time ${currentTimeMs} differs from local time ${now} by ${timeDiff}ms.`);
    }
    
    // Additional validation: ensure nonce is reasonable (not too old)
    const oldestAllowed = now - 86400000; // 24 hours ago
    const actualTime = Math.max(currentTimeMs, oldestAllowed);
    
    if (actualTime !== currentTimeMs) {
      console.warn(`[${exchangeName.toUpperCase()} NONCE] Adjusted time from ${currentTimeMs} to ${actualTime} (minimum threshold)`);
    }
    
    return this.performAtomicNonceGeneration(globalNonceRef, actualTime, exchangeName, instanceId);
  }

  /**
   * Performs the actual atomic nonce generation logic with proper serialization
   */
  private performAtomicNonceGeneration(
    globalNonceRef: { value: number },
    currentTimeMs: number,
    exchangeName: string,
    instanceId?: number,
  ): number {
    // TRULY SEQUENTIAL nonce generation - always increment by 1, never reset to time
    let generatedNonce = 0;
    let attempts = 0;
    const maxAttempts = 100;
    const startTime = Date.now();
    
    const instanceStr = instanceId ? ` Instance #${instanceId}` : '';
    console.log(`[${exchangeName.toUpperCase()} NONCE]${instanceStr} Starting generation - Current global: ${globalNonceRef.value}, Server time: ${currentTimeMs}`);
    
    while (attempts < maxAttempts) {
      const currentGlobalNonce = globalNonceRef.value;
      
      // ALWAYS increment by exactly 1 - this is the only way to ensure no duplicates
      // Even if time goes backwards, we maintain strict sequence
      generatedNonce = currentGlobalNonce + 1;
      
      // Ensure nonce is at least as large as server time, but never decrease the sequence
      if (generatedNonce < currentTimeMs) {
        generatedNonce = Math.max(currentTimeMs, currentGlobalNonce + 1);
        console.log(`[${exchangeName.toUpperCase()} NONCE]${instanceStr} Boosted nonce from ${currentGlobalNonce + 1} to ${generatedNonce} to match server time`);
      }
      
      if (attempts > 0) {
        console.log(`[${exchangeName.toUpperCase()} NONCE]${instanceStr} Retry attempt ${attempts}: global was ${currentGlobalNonce}, generating ${generatedNonce}`);
      }
      
      // Atomic compare-and-swap: only update if no other thread changed the value
      if (globalNonceRef.value === currentGlobalNonce) {
        globalNonceRef.value = generatedNonce;
        break;
      }
      // Another thread updated it, retry with the new value
      attempts++;
    }
    
    if (attempts >= maxAttempts) {
      console.error(`[${exchangeName.toUpperCase()} NONCE]${instanceStr} CRITICAL: Failed to generate unique nonce after ${maxAttempts} attempts! Final global value: ${globalNonceRef.value}`);
      throw new Error(`Failed to generate unique nonce after ${maxAttempts} attempts`);
    }
    
    const duration = Date.now() - startTime;
    
    // Enhanced debug logging with timing analysis and validation checks
    console.log(`[${exchangeName.toUpperCase()} NONCE]${instanceStr} SUCCESS: Generated ${generatedNonce} in ${duration}ms after ${attempts} attempts`);
    console.log(`[${exchangeName.toUpperCase()} NONCE]${instanceStr} Validation: serverTime=${currentTimeMs}, nonce=${generatedNonce}, globalRef=${globalNonceRef.value}`);
    
    // Sanity check: ensure nonce is reasonable
    if (generatedNonce < currentTimeMs) {
      console.error(`[${exchangeName.toUpperCase()} NONCE]${instanceStr} ERROR: Generated nonce ${generatedNonce} is less than server time ${currentTimeMs}!`);
    }
    
    if (generatedNonce < globalNonceRef.value) {
      console.error(`[${exchangeName.toUpperCase()} NONCE]${instanceStr} ERROR: Generated nonce ${generatedNonce} is less than global reference ${globalNonceRef.value}!`);
    }
    
    return generatedNonce;
  }

  /**
   * Constructs the full API URL for a given endpoint path.
   * Uses the exchange's base API URL from the abstract method.
   * 
   * @param path - The specific API endpoint path to append
   * @returns The complete API URL as a string
   */
  protected getApiUrl(path: string): string {
    const baseUrl = this.getApiBaseUrl();
    return `${baseUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
  }

  /**
   * Determines if the service should operate in test mode.
   * SAFETY FIRST: Always defaults to test mode unless explicitly disabled.
   * Delegates to EnvService for centralized environment logic.
   * 
   * @returns boolean - True if test mode should be used, false for live trading
   */
  protected shouldUseTestMode(): boolean {
    // Delegate to EnvService for centralized production mode logic
    const isProduction = this.envService.isProduction();

    if (isProduction) {
      console.log('MODE: Running in PRODUCTION mode');
      return false; // Production mode
    } else {
      console.log('MODE: Running in TEST/DEVELOPMENT mode (safe default)');
      return true; // Test/development mode (safe default)
    }
  }

  public createPair(asset: IAsset, to: string): string {
    return `${asset.name}${to}`;
  }

  /**
   * Abstract method to fetch the balance for an asset.
   * Each exchange has its own API for getting account balances.
   * 
   * @param asset - The asset to get balance for
   * @returns Promise<number> - The available balance
   */
  abstract fetchBalance(asset: IAsset): Promise<number>;
}
