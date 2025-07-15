import axios from 'axios';
import { createHash, createHmac } from 'node:crypto';
import { injectable, inject } from 'tsyringe';
import { IAsset, IExchangeService, IExchangeApiService, IExchangeTimeSyncer, IEnvService, TYPES } from '../types/interfaces.js';
import { ExchangeTimeSyncer } from './exchange-time-syncer.js';

@injectable()
export class KrakenApiService implements IExchangeService {
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
      const url = this.getApiUrl(asset, '/0/public/Time');
      const response = await axios.get(url);
      // Kraken returns time in seconds, convert to milliseconds to match other exchanges
      return response.data.result.unixtime * 1000;
    } catch (error) {
      console.error(`Failed to fetch server time for ${asset.name}:`, error);
      console.error('Attempted URL was:', this.getApiUrl(asset, '/0/public/Time'));
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
    const nodeEnv = this.envService.get('app.environment');
    
    // Only allow live trading if ALL of these conditions are met:
    // 1. useTestMode is explicitly set to false
    // 2. nodeEnv is explicitly set to 'production'
    const isExplicitlyLiveMode = useTestMode === false && nodeEnv === 'production';
    
    // Default to test mode for safety
    return !isExplicitlyLiveMode;
  }

  createPair(asset: IAsset, to: string = 'USDT'): string {
    // Kraken uses different symbols, map common ones
    const krakenAssetMap: { [key: string]: string } = {
      'BTC': 'XXBT',
      'ETH': 'XETH',
      'USD': 'ZUSD',
      'USDT': 'USDT',
    };
    
    const fromSymbol = krakenAssetMap[asset.name.toUpperCase()] || asset.name.toUpperCase();
    const toSymbol = krakenAssetMap[to.toUpperCase()] || to.toUpperCase();
    
    return `${fromSymbol}${toSymbol}`;
  }

  async getSellAmount(asset: IAsset): Promise<number> {
    const balance = await this.fetchBalance(asset);
    return asset.percentage / 100 * balance;
  }

  async fetchPrice(asset: IAsset): Promise<number> {
    try {
      const pair = this.createPair(asset);
      const url = this.getApiUrl(asset, '/0/public/Ticker');
      const { data } = await axios.get(url, {
        params: { pair },
      });
      
      // Kraken returns data in a different format
      const pairData = data.result[pair] || data.result[Object.keys(data.result)[0]];
      if (!pairData) {
        throw new Error(`No price data found for pair ${pair}`);
      }
      
      return parseFloat(pairData.c[0]); // 'c' is the last trade closed array [price, lot volume]
    } catch (error) {
      console.error(`Failed to fetch price for ${asset.name}:`, error);
      // Re-throw the original error if it's already a specific error message
      if (error instanceof Error && error.message.includes('No price data found')) {
        throw error;
      }
      throw new Error(`Could not fetch price for ${asset.name}`);
    }
  }

  /**
   * fetch the number of coins free for the asset
   * @param asset 
   * @returns number of coins free for the asset
   */
  async fetchBalance(asset: IAsset): Promise<number> {
    const nonce = Date.now() * 1000; // Kraken uses microsecond nonce
    const queryString = `nonce=${nonce}`;

    const apiKey = this.exchangeApiService.getAPIKey(asset.exchange);
    const apiSecret = this.exchangeApiService.getAPISecret(asset.exchange);

    // Validate we have the required credentials
    if (!apiKey || !apiSecret) {
      throw new Error(`Missing API credentials for ${asset.exchange}. API Key: ${!!apiKey}, API Secret: ${!!apiSecret}`);
    }

    // Kraken uses different signing method - need to implement custom signing for Kraken
    const urlPath = '/0/private/Balance';
    const signature = this.signKrakenRequest(urlPath, queryString, apiSecret, nonce);

    try {
      const url = this.getApiUrl(asset, urlPath);

      const { data } = await axios.post(url, queryString, {
        headers: {
          'API-Key': apiKey,
          'API-Sign': signature,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      if (data.error && data.error.length > 0) {
        throw new Error(`Kraken API error: ${data.error.join(', ')}`);
      }

      // Kraken asset mapping
      const krakenAssetMap: { [key: string]: string } = {
        'BTC': 'XXBT',
        'ETH': 'XETH',
      };
      
      const krakenAsset = krakenAssetMap[asset.name.toUpperCase()] || asset.name.toUpperCase();
      const balance = parseFloat(data.result[krakenAsset] || '0');

      return balance;
    } catch (error) {
      console.error(`Failed to fetch balance for ${asset.name}:`, error);
      console.error('Request details:', {
        url: this.getApiUrl(asset, '/0/private/Balance'),
        hasApiKey: !!apiKey,
        hasApiSecret: !!apiSecret,
        errorResponse: (error as any).response?.data,
      });
      // Re-throw the original error if it's already a specific error message
      if (error instanceof Error && error.message.includes('Kraken API error')) {
        throw error;
      }
      throw new Error(`Could not fetch balance for ${asset.name}`);
    }
  }

  /**
   * Kraken uses a different signing method than MEXC
   */
  private signKrakenRequest(urlPath: string, queryString: string, apiSecret: string, nonce: number): string {
    // Create the message to sign
    const message = queryString;
    const hash = createHash('sha256').update(nonce + message).digest();
    const hmac = createHmac('sha512', Buffer.from(apiSecret, 'base64'));
    hmac.update(urlPath, 'utf8');
    hmac.update(hash);
    
    return hmac.digest('base64');
  }

  async createMarketSellOrder(asset: IAsset, to: string = 'USDT'): Promise<any> {
    const pair = this.createPair(asset, to);
    const quantity = await this.getSellAmount(asset);
    const nonce = Date.now() * 1000; // Kraken uses microsecond nonce
    
    // Kraken order parameters
    const orderParams = new URLSearchParams({
      nonce: nonce.toString(),
      ordertype: 'market',
      type: 'sell',
      volume: quantity.toString(),
      pair,
    });

    if (this.shouldUseTestMode()) {
      orderParams.append('validate', 'true'); // Kraken's test mode parameter
    }

    const queryString = orderParams.toString();
    const urlPath = '/0/private/AddOrder';
    const signature = this.signKrakenRequest(urlPath, queryString, this.exchangeApiService.getAPISecret(asset.exchange), nonce);

    // For compatibility with ExchangeApiService, we put the data in the URL
    // Note: This is not ideal for Kraken which expects POST body, but maintains compatibility
    const url = `${this.getApiUrl(asset, urlPath)}?${queryString}&signature=${encodeURIComponent(signature)}`;

    const headers = {
      'API-Key': this.exchangeApiService.getAPIKey(asset.exchange),
      'API-Sign': signature,
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    return this.exchangeApiService.createMarketSellOrder(
      pair,
      quantity,
      asset.exchange,
      nonce.toString(),
      url,
      headers,
    );
  }
}
