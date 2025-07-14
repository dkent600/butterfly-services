import axios from 'axios';
import { injectable, inject } from 'tsyringe';
import { IAsset, IExchangeService, IExchangeApiService, IExchangeTimeSyncer, IEnvService, TYPES } from '../types/interfaces.js';
import { ExchangeTimeSyncer } from './exchange-time-syncer.js';

@injectable()
export class MexcApiService implements IExchangeService {
  /**
   * assuming here that this is a singleton service, so we can cache the time syncers
   */
  private cachedTimeSyncers: Map<IAsset, IExchangeTimeSyncer> = new Map();

  constructor(
    @inject(TYPES.IExchangeApiService) private readonly exchangeApiService: IExchangeApiService,
    @inject(TYPES.IEnvService) private readonly envService: IEnvService,
  ) { }

  private async getTimeSyncer(asset: IAsset): Promise<IExchangeTimeSyncer> {
    if (!this.cachedTimeSyncers.has(asset)) {
      const timeSyncer = new ExchangeTimeSyncer();
      this.cachedTimeSyncers.set(asset, timeSyncer);
      await timeSyncer.initFromServer(await this.getRealServerTime(asset));
    }
    return this.cachedTimeSyncers.get(asset) as ExchangeTimeSyncer;
  }

  /**
   * Constructs the full API URL for a given asset and endpoint path.
   *
   * @param asset - The asset object containing API configuration details.
   * @param path - The specific API endpoint path to append.
   * @returns The proxied API URL as a string.
   */
  private getApiUrl(asset: IAsset, path: string): string {
    return `${asset.apiUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
  }

  private async getRealServerTime(asset: IAsset): Promise<number> {
    try {
      const url = this.getApiUrl(asset, '/api/v3/time');
      const response = await axios.get(url);
      return response.data.serverTime;
    } catch (error) {
      console.error(`Failed to fetch server time for ${asset.name}:`, error);
      console.error('Attempted URL was:', this.getApiUrl(asset, '/api/v3/time'));
      throw new Error(`Could not fetch server time for ${asset.name}`);
    }
  }

  private async getServerTimestamp(asset: IAsset): Promise<string> {
    const timeSyncer = await this.getTimeSyncer(asset);
    return timeSyncer.getTimestampString();
  }

  private shouldUseTestMode(): boolean {
    // SAFETY FIRST: Always default to test mode unless explicitly disabled
    const useTestMode = this.envService.getBoolean('app.useTestMode');
    const nodeEnv = this.envService.get('app.environment') || process.env.NODE_ENV;
    
    // Only allow live trading if ALL of these conditions are met:
    // 1. useTestMode is explicitly set to false
    // 2. nodeEnv is explicitly set to 'production'
    const isExplicitlyLiveMode = useTestMode === false && nodeEnv === 'production';
    
    // Default to test mode for safety
    return !isExplicitlyLiveMode;
  }

  createPair(asset: IAsset, to: string = 'USDT'): string {
    return `${asset.name}${to}`;
  }

  async getSellAmount(asset: IAsset): Promise<number> {
    const balance = await this.fetchBalance(asset);
    return asset.percentage / 100 * balance;
  }

  async fetchPrice(asset: IAsset): Promise<number> {
    try {
      const url = this.getApiUrl(asset, '/api/v3/ticker/price');
      const { data } = await axios.get(url, {
        params: { symbol: this.createPair(asset) },
      });
      return parseFloat(data.price);
    } catch (error) {
      console.error(`Failed to fetch price for ${asset.name}:`, error);
      throw new Error(`Could not fetch price for ${asset.name}`);
    }
  }

  /**
   * fetch the number of coins free for the asset
   * @param asset 
   * @returns number of coins free for the asset
   */
  async fetchBalance(asset: IAsset): Promise<number> {
    const timestamp = await this.getServerTimestamp(asset);
    const queryString = `timestamp=${timestamp}`;

    const apiKey = this.exchangeApiService.getAPIKey(asset.exchange);
    const apiSecret = this.exchangeApiService.getAPISecret(asset.exchange);

    // Validate we have the required credentials
    if (!apiKey || !apiSecret) {
      throw new Error(`Missing API credentials for ${asset.exchange}. API Key: ${!!apiKey}, API Secret: ${!!apiSecret}`);
    }

    const signature = this.exchangeApiService.sign(queryString, apiSecret);

    try {
      const baseUrl = this.getApiUrl(asset, '/api/v3/account');
      const url = `${baseUrl}?${queryString}&signature=${signature}`;

      const { data } = await axios.get(url, {
        headers: {
          'X-MEXC-APIKEY': apiKey,
          'Content-Type': 'application/json',
        },
      });

      let balance = 0;

      for (const coin of data.balances) {
        if (coin.asset.toLowerCase() === asset.name.toLowerCase()) {
          balance = parseFloat(coin.free);
          break;
        }
      }

      return balance;
    } catch (error) {
      console.error(`Failed to fetch balance for ${asset.name}:`, error);
      console.error('Request details:', {
        url: this.getApiUrl(asset, '/api/v3/account'),
        timestamp,
        queryString,
        hasApiKey: !!apiKey,
        hasApiSecret: !!apiSecret,
        errorResponse: (error as any).response?.data,
      });
      throw new Error(`Could not fetch balance for ${asset.name}`);
    }
  }

  async createMarketSellOrder(asset: IAsset, to: string = 'USDT'): Promise<any> {
    const coinpair = this.createPair(asset, to);
    const quantity = await this.getSellAmount(asset);
    const timestamp = await this.getServerTimestamp(asset);
    const queryString = `symbol=${coinpair}&side=SELL&type=MARKET&quantity=${quantity}&timestamp=${timestamp}`;

    const signature = this.exchangeApiService.sign(queryString, this.exchangeApiService.getAPISecret(asset.exchange));

    // Use test mode based on environment configuration
    const endpoint = this.shouldUseTestMode() ? '/api/v3/order/test' : '/api/v3/order';
    const url = `${this.getApiUrl(asset, endpoint)}?${queryString}&signature=${signature}`;

    const headers = {
      'X-MEXC-APIKEY': this.exchangeApiService.getAPIKey(asset.exchange),
      'Content-Type': 'application/json',
    };

    return this.exchangeApiService.createMarketSellOrder(
      coinpair,
      quantity,
      asset.exchange,
      timestamp,
      url,
      headers,
    );
  }
}
