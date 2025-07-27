import axios from 'axios';
import { injectable, inject } from 'tsyringe';
import { IAsset, IExchangeService, IExchangeApiService, IEnvService, IOpenedOrderListItem, TYPES } from '../types/interfaces.js';
import { BaseExchangeService } from './base-exchange-service.js';

@injectable()
export class MexcApiService extends BaseExchangeService implements IExchangeService {
  private static globalNonceRef = { value: 0 }; // Wrapped in object for reference passing

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

  protected getExchangeName(): string {
    return 'mexc';
  }

  protected extractServerTime(responseData: any): number {
    return responseData.serverTime;
  }

  private async generateUniqueNonce(): Promise<number> {
    return this.generateAtomicNonce(
      MexcApiService.globalNonceRef,
      this.getExchangeName(),
    );
  }

  /**
   * Transforms MEXC order array to unified format
   * MEXC returns orders as an array: [orderDetails, ...]
   */
  private transformToApiSchema(mexcOrders: any[]): IOpenedOrderListItem[] {
    return mexcOrders.map((order) => ({
      orderId: order.orderId?.toString() || order.clientOrderId || '',
      pair: order.symbol || '',
      price: order.price || '', // MEXC always has price field
      amount: order.origQty || '',
      direction: (order.side || 'SELL').toLowerCase().replace('sell', 'sell').replace('buy', 'buy') as 'buy' | 'sell',
      type: (order.type || 'LIMIT').toLowerCase().replace('limit', 'limit').replace('market', 'market') as 'market' | 'limit',
    }));
  }

  async fetchPrice(asset: IAsset, to: string): Promise<number> {
    try {
      const url = this.getApiUrl('/api/v3/ticker/price');
      const { data } = await axios.get(url, {
        params: { symbol: this.createPair(asset, to) },
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
    // Enhanced nonce generation: Use atomic nonce generation for concurrent request safety
    const timestamp = await this.generateUniqueNonce();
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

  async createSellOrder(
    asset: IAsset, 
    options: {
      orderType: 'market' | 'limit';
      price?: number;
      to: string;
    },
  ): Promise<any> {
    const { orderType, price, to } = options;
    
    try {
      // Validate required parameters based on order type
      if (orderType === 'limit' && !price) {
        throw new Error('Price is required for limit orders');
      }
      
      const exchangeName = this.getExchangeName();
      const symbol = this.createPair(asset, to);
      const quantity = asset.amount;
      const timestamp = await this.generateUniqueNonce();
      
      console.log(`MODE: Using test mode: ${this.shouldUseTestMode()}, Environment: ${this.envService.get('app.environment')}`);
      
      // Build query parameters
      const orderParams: Record<string, string> = {
        symbol,
        side: 'SELL',
        type: orderType.toUpperCase(),
        quantity: quantity.toString(),
        timestamp: timestamp.toString(),
      };
      
      if (orderType === 'limit' && price) {
        orderParams.price = price.toString();
      }
      
      if (this.shouldUseTestMode()) {
        console.log(`[MEXC MODE] Running in test mode! ${asset.name} at ${price || 'market'}`);
      } else {
        console.log(`[MEXC MODE] ❗Running in production! ${asset.name} at ${price || 'market'}`);
      }
      
      const queryString = new URLSearchParams(orderParams).toString();
      const apiKey = this.exchangeApiService.getAPIKey(exchangeName);
      const apiSecret = this.exchangeApiService.getAPISecret(exchangeName);
      
      if (!apiKey || !apiSecret) {
        throw new Error(`${exchangeName} API credentials not configured`);
      }
      
      const signature = this.exchangeApiService.sign(queryString, apiSecret);
      
      // Use test mode based on environment configuration
      const endpoint = this.shouldUseTestMode() ? '/api/v3/order/test' : '/api/v3/order';
      const url = `${this.getApiUrl(endpoint)}?${queryString}&signature=${signature}`;
      
      const headers = {
        'X-MEXC-APIKEY': apiKey,
        'Content-Type': 'application/json',
      };
      
      // Use the existing architecture via ExchangeApiService
      await this.exchangeApiService.sendApiRequest(exchangeName, {
        url,
        method: 'POST',
        body: undefined,
        headers,
      });
      
      return { success: true, message: `${orderType === 'market' ? 'Market' : 'Limit'} sell order created successfully` };
      
    } catch (error) {
      // If it's already a specific error we threw, preserve it
      if (error instanceof Error && (
        error.message.includes('MEXC API error:') ||
        error.message.includes('Price is required for limit orders') ||
        error.message.includes('API Error')
      )) {
        throw error;
      }
      
      console.error(`Failed to create ${orderType} sell order for ${asset.name}:`, error);
      console.error('Order details:', {
        orderType,
        symbol: this.createPair(asset, to),
        quantity: asset.amount,
        price,
        hasApiKey: !!this.exchangeApiService.getAPIKey(this.getExchangeName()),
        hasApiSecret: !!this.exchangeApiService.getAPISecret(this.getExchangeName()),
        errorResponse: (error as any).response?.data,
      });
      throw new Error(`Could not create ${orderType} sell order for ${asset.name}`);
    }
  }

  /**
   * Retrieves open orders from MEXC
   * https://mexcdevelop.github.io/apidocs/spot_v3_en/#current-open-orders
   * @returns Promise with open orders data
   */
  async getOpenOrders(): Promise<any> {
    const exchangeName = this.getExchangeName();
    
    try {
      const timestamp = await this.generateUniqueNonce();
      const queryString = `timestamp=${timestamp}`;
      
      const apiKey = this.exchangeApiService.getAPIKey(exchangeName);
      const apiSecret = this.exchangeApiService.getAPISecret(exchangeName);
      
      if (!apiKey || !apiSecret) {
        throw new Error(`${exchangeName} API credentials not configured`);
      }

      // Log environment context (without exposing secrets)
      console.log(`[MEXC AUTH] Open Orders - Key: ${apiKey.substring(0, 6)}..., Secret: ${apiSecret.substring(0, 6)}..., Env: ${process.env.NODE_ENV || 'unknown'}`);
      
      const signature = this.exchangeApiService.sign(queryString, apiSecret);
      const url = `${this.getApiUrl('/api/v3/openOrders')}?${queryString}&signature=${signature}`;
      
      const headers = {
        'X-MEXC-APIKEY': apiKey,
        'Content-Type': 'application/json',
      };

      const { data } = await axios.get(url, { headers });
      
      // MEXC returns array directly or error object
      if (Array.isArray(data)) {
        const orderListSchema = this.transformToApiSchema(data);
        return {
          orders: orderListSchema,
          timestamp: new Date().toISOString(),
        };
      } else if (data.code && data.msg) {
        // MEXC error format
        console.error(`[MEXC ERROR] Open Orders API Error: ${data.msg} (Code: ${data.code})`);
        throw new Error(`MEXC API error: ${data.msg}`);
      } else {
        throw new Error(`${exchangeName} API returned unexpected response format`);
      }
    } catch (error: any) {
      console.error('[MEXC ERROR] Get open orders failed:', error);
      
      // Check for MEXC API error format
      if (error.response?.data?.code && error.response?.data?.msg) {
        const mexcError = error.response.data.msg;
        console.error(`${exchangeName} get open orders error: ${mexcError} (Code: ${error.response.data.code})`);
        throw new Error(`${exchangeName} API error: ${mexcError}`);
      } else {
        console.error(`Failed to get ${exchangeName} open orders: ${error.message}`);
        throw new Error(`Failed to get ${exchangeName} open orders: ${error.message}`);
      }
    }
  }

  /**
   * Retrieves all orders (including closed ones) from MEXC
   * https://mexcdevelop.github.io/apidocs/spot_v3_en/#all-orders
   * @param symbol - Optional trading symbol to filter orders
   * @returns Promise with all orders data
   */
  async getClosedOrders(symbol?: string): Promise<any> {
    const exchangeName = this.getExchangeName();
    
    try {
      const timestamp = await this.generateUniqueNonce();
      
      // Build query parameters
      const queryParams: Record<string, string> = {
        timestamp: timestamp.toString(),
      };
      
      // Add symbol if provided (required by some MEXC endpoints)
      if (symbol) {
        queryParams.symbol = symbol;
      }
      
      const queryString = new URLSearchParams(queryParams).toString();
      
      const apiKey = this.exchangeApiService.getAPIKey(exchangeName);
      const apiSecret = this.exchangeApiService.getAPISecret(exchangeName);
      
      if (!apiKey || !apiSecret) {
        throw new Error(`${exchangeName} API credentials not configured`);
      }

      // Log environment context (without exposing secrets)
      console.log(`[MEXC AUTH] Closed Orders - Key: ${apiKey.substring(0, 6)}..., Secret: ${apiSecret.substring(0, 6)}..., Env: ${process.env.NODE_ENV || 'unknown'}`);
      
      const signature = this.exchangeApiService.sign(queryString, apiSecret);
      const url = `${this.getApiUrl('/api/v3/allOrders')}?${queryString}&signature=${signature}`;
      
      const headers = {
        'X-MEXC-APIKEY': apiKey,
        'Content-Type': 'application/json',
      };

      const { data } = await axios.get(url, { headers });
      
      // MEXC returns array directly or error object
      if (Array.isArray(data)) {
        // Filter for closed orders (status: FILLED, CANCELED, REJECTED, EXPIRED)
        const closedOrders = data.filter(order => 
          ['FILLED', 'CANCELED', 'REJECTED', 'EXPIRED'].includes(order.status),
        );
        
        return {
          orders: closedOrders,
          timestamp: new Date().toISOString(),
        };
      } else if (data.code && data.msg) {
        // MEXC error format
        console.error(`[MEXC ERROR] Closed Orders API Error: ${data.msg} (Code: ${data.code})`);
        throw new Error(`MEXC API error: ${data.msg}`);
      } else {
        throw new Error(`${exchangeName} API returned unexpected response format`);
      }
    } catch (error: any) {
      console.error('[MEXC ERROR] Get closed orders failed:', error);
      
      // Check for MEXC API error format
      if (error.response?.data?.code && error.response?.data?.msg) {
        const mexcError = error.response.data.msg;
        console.error(`${exchangeName} get closed orders error: ${mexcError} (Code: ${error.response.data.code})`);
        throw new Error(`${exchangeName} API error: ${mexcError}`);
      } else {
        console.error(`Failed to get ${exchangeName} closed orders: ${error.message}`);
        throw new Error(`Failed to get ${exchangeName} closed orders: ${error.message}`);
      }
    }
  }

  /**
   * Cancels an order on MEXC
   * https://mexcdevelop.github.io/apidocs/spot_v3_en/#cancel-order
   * @param txid - The order ID to cancel
   * @returns Promise with cancellation result
   */
  async cancelOrder(txid: string): Promise<void> {
    try {
      // Validate order ID first, even in test mode
      if (!txid || txid.trim() === '') {
        throw new Error('Order ID is required to cancel an order');
      }

      const exchangeName = this.getExchangeName();
      
      // CRITICAL SAFETY CHECK: Block cancel orders in test mode
      // Production cancellations could result in financial loss during testing
      if (this.shouldUseTestMode()) {
        console.log(`[MEXC MODE] 🚫 BLOCKED: Cancel order in test mode! Order cancel: (${txid})`);
        console.log('[MEXC MODE] 🛡️  SAFETY: Preventing real cancellation during testing');
        
        // In test mode, still return successfully (no exception) but don't make API call
        return;
      }
      
      console.log(`[MEXC MODE] ❗Running in production! Order cancel: (${txid})`);
      
      // Check API credentials
      const apiKey = this.exchangeApiService.getAPIKey(exchangeName);
      const apiSecret = this.exchangeApiService.getAPISecret(exchangeName);

      if (!apiKey || !apiSecret) {
        throw new Error(`${exchangeName} API credentials not configured`);
      }

      // MEXC requires symbol parameter for cancel order
      // Since we don't have the symbol, we'll need to fetch it from open orders first
      // This is a limitation that could be improved by storing symbol with order ID
      // or by implementing a different cancellation strategy
      
      // For now, throw an informative error about the implementation limitation
      throw new Error('MEXC cancel order requires symbol parameter. Implementation needs order symbol lookup or modified order storage to include symbol.');

      // TODO: Implement symbol lookup from open orders or modify order creation to store symbol
      // The complete implementation would look like this:
      /*
      const timestamp = await this.generateUniqueNonce();
      const symbol = await this.getOrderSymbol(txid); // Need to implement this method
      const queryString = `symbol=${symbol}&orderId=${txid}&timestamp=${timestamp}`;
      const signature = this.exchangeApiService.sign(queryString, apiSecret);
      
      const url = `${this.getApiUrl('/api/v3/order')}?${queryString}&signature=${signature}`;
      
      const headers = {
        'X-MEXC-APIKEY': apiKey,
        'Content-Type': 'application/json',
      };

      await this.exchangeApiService.sendApiRequest(exchangeName, {
        url,
        method: 'DELETE',
        body: undefined,
        headers,
      });

      // Return void on success - no content needed for DELETE operations
      */

    } catch (error) {
      // If it's already a specific error we threw, preserve it
      if (error instanceof Error && (
        error.message.includes('Order ID is required') ||
        error.message.includes('API credentials not configured') ||
        error.message.includes('requires symbol parameter')
      )) {
        throw error;
      }

      console.error(`Failed to cancel order orderId: ${txid}:`, error);
      console.error('Order details:', {
        orderId: txid,
        hasApiKey: !!this.exchangeApiService.getAPIKey(this.getExchangeName()),
        hasApiSecret: !!this.exchangeApiService.getAPISecret(this.getExchangeName()),
        errorResponse: (error as any).response?.data,
      });
      throw new Error(`Could not cancel order for orderId: ${txid}`);
    }
  }
}
