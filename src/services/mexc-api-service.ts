import axios from 'axios';
import { injectable, inject } from 'tsyringe';
import { IAsset, IExchangeService, IExchangeApiService, IEnvService, TYPES } from '../types/interfaces.js';
import { BaseExchangeService } from './base-exchange-service.js';

@injectable()
export class MexcApiService extends BaseExchangeService implements IExchangeService {
  private lastNonce: number = 0;

  constructor(
    @inject(TYPES.IExchangeApiService) private readonly exchangeApiService: IExchangeApiService,
    @inject(TYPES.IEnvService) envService: IEnvService,
  ) {
    super(envService);
  }

  protected getTimeEndpoint(): string {
    return '/api/v3/time';
  }

  protected getApiBaseUrl(): string {
    return 'https://api.mexc.com';
  }

  protected extractServerTime(responseData: any): number {
    return responseData.serverTime;
  }

  private ensureUniqueNonce(timestamp: number): number {
    // MEXC requires strictly increasing nonces for authenticated requests
    if (timestamp <= this.lastNonce) {
      this.lastNonce = this.lastNonce + 1;
    } else {
      this.lastNonce = timestamp;
    }
    return this.lastNonce;
  }

  async fetchPrice(asset: IAsset): Promise<number> {
    try {
      const url = this.getApiUrl('/api/v3/ticker/price');
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
    // Enhanced nonce generation: Use time syncer for accurate server-synchronized timestamp
    const timeSyncer = await this.getTimeSyncer(asset);
    const timestamp = this.ensureUniqueNonce(timeSyncer.now());
    const queryString = `timestamp=${timestamp}`;

    const apiKey = this.exchangeApiService.getAPIKey(asset.exchange);
    const apiSecret = this.exchangeApiService.getAPISecret(asset.exchange);

    // Validate we have the required credentials
    if (!apiKey || !apiSecret) {
      throw new Error(`Missing API credentials for ${asset.exchange}. API Key: ${!!apiKey}, API Secret: ${!!apiSecret}`);
    }

    const signature = this.exchangeApiService.sign(queryString, apiSecret);

    try {
      const baseUrl = this.getApiUrl('/api/v3/account');
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
        url: this.getApiUrl('/api/v3/account'),
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
    const quantity = asset.amount;
    // Enhanced nonce generation: Use time syncer for accurate server-synchronized timestamp
    const timeSyncer = await this.getTimeSyncer(asset);
    const timestamp = this.ensureUniqueNonce(timeSyncer.now());
    const queryString = `symbol=${coinpair}&side=SELL&type=MARKET&quantity=${quantity}&timestamp=${timestamp}`;

    const signature = this.exchangeApiService.sign(queryString, this.exchangeApiService.getAPISecret(asset.exchange));

    // Use test mode based on environment configuration
    const endpoint = this.shouldUseTestMode() ? '/api/v3/order/test' : '/api/v3/order';
    const url = `${this.getApiUrl(endpoint)}?${queryString}&signature=${signature}`;

    const headers = {
      'X-MEXC-APIKEY': this.exchangeApiService.getAPIKey(asset.exchange),
      'Content-Type': 'application/json',
    };

    return this.exchangeApiService.createMarketSellOrder(
      coinpair,
      quantity,
      asset.exchange,
      {
        url,
        method: 'POST',
        headers,
      },
    );
  }
}
