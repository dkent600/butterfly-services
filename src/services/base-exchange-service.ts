import axios from 'axios';
import { IAsset, IExchangeTimeSyncer, IEnvService } from '../types/interfaces.js';
import { ExchangeTimeSyncer, ExchangeTimeConfig, TimeUnit } from './exchange-time-syncer.js';

/**
 * Abstract base class for exchange services that provides common time synchronization functionality.
 * 
 * This class eliminates redundancy across exchange services by providing shared implementations for:
 * - Time syncer caching and management
 * - Server timestamp retrieval
 * - Test mode configuration
 * - Common utility methods
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
   * @returns number - Server time in configured units (milliseconds or seconds) since epoch
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
   * Abstract method to get the time unit for this exchange.
   * Each exchange may require timestamps in different units (seconds vs milliseconds).
   * 
   * @returns TimeUnit - The time unit this exchange expects ('seconds' or 'milliseconds')
   */
  protected abstract getTimeUnit(): TimeUnit;

  /**
   * Gets the singleton time syncer for this exchange.
   * Uses the factory method to ensure all service instances for the same exchange share one time syncer.
   * 
   * @returns Promise<IExchangeTimeSyncer> - Singleton time syncer instance for this exchange
   */
  protected async getTimeSyncer(): Promise<IExchangeTimeSyncer> {
    const exchangeName = this.getExchangeName();
    
    // Pass server time provider function and time unit configuration to factory
    const serverTimeProvider = () => this.getRealServerTime();
    const config: ExchangeTimeConfig = {
      timeUnit: this.getTimeUnit(),
    };
    
    const timeSyncer = await ExchangeTimeSyncer.getForExchange(exchangeName, serverTimeProvider, config);
    
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
   * 
   * @returns boolean - True if test mode should be used, false for live trading
   */
  protected shouldUseTestMode(): boolean {
    // SAFETY FIRST: Always default to test mode unless explicitly disabled
    const useTestMode = this.envService.getBoolean('app.useTestMode');
    const nodeEnv = this.envService.get('app.environment');
    
    // Only allow live trading if ALL of these conditions are met:
    // 1. useTestMode is explicitly set to false
    // 2. NODE_ENV is production
    // 3. Environment is properly configured
    if (useTestMode === false && nodeEnv === 'production') {
      return false; // Live trading mode
    }
    
    return true; // Test mode (safe default)
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
