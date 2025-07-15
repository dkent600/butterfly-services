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
 * 
 * Exchange-specific services extend this class and implement the abstract methods for their specific APIs.
 */
export abstract class BaseExchangeService {
  private timeSyncer?: IExchangeTimeSyncer;

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
   * @param asset - The asset configuration containing API URL and other details
   * @returns Promise<number> - Server time in milliseconds since epoch
   */
  protected async getRealServerTime(asset: IAsset): Promise<number> {
    try {
      const url = this.getApiUrl(asset, this.getTimeEndpoint());
      const response = await axios.get(url);
      return this.extractServerTime(response.data);
    } catch (error) {
      console.error(`Failed to fetch server time for ${asset.name}:`, error);
      console.error('Attempted URL was:', this.getApiUrl(asset, this.getTimeEndpoint()));
      throw new Error(`Could not fetch server time for ${asset.name}`);
    }
  }

  /**
   * Gets or creates a time syncer for this exchange.
   * The time syncer is shared across all assets for this exchange.
   * 
   * @param asset - The asset configuration (used to get API URL for initial sync)
   * @returns Promise<IExchangeTimeSyncer> - Time syncer instance for this exchange
   */
  protected async getTimeSyncer(asset: IAsset): Promise<IExchangeTimeSyncer> {
    if (!this.timeSyncer) {
      this.timeSyncer = new ExchangeTimeSyncer();
      await this.timeSyncer.initFromServer(await this.getRealServerTime(asset));
    }
    return this.timeSyncer;
  }

  /**
   * Gets a synchronized timestamp string for the given asset.
   * Uses the cached time syncer to provide accurate timestamps for API requests.
   * 
   * @param asset - The asset configuration
   * @returns Promise<string> - Synchronized timestamp string
   */
  protected async getServerTimestamp(asset: IAsset): Promise<string> {
    const timeSyncer = await this.getTimeSyncer(asset);
    return timeSyncer.getTimestampString();
  }

  /**
   * Constructs the full API URL for a given asset and endpoint path.
   * Handles proper URL formatting and path concatenation.
   * 
   * @param asset - The asset object containing API configuration details
   * @param path - The specific API endpoint path to append
   * @returns The complete API URL as a string
   */
  protected getApiUrl(asset: IAsset, path: string): string {
    return `${asset.apiUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
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

  protected createPair(asset: IAsset, to: string = 'USDT'): string {
    return `${asset.name}${to}`;
  }

  /**
   * Calculates the sell amount based on the asset's percentage and current balance.
   * This logic is shared across all exchanges.
   * 
   * @param asset - The asset configuration containing percentage
   * @returns Promise<number> - The amount to sell
   */
  async getSellAmount(asset: IAsset): Promise<number> {
    const balance = await this.fetchBalance(asset);
    return asset.percentage / 100 * balance;
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
