import { IAsset, IExchangeApiService, IExchangeService } from "./exchange-api-service.js";
import axios from 'axios';
import { ExchangeTimeSyncer, IExchangeTimeSyncer } from './exchange-time-syncer.js';
import { IEnvService } from "./env-service.js";


export class MexcApiService implements IExchangeService {
  private readonly exchangeTimeSyncer: IExchangeTimeSyncer;
  /**
   * assuming here that this is a singleton service, so we can cache the time syncers
   */
  private cachedTimeSyncers: Map<IAsset, IExchangeTimeSyncer> = new Map();

  constructor(
    private readonly exchangeApiService: IExchangeApiService,
    private readonly envService: IEnvService) {
    this.exchangeTimeSyncer = new ExchangeTimeSyncer('MEXC');
  }

  private async getTimeSyncer(asset: IAsset): Promise<IExchangeTimeSyncer> {
    if (!this.cachedTimeSyncers.has(asset)) {
      const timeSyncer = new ExchangeTimeSyncer(asset.exchange)
      this.cachedTimeSyncers.set(asset, timeSyncer);
      await timeSyncer.initFromServer(await this.getRealServerTime(asset));
    }
    return Promise.resolve(this.cachedTimeSyncers.get(asset));
  }

  /**
   * Constructs the full API URL for a given asset and endpoint path.
   *
   * @param asset - The asset object containing API configuration details.
   * @param path - The specific API endpoint path to append.
   * @returns The proxied API URL as a string.
   */
  private getApiUrl(asset: IAsset, path: string): string {
    return `${asset.apiUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : '/' + path}`;
  }

  private async getRealServerTime(asset: IAsset): Promise<number> {
    try {
      const url = this.getApiUrl(asset, '/api/v3/time');
      // console.log('Fetching server time from URL:', url);
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

  createPair(asset: IAsset, to: string = 'USDT'): string {
    return `${asset.name}${to}`;
  }

  async getSellAmount(asset: IAsset): Promise<number> {
    const balance = await this.fetchBalance(asset)
    return asset.percentage / 100 * balance;
  }

  async fetchPrice(asset: IAsset): Promise<number> {
    try {
      const url = this.getApiUrl(asset, '/api/v3/ticker/price');
      const { data } = await axios.get(url, {
        params: { symbol: `${this.createPair(asset)}` },
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

    // console.log('fetchBalance debug info:', {
    //   asset: asset.name,
    //   exchange: asset.exchange,
    //   timestamp,
    //   queryString,
    //   signature: signature.substring(0, 10) + '...', // Only show first 10 chars for security
    //   apiKey: apiKey.substring(0, 10) + '...',
    //   url: this.getApiUrl(asset, '/api/v3/account'),
    //   timestampAge: Date.now() - parseInt(timestamp)
    // });

    try {
      const baseUrl = this.getApiUrl(asset, '/api/v3/account');
      const url = `${baseUrl}?${queryString}&signature=${signature}`;

      // console.log('Final request URL:', url);

      const { data } = await axios.get(url, {
        headers: {
          'X-MEXC-APIKEY': apiKey,
          "Content-Type": "application/json",
        },
      });

      let balance = 0;

      for (const coin of data.balances) {
        if (coin.asset.toLowerCase() === asset.name.toLowerCase()) {
          balance = parseFloat(coin.free);
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
        errorResponse: error.response?.data
      });
      throw new Error(`Could not fetch balance for ${asset.name}`);
    }
  }

  async createMarketSellOrder(asset: IAsset, to: string = 'USDT') {

    const coinpair = this.createPair(asset, to);
    const quantity = await this.getSellAmount(asset);
    const timestamp = await this.getServerTimestamp(asset);
    const queryString = `symbol=${coinpair}&side=SELL&type=MARKET&quantity=${quantity}&timestamp=${timestamp}`;

    const signature = this.exchangeApiService.sign(queryString, this.exchangeApiService.getAPISecret(asset.exchange));

    const url = `${this.getApiUrl(asset, '/api/v3/order/test')}?${queryString}&signature=${signature}`;

    const headers = {
      'X-MEXC-APIKEY': this.exchangeApiService.getAPIKey(asset.exchange),
      "Content-Type": "application/json",
    };

    return this.exchangeApiService.createMarketSellOrder(
      this.createPair(asset, to),
      quantity,
      asset.exchange,
      timestamp,
      url,
      headers);
  }
}