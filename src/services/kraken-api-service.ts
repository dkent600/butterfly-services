import axios from 'axios';
import crypto from 'node:crypto';
import { injectable, inject } from 'tsyringe';
import { IAsset, IExchangeService, IExchangeApiService, IEnvService, TYPES } from '../types/interfaces.js';
import { BaseExchangeService } from './base-exchange-service.js';

@injectable()
export class KrakenApiService extends BaseExchangeService implements IExchangeService {
  private static instanceCount = 0;
  private static globalLastNonce = 0; // Shared nonce counter across all instances
  private static initialized = false; // Track if we've initialized the nonce
  private instanceId: number;

  constructor(
    @inject(TYPES.IExchangeApiService) private readonly exchangeApiService: IExchangeApiService,
    @inject(TYPES.IEnvService) envService: IEnvService,
  ) {
    super(envService);
    this.instanceId = ++KrakenApiService.instanceCount;
    
    // Initialize nonce on first instance to avoid conflicts with previous sessions
    if (!KrakenApiService.initialized) {
      // Start with current timestamp to avoid conflicts with previous sessions
      KrakenApiService.globalLastNonce = Date.now();
      KrakenApiService.initialized = true;
      console.log(`[KRAKEN SERVICE] Initialized global nonce to: ${KrakenApiService.globalLastNonce}`);
    }
    
    console.log(`[KRAKEN SERVICE] Created instance #${this.instanceId}, Total instances: ${KrakenApiService.instanceCount}`);
  }
  
  protected getTimeEndpoint(): string {
    return '/0/public/Time';
  }

  protected getApiBaseUrl(): string {
    return 'https://api.kraken.com';
  }

  protected extractServerTime(responseData: any): number {
    // Kraken returns time in seconds, convert to milliseconds to match other exchanges
    return responseData.result.unixtime * 1000;
  }

  private generateUniqueNonce(): number {
    // Kraken requires strictly increasing nonces in milliseconds
    // ATOMIC operation: always increment, never duplicate
    KrakenApiService.globalLastNonce = Math.max(Date.now(), KrakenApiService.globalLastNonce + 1);
    
    const generatedNonce = KrakenApiService.globalLastNonce;
    
    // Enhanced debug logging with timing analysis
    console.log(`[KRAKEN NONCE] Instance #${this.instanceId} Generated: ${generatedNonce} (time: ${Date.now()})`);
    
    return generatedNonce;
  }

  /**
   * Maps common asset names to Kraken's naming convention
   * Based on: https://support.kraken.com/hc/en-us/articles/360001185506-How-to-interpret-asset-codes
   * 
   * Only maps assets that have different names on Kraken.
   * Most assets (like SOL, ADA, DOGE, etc.) use their standard names and don't need mapping.
   */
  createPair(asset: IAsset, to: string = 'USDT'): string {
    const krakenAsset = this.mapAssetToKraken(asset.name);
    const krakenTo = this.mapAssetToKraken(to);
    return `${krakenAsset}${krakenTo}`;
  }

  /**
   * Maps an asset name to Kraken's naming convention
   */
  private mapAssetToKraken(assetName: string): string {
    switch (assetName.toUpperCase()) {
      case 'BTC':
        return 'XXBT';  // Bitcoin uses XXBT on Kraken
      case 'ETH':
        return 'XETH';  // Ethereum uses XETH on Kraken
      case 'USD':
        return 'ZUSD';  // USD uses ZUSD on Kraken
      case 'XLM':
        return 'XXLM';  // XLM uses XXLM on Kraken
      case 'XRP':
        return 'XXRP';  // XRP uses XXRP on Kraken
      default:
        return assetName.toUpperCase();  // Most assets use their standard names
    }
  }

  async fetchPrice(asset: IAsset): Promise<number> {
    const pair = this.createPair(asset);
    const url = this.getApiUrl('/0/public/Ticker');
    
    try {
      const { data } = await axios.get(url, {
        params: { pair },
      });

      // Try to find price data with the exact pair name first
      let priceData = data.result?.[pair];
      
      // If not found, try alternative formats (Kraken sometimes returns different key formats)
      if (!priceData) {
        // Look for any key in the result that matches our asset
        const resultKeys = Object.keys(data.result || {});
        for (const key of resultKeys) {
          if (key.includes(asset.name.toUpperCase()) || 
              key.includes(asset.name.replace('BTC', 'XBT').toUpperCase())) {
            priceData = data.result[key];
            break;
          }
        }
      }

      if (!priceData?.c?.[0]) {
        throw new Error(`No price data found for pair ${pair}`);
      }

      // Kraken returns price data in a nested structure
      return parseFloat(priceData.c[0]); // 'c' is the last trade closed array, [0] is price
    } catch (error) {
      // If it's already a specific error we threw, preserve it
      if (error instanceof Error && error.message.includes('No price data found')) {
        throw error;
      }
      
      console.error(`Failed to fetch price for ${asset.name}:`, error);
      throw new Error(`Could not fetch price for ${asset.name}`);
    }
  }

  async fetchBalance(asset: IAsset): Promise<number> {
    try {
      // Enhanced nonce generation for concurrent request safety
      const nonce = this.generateUniqueNonce(); // Use unique nonce method
      
      console.log(`[KRAKEN BALANCE] Instance #${this.instanceId} Using nonce: ${nonce} for ${asset.name}`);
      
      const path = '/0/private/Balance';
      const postData = `nonce=${nonce}`;

      const apiKey = this.exchangeApiService.getAPIKey(asset.exchange).trim();
      const apiSecret = this.exchangeApiService.getAPISecret(asset.exchange).trim();

      // Enhanced credential validation with environment info
      if (!apiKey || !apiSecret) {
        throw new Error(`Missing API credentials for ${asset.exchange}. API Key: ${!!apiKey}, API Secret: ${!!apiSecret}`);
      }

      // Log environment context (without exposing secrets)
      console.log(`[KRAKEN AUTH] Using credentials - Key: ${apiKey.substring(0, 6)}..., Secret: ${apiSecret.substring(0, 6)}..., Env: ${process.env.NODE_ENV || 'unknown'}`);
      
      const signature = this.signKrakenRequest(path, postData, apiSecret);
      const url = this.getApiUrl(path);

      const { data } = await axios.post(url, postData, {
        headers: {
          'API-Key': apiKey,
          'API-Sign': signature,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'butterfly-services/1.0',
        },
      });

      if (data.error && data.error.length > 0) {
        const errorMessage = data.error.join(', ');
        console.error(`[KRAKEN ERROR] Instance #${this.instanceId} API Error: ${errorMessage}`);
        console.error(`[KRAKEN ERROR] Request details - Nonce: ${nonce}, URL: ${url}, PostData: ${postData}`);
        console.error(`[KRAKEN ERROR] Headers: ${JSON.stringify({ 'API-Key': `${apiKey.substring(0, 10)}...`, 'API-Sign': `${signature.substring(0, 20)}...` })}`);
        throw new Error(`Kraken API error: ${errorMessage}`);
      }

      // Map asset name to Kraken format for balance lookup
      const krakenAssetName = this.createPair({ ...asset, name: asset.name }, '').replace(/USDT$|USD$/, '');
      let balance = 0;

      if (data.result?.[krakenAssetName]) {
        balance = parseFloat(data.result[krakenAssetName]);
      }

      return balance;
    } catch (error) {
      // If it's already a specific error we threw, preserve it
      if (error instanceof Error && (
        error.message.includes('Missing API credentials') || 
        error.message.includes('Kraken API error:')
      )) {
        throw error;
      }
      
      console.error(`Failed to fetch balance for ${asset.name}:`, error);
      console.error('Request details:', {
        url: this.getApiUrl('/0/private/Balance'),
        hasApiKey: !!this.exchangeApiService.getAPIKey(asset.exchange),
        hasApiSecret: !!this.exchangeApiService.getAPISecret(asset.exchange),
        errorResponse: (error as any).response?.data,
      });
      throw new Error(`Could not fetch balance for ${asset.name}`);
    }
  }

  async createMarketSellOrder(asset: IAsset, to: string = 'USDT'): Promise<any> {
    try {
      const pair = this.createPair(asset, to);
      const volume = asset.amount;  // Fixed - removed incorrect await
      const nonce = this.generateUniqueNonce(); // Use unique nonce method
      
      console.log(`[KRAKEN ORDER] Instance #${this.instanceId} Using nonce: ${nonce} for ${asset.name} pair: ${pair}`);
      
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

      const url = this.getApiUrl(path);

      const headers = {
        'API-Key': this.exchangeApiService.getAPIKey(asset.exchange),
        'API-Sign': signature,
        'Content-Type': 'application/x-www-form-urlencoded',
      };

      // Use the exchangeApiService to make the call
      const result = await this.exchangeApiService.createMarketSellOrder(
        pair,
        volume,
        asset.exchange,
        {
          url,
          method: 'POST',
          body: postData,
          headers,
        },
      );

      return result;
    } catch (error) {
      // If it's already a specific error we threw, preserve it
      if (error instanceof Error && error.message.includes('Kraken API error:')) {
        throw error;
      }
      
      // Check if it's an error from exchangeApiService that should be preserved
      if (error instanceof Error && error.message.includes('API Error')) {
        throw error;
      }
      
      console.error(`Failed to create sell order for ${asset.name}:`, error);
      throw new Error(`Could not create sell order for ${asset.name}`);
    }
  }

  /**
   * Creates Kraken-specific API signature
   * Based on Kraken's official algorithm: https://support.kraken.com/articles/360029054811
   * 
   * Algorithm:
   * 1. apiSha256 = crypto.createHash('sha256').update(`${nonce}${postData}`).digest();
   * 2. apiSha512 = crypto.createHmac('sha512', apiSecret).update(apiPath).update(apiSha256).digest();
   * 3. apiSignature = apiSha512.toString('base64');
   */
  private signKrakenRequest(path: string, postData: string, apiSecret: string): string {
    // Extract nonce from postData (assumes format: "nonce=123456...")
    const nonceMatch = postData.match(/nonce=(\d+)/);
    if (!nonceMatch) {
      // Fallback for test environments or edge cases - use simple increment
      const fallbackNonce = Math.max(Date.now(), KrakenApiService.globalLastNonce + 1);
      KrakenApiService.globalLastNonce = fallbackNonce;
      console.warn(`[KRAKEN] Nonce not found in postData "${postData}", using fallback: ${fallbackNonce}`);
      const apiSha256 = crypto.createHash('sha256').update(`${fallbackNonce}${postData}`).digest();
      const apiSha512 = crypto.createHmac('sha512', Buffer.from(apiSecret, 'base64'))
        .update(path)
        .update(apiSha256)
        .digest();
      return apiSha512.toString('base64');
    }
    const nonce = nonceMatch[1];
    
    // Follow Kraken's exact algorithm
    const apiSha256 = crypto.createHash('sha256').update(`${nonce}${postData}`).digest();
    const apiSha512 = crypto.createHmac('sha512', Buffer.from(apiSecret, 'base64'))
      .update(path)
      .update(apiSha256)
      .digest();
    const apiSignature = apiSha512.toString('base64');
    
    return apiSignature;
  }
}
