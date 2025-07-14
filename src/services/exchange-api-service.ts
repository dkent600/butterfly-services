import axios from 'axios';
import { createHmac } from 'node:crypto';
import { injectable, inject } from 'tsyringe';
import { ILogService, IEnvService, IExchangeApiService, TYPES } from '../types/interfaces.js';

@injectable()
export class ExchangeApiService implements IExchangeApiService {

  constructor(
    @inject(TYPES.ILogService) private readonly logService: ILogService,
    @inject(TYPES.IEnvService) private readonly envService: IEnvService,
  ) { }

  getAPIKey(exchange: string): string {
    const apiKey = this.envService.get(`api.${exchange}.apiKey`);
    if (!apiKey) {
      throw new Error(`API key not found for exchange: ${exchange}`);
    }
    return apiKey;
  }

  getAPISecret(exchange: string): string {
    // Fixed: was returning apiKey instead of apiSecret
    const apiSecret = this.envService.get(`api.${exchange}.apiSecret`);
    if (!apiSecret) {
      throw new Error(`API secret not found for exchange: ${exchange}`);
    }
    return apiSecret;
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
    headers: Record<string, string>,
  ): Promise<void> {
    try {
      const response = await axios.post(apiUrl, null, {
        headers,
        // Don't add params - the URL already contains all required parameters including signature
      });

      // TODO these messages should not be implemented in this service
      const alertMessage = `✅ Order placed with ${exchangeName} for ${quantity} ${coinpair}: ${response.statusText}`;
      this.logService.log(alertMessage);
    } catch (err) {
      const errorMessage = `❌ Failed to place order with ${exchangeName} for ${quantity} ${coinpair}: ${err}`;
      const error = new Error(errorMessage);
      this.logService.logError(error);
      throw error;
    }
  }
}
