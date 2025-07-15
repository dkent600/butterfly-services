import axios from 'axios';
import crypto from 'node:crypto';
import { injectable, inject } from 'tsyringe';
import { IAsset, IExchangeService, IExchangeApiService, IEnvService, TYPES } from '../types/interfaces.js';
import { BaseExchangeService } from './base-exchange-service.js';

@injectable()
export class KrakenApiService extends BaseExchangeService implements IExchangeService {
  constructor(
    @inject(TYPES.IExchangeApiService) private readonly exchangeApiService: IExchangeApiService,
    @inject(TYPES.IEnvService) envService: IEnvService,
  ) {
    super(envService);
  }

  protected async getRealServerTime(asset: IAsset): Promise<number> {
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

  /**
   * Maps common asset names to Kraken's naming convention
   */
  createPair(asset: IAsset, to: string = 'USDT'): string {
    const krakenAssetMap: Record<string, string> = {
      'BTC': 'XXBT',
      'ETH': 'XETH',
      'USD': 'ZUSD',
      'USDT': 'USDT', // USDT remains the same
    };

    const krakenAsset = krakenAssetMap[asset.name.toUpperCase()] || asset.name.toUpperCase();
    const krakenTo = krakenAssetMap[to.toUpperCase()] || to.toUpperCase();
    return `${krakenAsset}${krakenTo}`;
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

      if (!data.result?.[pair]) {
        throw new Error(`No price data found for pair ${pair}`);
      }

      // Kraken returns price data in a nested structure
      const priceData = data.result[pair];
      return parseFloat(priceData.c[0]); // 'c' is the last trade closed array, [0] is price
    } catch (error) {
      console.error(`Failed to fetch price for ${asset.name}:`, error);
      throw new Error(`Could not fetch price for ${asset.name}`);
    }
  }

  async fetchBalance(asset: IAsset): Promise<number> {
    try {
      const nonce = Date.now() * 1000; // Kraken requires microsecond nonce
      const path = '/0/private/Balance';
      const postData = `nonce=${nonce}`;

      const apiKey = this.exchangeApiService.getAPIKey(asset.exchange);
      const apiSecret = this.exchangeApiService.getAPISecret(asset.exchange);

      if (!apiKey || !apiSecret) {
        throw new Error(`Missing API credentials for ${asset.exchange}. API Key: ${!!apiKey}, API Secret: ${!!apiSecret}`);
      }

      const signature = this.signKrakenRequest(path, postData, apiSecret);
      const url = this.getApiUrl(asset, path);

      const { data } = await axios.post(url, postData, {
        headers: {
          'API-Key': apiKey,
          'API-Sign': signature,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      if (data.error && data.error.length > 0) {
        throw new Error(`Kraken API error: ${data.error.join(', ')}`);
      }

      // Map asset name to Kraken format for balance lookup
      const krakenAssetName = this.createPair({ ...asset, name: asset.name }, '').replace(/USDT$|USD$/, '');
      let balance = 0;

      if (data.result?.[krakenAssetName]) {
        balance = parseFloat(data.result[krakenAssetName]);
      }

      return balance;
    } catch (error) {
      console.error(`Failed to fetch balance for ${asset.name}:`, error);
      console.error('Request details:', {
        url: this.getApiUrl(asset, '/0/private/Balance'),
        hasApiKey: !!this.exchangeApiService.getAPIKey(asset.exchange),
        hasApiSecret: !!this.exchangeApiService.getAPISecret(asset.exchange),
        errorResponse: (error as any).response?.data,
      });
      throw new Error(`Could not fetch balance for ${asset.name}`);
    }
  }

  async createMarketSellOrder(asset: IAsset, to: string = 'USDT'): Promise<any> {
    const pair = this.createPair(asset, to);
    const volume = await this.getSellAmount(asset);
    const nonce = Date.now() * 1000;
    
    // Kraken API parameters for market sell order
    const orderParams = {
      nonce: nonce.toString(),
      ordertype: 'market',
      type: 'sell',
      volume: volume.toString(),
      pair,
      ...(this.shouldUseTestMode() && { validate: 'true' }), // Add validate=true for test mode
    };

    const postData = new URLSearchParams(orderParams).toString();
    const path = '/0/private/AddOrder';
    const apiSecret = this.exchangeApiService.getAPISecret(asset.exchange);
    const signature = this.signKrakenRequest(path, postData, apiSecret);

    const url = this.getApiUrl(asset, path);
    const headers = {
      'API-Key': this.exchangeApiService.getAPIKey(asset.exchange),
      'API-Sign': signature,
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    return this.exchangeApiService.createMarketSellOrder(
      pair,
      volume,
      asset.exchange,
      nonce.toString(),
      url,
      headers,
      postData,
    );
  }

  /**
   * Creates Kraken-specific API signature
   */
  private signKrakenRequest(path: string, postData: string, apiSecret: string): string {
    const message = path + crypto.createHash('sha256').update(postData).digest();
    const signature = crypto.createHmac('sha512', Buffer.from(apiSecret, 'base64'))
      .update(message)
      .digest('base64');
    return signature;
  }
}
