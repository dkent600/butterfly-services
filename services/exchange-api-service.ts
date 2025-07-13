import axios from 'axios';
import { createHmac } from 'node:crypto';
import { ILogService, LogService } from './log-service.js';
import { IEnvService } from './env-service.js';

export interface IAsset {
  name: string;
  exchange: string;
  percentage: number;
  apiUrl: string;
}

export interface IExchangeService {
  createPair(asset: IAsset, to?: string): string;
  getSellAmount(asset: IAsset): Promise<number>;
  fetchPrice(asset: IAsset): Promise<number>;
  fetchBalance(asset: IAsset): Promise<number>;
  createMarketSellOrder(asset: IAsset, to?: string): Promise<any>;
}

export type IExchangeApiService = {
  createMarketSellOrder(
    coinpair: string,
    quantity: number,
    exchangeName: string,
    timestamp: string,
    apiUrl: string,
    headers: Record<string, string>): Promise<void>;

  sign(queryString: string, apiSecret: string)

  getAPIKey(exchange: string): string;
  getAPISecret(exchange: string): string;
};

export class ExchangeApiService implements IExchangeApiService {

  private logService: ILogService;
  private envService: IEnvService;

  constructor() {
    this.logService = new LogService();
  }

  getAPIKey(exchange): string {
    return this.envService.get(`api.${exchange}.apiKey`);
  }

  getAPISecret(exchange): string {
    return this.envService.get(`api.${exchange}.apiKey`);
  }

  sign(queryString: string, apiSecret: string): string {
    return createHmac('sha256', apiSecret).update(queryString).digest('hex');
  }

  /**
   * Create a market sell order.
   * @param coinpair `${from}${to}`
   * @param quantity of tokens to sell
   * @param exchangeName The exchange to use for the order
   */
  async createMarketSellOrder(
    coinpair: string,
    quantity: number,
    exchangeName: string,
    timestamp: string,
    apiUrl: string,
    headers: Record<string, string>): Promise<void> {


    try {
      // log(`posting: ${url}`) // TEST

      const response = await axios.post(apiUrl, null, {
        headers,
        // Don't add params - the URL already contains all required parameters including signature
      });

      // TODO these messages shoud not be implemented in this service
      const alertMessage = `✅ Order placed with ${exchangeName} for ${quantity} ${coinpair}: ${response.statusText}`;
      this.logService.log(alertMessage);
    } catch (err) {
      err.message = `❌ Failed to place order with ${exchangeName} for ${quantity} ${coinpair}: ${err}`;
      this.logService.logError(err);
    }
  }
}