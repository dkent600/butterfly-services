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
    const apiKey = this.envService.get(`api.${exchange.toLowerCase()}.apiKey`);
    if (!apiKey) {
      throw new Error(`API key not found for exchange: ${exchange}`);
    }
    return apiKey;
  }

  getAPISecret(exchange: string): string {
    // Fixed: was returning apiKey instead of apiSecret
    const apiSecret = this.envService.get(`api.${exchange.toLowerCase()}.apiSecret`);
    if (!apiSecret) {
      throw new Error(`API secret not found for exchange: ${exchange}`);
    }
    return apiSecret;
  }

  sign(queryString: string, apiSecret: string): string {
    return createHmac('sha256', apiSecret).update(queryString).digest('hex');
  }

  /**
   * Send exchange API requests using flexible request options.
   * @param exchangeName The exchange to use for the order
   * @param requestOptions Request configuration (URL, method, body, headers)
   */
  async sendApiRequest(
    exchangeName: string,
    requestOptions: {
      url: string;
      method: 'POST' | 'GET';
      body?: string;
      headers: Record<string, string>;
    },
  ): Promise<void> {
    try {
      // Debug logging for URL and body
      console.log(`[${exchangeName.toUpperCase()} EXCHANGE API] URL: ${requestOptions.url}`);
      console.log(`[${exchangeName.toUpperCase()} EXCHANGE API] Method: ${requestOptions.method}`);
      console.log(`[${exchangeName.toUpperCase()} EXCHANGE API] Body: ${requestOptions.body || 'null'}`);
      console.log(`[${exchangeName.toUpperCase()} EXCHANGE API] Headers: ${JSON.stringify(requestOptions.headers, null, 2)}`);

      let response;
      
      if (requestOptions.method === 'POST') {
        response = await axios.post(requestOptions.url, requestOptions.body || null, {
          headers: requestOptions.headers,
        });
      } else {
        response = await axios.get(requestOptions.url, {
          headers: requestOptions.headers,
        });
      }

      this.logService.log(`✅ Exchange API Request successful: ${exchangeName} - ${response.statusText}`);
    } catch (error) {
      const errorMessage = `❌ Exchange API Request Failed: ${exchangeName} - ${error}`;
      this.logService.logError(errorMessage);
      throw error;
    }
  }
}
