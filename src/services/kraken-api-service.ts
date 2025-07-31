import axios from 'axios';
import crypto from 'node:crypto';
import { injectable, inject } from 'tsyringe';
import { IAsset, IExchangeService, IExchangeApiService, IEnvService, IOpenedOrderListItem, TYPES } from '../types/interfaces.js';
import { BaseExchangeService } from './base-exchange-service.js';

@injectable()
export class KrakenApiService extends BaseExchangeService implements IExchangeService {
  private static instanceCount = 0;
  private static globalNonceRef = { value: 0 }; // Wrapped in object for reference passing
  private static assetPairsCache: any = null; // Cache for AssetPairs data
  private static assetPairsCacheTime = 0; // Cache timestamp
  private static readonly CACHE_TTL = 60 * 60 * 1000; // 1 hour cache TTL
  private static pairMappingCache = new Map<string, string>(); // Maps Kraken pairs to standard pairs
  private instanceId: number;

  constructor(
    @inject(TYPES.IExchangeApiService) private readonly exchangeApiService: IExchangeApiService,
    @inject(TYPES.IEnvService) envService: IEnvService,
  ) {
    super(envService);
    
    this.instanceId = ++KrakenApiService.instanceCount;
    
    // NO BUFFER NEEDED - Time syncer provides accurate server time
    // Initialize with current time, let time syncer handle accuracy
    if (KrakenApiService.globalNonceRef.value === 0) {
      KrakenApiService.globalNonceRef.value = Date.now();
      console.log(`[KRAKEN SERVICE] Initialized global nonce to current time: ${KrakenApiService.globalNonceRef.value}`);
      console.log('[KRAKEN SERVICE] Using time syncer for accurate server-synchronized nonces');
    }
    
    // Initialize AssetPairs cache in the background
    if (!KrakenApiService.assetPairsCache) {
      KrakenApiService.loadAssetPairs().catch(error => {
        console.error('[KRAKEN SERVICE] Failed to initialize AssetPairs cache:', error);
      });
    }
    
    console.log(`[KRAKEN SERVICE] Created instance #${this.instanceId}, Total instances: ${KrakenApiService.instanceCount}`);
  }
  
  protected getTimeEndpoint(): string {
    return '/0/public/Time';
  }

  protected getApiBaseUrl(): string {
    return 'https://api.kraken.com';
  }

  protected getExchangeName(): string {
    return 'kraken';
  }

  protected extractServerTime(responseData: any): number {
    // Kraken returns time in seconds, convert to milliseconds for time syncer
    return responseData.result.unixtime * 1000;
  }

  private async generateUniqueNonce(): Promise<number> {
    return this.generateAtomicNonce(
      KrakenApiService.globalNonceRef,
      this.getExchangeName(),
      this.instanceId,
    );
  }

  /**
   * Test method to expose nonce generation for testing purposes
   * This allows us to test nonce generation without making API calls
   */
  public async testGenerateNonce(): Promise<number> {
    return this.generateUniqueNonce();
  }

  /**
   * Transforms Kraken opened order object to standard format
   * Kraken returns orders as: { [orderId]: orderDetails }
   * Note: OpenOrders endpoint returns pairs in standard format (e.g., "XLMUSD", "SOLUSD") - no conversion needed
   */
  private transformOpenedOrdersToApiSchema(krakenOrders: Record<string, any>): IOpenedOrderListItem[] {
    return Object.entries(krakenOrders).map(([orderId, order]) => ({
      orderId,
      pair:  order.descr?.pair || '', // is standard coin naming convention
      price: order.descr?.price || '', // Limit price for limit orders, empty for market
      amount: order.vol || '',
      direction: (order.descr?.type || 'sell').toLowerCase() as 'buy' | 'sell',
      type: (order.descr?.ordertype || 'market').toLowerCase() as 'market' | 'limit',
    }));
  }

  /**
   * Maps Kraken's internal asset names back to standard format
   * This is the reverse of mapAssetToKraken()
   */
  private mapKrakenAssetToStandard(krakenAssetName: string): string {
    switch (krakenAssetName.toUpperCase()) {
      case 'XXBT':
        return 'BTC';  // Bitcoin
      case 'XETH':
        return 'ETH';  // Ethereum
      case 'ZUSD':
        return 'USD';  // US Dollar
      case 'ZCAD':
        return 'CAD';  // Canadian Dollar
      case 'ZEUR':
        return 'EUR';  // Euro
      case 'XXLM':
        return 'XLM';  // Stellar
      case 'XXRP':
        return 'XRP';  // Ripple
      case 'XXDG':
        return 'DOGE'; // Dogecoin
      default:
        return krakenAssetName;  // Most assets use their standard names
    }
  }

  /**
   * Converts a Kraken internal pair format back to standard format
   * e.g., "XXBTZUSD" -> "BTCUSD", "XETHZUSD" -> "ETHUSD"
   * 
   * Uses a cache-first strategy for O(1) performance on repeated conversions.
   * Cache is populated dynamically from multiple fallback methods.
   */
  private convertKrakenPairToStandard(krakenPair: string): string {
    if (!krakenPair) return krakenPair;
    
    // FIRST: Check our dynamic mapping cache for O(1) reverse conversion
    const standardPair = KrakenApiService.pairMappingCache.get(krakenPair);
    if (!standardPair) {
      throw new Error(`No cached mapping found for Kraken pair: ${krakenPair}`);
      // // Cache miss - compute and cache the result using fallback methods
      // standardPair = this.computeStandardPair(krakenPair);
      
      // // Cache the computed result for future O(1) lookups
      // KrakenApiService.pairMappingCache.set(krakenPair, standardPair);
      // // for reverse lookups
      // KrakenApiService.pairMappingCache.set(standardPair, krakenPair);
    }
    return standardPair;
  }

  //   private convertStandardPairToKraken(standardPair: string): string {
  //   if (!standardPair) return standardPair;
    
  //   const krakenPair = KrakenApiService.pairMappingCache.get(standardPair);
  //   if (!krakenPair) {
  //     throw new Error(`No cached mapping found for standard pair: ${standardPair}`);
  //   }
  //   return krakenPair;
  // }

  /**
   * Computes the standard pair format from Kraken pair using multiple fallback strategies
   * This method is only called on cache misses to populate the cache
   */
  // private computeStandardPair(krakenPair: string): string {
  //   // STRATEGY 1: Check known conversions for common pairs
  //   const knownConversions: { [key: string]: string } = {
  //     'XXBTZUSD': 'BTCUSD',
  //     'XETHZUSD': 'ETHUSD', 
  //     'ADAZUSD': 'ADAUSD',
  //     'ADAUSDT': 'ADAUSDT',
  //     'XXRPZUSD': 'XRPUSD',
  //     'XXLMZUSD': 'XLMUSD',
  //     'XXDGZUSD': 'DOGEUSD',
  //     'XBTUSD': 'BTCUSD',
  //     'ETHUSD': 'ETHUSD',
  //   };
    
  //   if (knownConversions[krakenPair]) {
  //     return knownConversions[krakenPair];
  //   }
    
  //   // STRATEGY 2: Try to find the pair in our cached AssetPairs to get base and quote
  //   if (KrakenApiService.assetPairsCache) {
  //     for (const [pairKey, pairInfo] of Object.entries(KrakenApiService.assetPairsCache)) {
  //       const pair = pairInfo as any;
  //       if (pairKey === krakenPair || pair.altname === krakenPair) {
  //         // Found the pair, convert base and quote to standard format
  //         const standardBase = this.mapKrakenAssetToStandard(pair.base);
  //         const standardQuote = this.mapKrakenAssetToStandard(pair.quote);
  //         return `${standardBase}${standardQuote}`;
  //       }
  //     }
  //   }
    
  //   // STRATEGY 3: Fallback to manual parsing for common patterns
  //   if (krakenPair.length >= 6) {
  //     // Try different base/quote splits
  //     const commonBaseLengths = [3, 4, 5]; // Most common base asset lengths
      
  //     for (const baseLength of commonBaseLengths) {
  //       const potentialBase = krakenPair.substring(0, baseLength);
  //       const potentialQuote = krakenPair.substring(baseLength);
        
  //       const standardBase = this.mapKrakenAssetToStandard(potentialBase);
  //       const standardQuote = this.mapKrakenAssetToStandard(potentialQuote);
        
  //       // If we got different values back, it means we found a mapping
  //       if (standardBase !== potentialBase || standardQuote !== potentialQuote) {
  //         return `${standardBase}${standardQuote}`;
  //       }
  //     }
  //   }
    
  //   // STRATEGY 4: If all else fails, return the original pair unchanged
  //   return krakenPair;
  // }

  /**
   * Maps common asset names to Kraken's naming convention
   * Based on: https://support.kraken.com/hc/en-us/articles/360001185506-How-to-interpret-asset-codes
   * 
   * Only maps assets that have different names on Kraken.
   * Most assets (like SOL, ADA, DOGE, etc.) use their standard names and don't need mapping.
   */

  /**
   * Maps an asset name to Kraken's naming convention for trading pairs
   */
  private mapAssetToKraken(assetName: string): string {
    switch (assetName.toUpperCase()) {
      case 'BTC':
        return 'XXBT';  // Bitcoin uses XXBT on Kraken
      case 'ETH':
        return 'XETH';  // Ethereum uses XETH on Kraken
      case 'USD':
        return 'ZUSD';  // Default to ZUSD for legacy assets
      case 'CAD':
        return 'ZCAD';  // Default to ZCAD for legacy assets
      case 'EUR':
        return 'ZEUR';  // Default to ZEUR for legacy assets
      case 'XLM':
        return 'XXLM';  // XLM uses XXLM on Kraken
      case 'XRP':
        return 'XXRP';  // XRP uses XXRP on Kraken
      case 'DOGE':
        return 'XXDG';  // DOGE uses XXDG on Kraken
      default:
        return assetName.toUpperCase();  // Most assets use their standard names
    }
  }

  /**
   * Loads and caches AssetPairs data from Kraken API
   */
  private static async loadAssetPairs(): Promise<any> {
    const now = Date.now();
    
    // Return cached data if it's still fresh
    if (this.assetPairsCache && (now - this.assetPairsCacheTime) < this.CACHE_TTL) {
      return this.assetPairsCache;
    }
    
    try {
      const response = await axios.get('https://api.kraken.com/0/public/AssetPairs');
      this.assetPairsCache = response.data?.result || {};
      this.assetPairsCacheTime = now;
      console.log(`[KRAKEN] Loaded ${Object.keys(this.assetPairsCache).length} asset pairs from API`);
      return this.assetPairsCache;
    } catch (error) {
      console.error('[KRAKEN] Failed to load AssetPairs from API:', error);
      // Return empty cache if API fails
      return this.assetPairsCache || {};
    }
  }

  /**
   * Finds the correct trading pair using AssetPairs data
   */
  private static findTradingPair(krakenAsset: string, krakenTo: string): string | null {
    for (const [pairKey, pairInfo] of Object.entries(KrakenApiService.assetPairsCache)) {
      const pair = pairInfo as any;
      if (pair.base === krakenAsset && pair.quote === krakenTo) {
        // Return the altname if available, otherwise the key
        return pair.altname || pairKey;
      }
    }
    return null;
  }

  /**
   * Creates trading pairs by looking up the correct pair from cached AssetPairs data
   */
  createPair(asset: IAsset, to: string): string {
    const krakenAsset = this.mapAssetToKraken(asset.name);
    const krakenTo = this.mapAssetToKraken(to);
    
    // Check if cache is loaded, if not throw error to indicate async loading needed
    if (!KrakenApiService.assetPairsCache) {
      throw new Error('AssetPairs cache is not loaded. Call loadAssetPairs() first.');
    }

    // Kraken has not only their own coin naming convention,
    // but their own pair naming convention.
    // Try to find pair in cached data
    const foundPair = KrakenApiService.findTradingPair(krakenAsset, krakenTo);
    if (foundPair) {
      return foundPair;
    } else {
      throw new Error(`No trading pair found for ${asset.name} to ${to}`);
    }
  }

  async fetchPrice(asset: IAsset, to: string): Promise<number> {
    // Ensure AssetPairs cache is loaded before creating pair
    await KrakenApiService.loadAssetPairs();
    
    const pair = this.createPair(asset, to);
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
      const nonce = await this.generateUniqueNonce(); // Use unique nonce method
      
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
        
        // Special handling for nonce-related errors
        if (errorMessage.toLowerCase().includes('nonce')) {
          console.error('[KRAKEN NONCE ERROR] Detailed analysis:');
          console.error(`  - Generated nonce: ${nonce}`);
          console.error(`  - Current global nonce: ${KrakenApiService.globalNonceRef.value}`);
          console.error(`  - Current time: ${Date.now()}`);
          console.error(`  - Time syncer available: ${await this.getTimeSyncer() ? 'YES' : 'NO'}`);
          console.error(`  - Nonce as string: "${nonce}"`);
          console.error(`  - Nonce length: ${nonce.toString().length}`);
          console.error(`  - Server time vs nonce: ${nonce >= Date.now() ? 'FUTURE' : 'PAST'}`);
          
          // Check if this might be a replay attack detection
          if (errorMessage.toLowerCase().includes('used') || errorMessage.toLowerCase().includes('duplicate')) {
            console.error('  - Possible nonce replay detected. Consider increasing nonce base value.');
          }
        }
        
        throw new Error(`Kraken API error: ${errorMessage}`);
      }

      // Map asset name to Kraken format for balance lookup
      const krakenAssetName = this.mapAssetToKraken(asset.name);

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
      const fallbackNonce = Math.max(Date.now(), KrakenApiService.globalNonceRef.value + 1);
      KrakenApiService.globalNonceRef.value = fallbackNonce;
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
    const pair = this.createPair(asset, to);
    const volume = asset.amount;
    const nonce = await this.generateUniqueNonce();
    
    // console.log(`[KRAKEN ORDER] Instance #${this.instanceId} Using nonce: ${nonce} for ${asset.name} pair: ${pair}, type: ${orderType}`);

    const orderParams: Record<string, string> = {
      nonce: nonce.toString(),
      ordertype: orderType,
      type: 'sell',
      volume: volume.toString(),
      pair,
      ...(this.shouldUseTestMode() && { validate: 'true' }), // Add validate=true for test mode
    };
    
    if (orderType === 'limit' && price) {
      orderParams.price = price.toString();
      }

    if (orderParams?.validate !== 'true') {
      console.log(`[KRAKEN MODE]❗Running in production! ${asset.name} at ${price}`);
    } else {
      console.log(`[KRAKEN MODE] Running in test mode! ${asset.name} at ${price}`);
    }

    const postData = new URLSearchParams(orderParams).toString();
    const path = '/0/private/AddOrder';
    const apiSecret = this.exchangeApiService.getAPISecret(exchangeName);
    const apiKey = this.exchangeApiService.getAPIKey(exchangeName).trim();

    if (!apiKey || !apiSecret) {
      throw new Error(`${exchangeName} API credentials not configured`);
    }

    const signature = this.signKrakenRequest(path, postData, apiSecret);
    const url = this.getApiUrl(path);

    const headers = {
      'API-Key': apiKey,
      'API-Sign': signature,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'butterfly-services/1.0',
    };

    // Use the existing architecture via ExchangeApiService
    await this.exchangeApiService.sendApiRequest(exchangeName, {
      url,
      method: 'POST',
      body: postData,
      headers,
    });

    return { success: true, message: '${orderType === "market" ? "Market" : "Limit"} sell order created successfully' };
  } 
  catch (error) {
    // If it's already a specific error we threw, preserve it
    if (error instanceof Error && error.message.includes('Kraken API error:')) {
      throw error;
    }

    console.error(`Failed to create ${orderType} sell order for ${asset.name}:`, error);
    console.error('Order details:', {
      orderType,
      pair: this.createPair(asset, to),
      volume: asset.amount,
      price,
      // hasApiKey: !!this.exchangeApiService.getAPIKey(exchangeName),
      // hasApiSecret: !!this.exchangeApiService.getAPISecret(exchangeName),
      // errorResponse: (error as any).response?.data,
    });
    throw new Error(`Could not create ${orderType} sell order for ${asset.name}`);
  }
}

  /**
   * Retrieves open orders from Kraken
   * https://docs.kraken.com/api/docs/rest-api/list-open-orders
   * Note: trades=false returns just order info, simpler and faster response
   */
  async getOpenedOrders(): Promise<any> {
    const exchangeName = this.getExchangeName();
    
    try {
      const nonce = await this.generateUniqueNonce();
      const postData = `nonce=${nonce}&trades=true`;
      const path = '/0/private/OpenOrders';
      
      const apiKey = this.exchangeApiService.getAPIKey(exchangeName).trim();
      const apiSecret = this.exchangeApiService.getAPISecret(exchangeName).trim();
      
      if (!apiKey || !apiSecret) {
        throw new Error(`${exchangeName} API credentials not configured`);
      }

      // Log environment context (without exposing secrets)
      console.log(`[KRAKEN AUTH] Open Orders - Key: ${apiKey.substring(0, 6)}..., Secret: ${apiSecret.substring(0, 6)}..., Env: ${process.env.NODE_ENV || 'unknown'}`);
      
      const signature = this.signKrakenRequest(path, postData, apiSecret);
      const url = this.getApiUrl(path);
      
      console.log(`[KRAKEN DEBUG] Open Orders Request - URL: ${url}, PostData: ${postData}`);
      console.log(`[KRAKEN DEBUG] Open Orders Headers: ${JSON.stringify({ 'API-Key': `${apiKey.substring(0, 10)}...`, 'API-Sign': `${signature.substring(0, 20)}...` })}`);
      
      const headers = {
        'API-Key': apiKey,
        'API-Sign': signature,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'butterfly-services/1.0',
      };

      const { data } = await axios.post(url, postData, { headers });
      
      if (data.error && data.error.length > 0) {
        const errorMessage = data.error.join(', ');
        console.error(`[KRAKEN ERROR] Open Orders API Error: ${errorMessage}`);
        throw new Error(`Kraken API error: ${errorMessage}`);
      }
      
      const response = data;
      
      if (response.result) {
        // Extract the open orders object and transform to unified format
        const krakenOrders = response.result.open || {};
        const orderList = this.transformOpenedOrdersToApiSchema(krakenOrders);
        
        return orderList;
      } else {
        throw new Error(`${exchangeName} API returned empty result`);
      }
    } catch (error: any) {
      console.error('[KRAKEN ERROR] Get open orders failed:', error);
      
      // Check for Kraken API error format
      if (error.response?.data?.error?.length > 0) {
        const krakenError = error.response.data.error[0];
        console.error(`${exchangeName} get open orders error: ${krakenError}`);
        throw new Error(`${exchangeName} API error: ${krakenError}`);
      } else {
        console.error(`Failed to get ${exchangeName} open orders: ${error.message}`);
        throw new Error(`Failed to get ${exchangeName} open orders: ${error.message}`);
      }
    }
  }

  /**
   * Generates trading pairs from base and quote coin filters for Kraken
   * Uses paired arrays where baseCoins[i] pairs with quoteCoins[i]
   * Converts from input standard naming format to Kraken's internal naming format.
   * Caches the pair mapping cache for efficient reverse conversion kraken => standard pair naming
   * @param filters Optional filters containing base and quote coins arrays
   * @returns Array of trading pair strings (Kraken format)
   */
  private generateClosedOrderPairs(filters?: { baseCoins?: string[]; quoteCoins?: string[] }): string[] {
    if (!filters || (!filters.baseCoins?.length && !filters.quoteCoins?.length)) {
      // Return empty array to indicate no filtering (fetch all pairs)
      return [];
    }
    
    const baseCoins = filters.baseCoins || [];
    const quoteCoins = filters.quoteCoins || [];
    
    // Validate that arrays have the same length if both are provided
    if (baseCoins.length > 0 && quoteCoins.length > 0 && baseCoins.length !== quoteCoins.length) {
      throw new Error(`baseCoins and quoteCoins arrays must have the same length. Got baseCoins: ${baseCoins.length}, quoteCoins: ${quoteCoins.length}`);
    }
    
    // If only one array is provided, return empty (no filtering)
    if (baseCoins.length === 0 || quoteCoins.length === 0) {
      return [];
    }
    
    // Generate pairs from corresponding array positions (paired arrays)
    const pairs: string[] = [];
    for (let i = 0; i < baseCoins.length; i++) {
      const base = baseCoins[i];
      const quote = quoteCoins[i];
      
      // Create standard pair for mapping cache
      const standardPair = `${base.toUpperCase()}${quote.toUpperCase()}`;
      
      // Map to Kraken naming convention
      const krakenBase = this.mapAssetToKraken(base);
      const krakenQuote = this.mapAssetToKraken(quote);
      const krakenPair = `${krakenBase}${krakenQuote}`;
      
      // Populate the mapping cache for efficient reverse conversion
      KrakenApiService.pairMappingCache.set(krakenPair, standardPair);
      
      pairs.push(krakenPair);
    }
    
    return pairs;
  }

  /**
   * Clears the pair mapping cache
   * Useful for testing or when asset mappings change
   */
  public static clearPairMappingCache(): void {
    KrakenApiService.pairMappingCache.clear();
    console.log('[KRAKEN] Cleared pair mapping cache');
  }

  /**
   * Gets the current pair mapping cache for debugging
   */
  public static getPairMappingCache(): Map<string, string> {
    return KrakenApiService.pairMappingCache;
  }

  /**
   * Retrieves closed orders from Kraken
   * https://docs.kraken.com/api/docs/rest-api/get-orders-history
   * Note: trades=false returns just order info, trades=true includes detailed execution data
   * @param filters Optional filters with base and quote coin arrays.  Standard naming format.
   */
  async getClosedOrders(filters?: { baseCoins?: string[]; quoteCoins?: string[] }): Promise<any> {
    const exchangeName = this.getExchangeName();

    try {
      const nonce = await this.generateUniqueNonce();
      const postData = `nonce=${nonce}&trades=false`;
      
      const path = '/0/private/ClosedOrders';
      
      const apiKey = this.exchangeApiService.getAPIKey(exchangeName).trim();
      const apiSecret = this.exchangeApiService.getAPISecret(exchangeName).trim();
      
      if (!apiKey || !apiSecret) {
        throw new Error(`${exchangeName} API credentials not configured`);
      }

      // Generate pairs from filters
      const targetPairs = this.generateClosedOrderPairs(filters);
      
      console.log(`[KRAKEN] Fetching closed orders${targetPairs.length > 0 ? ` filtered for pairs: ${targetPairs.join(', ')}` : ' (all pairs)'}`);

      // Log environment context (without exposing secrets)
      console.log(`[KRAKEN AUTH] Closed Orders - Key: ${apiKey.substring(0, 6)}..., Secret: ${apiSecret.substring(0, 6)}..., Env: ${process.env.NODE_ENV || 'unknown'}`);
      
      const signature = this.signKrakenRequest(path, postData, apiSecret);
      const url = this.getApiUrl(path);
      
      console.log(`[KRAKEN DEBUG] Closed Orders Request - URL: ${url}, PostData: ${postData}`);
      console.log(`[KRAKEN DEBUG] Closed Orders Headers: ${JSON.stringify({ 'API-Key': `${apiKey.substring(0, 10)}...`, 'API-Sign': `${signature.substring(0, 20)}...` })}`);
      
      const headers = {
        'API-Key': apiKey,
        'API-Sign': signature,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'butterfly-services/1.0',
      };

      const { data } = await axios.post(url, postData, { headers });
      
      if (data.error && data.error.length > 0) {
        const errorMessage = data.error.join(', ');
        console.error(`[KRAKEN ERROR] Closed Orders API Error: ${errorMessage}`);
        throw new Error(`Kraken API error: ${errorMessage}`);
      }
      
      const response = data;
      
      if (response.result) {
        // Extract the closed orders object
        const closedOrders = response.result.closed || {};
        
        // Convert object to array and filter by pairs if specified
        let filteredOrders = Object.entries(closedOrders).map(([orderId, orderData]: [string, any]) => ({
          orderId,
          ...orderData,
        }));
        
        // Filter by pairs if specified
        if (targetPairs.length > 0) {
          const pairsSet = new Set(targetPairs);
          filteredOrders = filteredOrders.filter(order => {
            // Check if the order's descr.pair matches any of the requested pairs
            const orderPair = order.descr?.pair;
            return orderPair && pairsSet.has(orderPair);
          });
          
          console.log(`[KRAKEN] Filtered ${Object.keys(closedOrders).length} total orders to ${filteredOrders.length} orders for requested pairs`);
        } else {
          console.log(`[KRAKEN] Retrieved ${filteredOrders.length} closed orders (all pairs)`);
        }
        
        // Transform filtered orders to unified format
        // filteredOrders is already an array with orderId included, so we can map directly
        const transformedOrders = filteredOrders.map(order => ({
          orderId: order.orderId,
          pair: this.convertKrakenPairToStandard(order.descr?.pair || ''),
          direction: (order.descr?.type || 'sell').toLowerCase() as 'buy' | 'sell',
          type: (order.descr?.ordertype || 'market').toLowerCase() as 'market' | 'limit',
          status: order.status === 'closed' ? 'executed' : order.status || '',
          amount: order.vol || '',
          amountExecuted: order.vol_exec || '',
          price: order.price || '',
          limitPrice: order.descr?.ordertype === 'limit' ? (order.descr?.price || '') : '',
          cost: order.cost || '',
        }));
        
        return transformedOrders;
      } else {
        throw new Error(`${exchangeName} API returned empty result`);
      }
    } catch (error: any) {
      console.error('[KRAKEN ERROR] Get closed orders failed:', error);
      
      // Check for Kraken API error format
      if (error.response?.data?.error?.length > 0) {
        const krakenError = error.response.data.error[0];
        console.error(`${exchangeName} get closed orders error: ${krakenError}`);
        throw new Error(`${exchangeName} API error: ${krakenError}`);
      } else {
        console.error(`Failed to get ${exchangeName} closed orders: ${error.message}`);
        throw new Error(`Failed to get ${exchangeName} closed orders: ${error.message}`);
      }
    }
  }

  /**
   * Cancels an order on Kraken by transaction ID
   * https://docs.kraken.com/api/docs/rest-api/cancel-order
   * @param txid The transaction ID of the order to cancel
   */
  async cancelOrder(txid: string): Promise<void> {
    
    try {
      
      if (!txid) {
        throw new Error('Transaction ID is required to cancel an order');
      }
      
      const exchangeName = this.getExchangeName();
      
      // CRITICAL SAFETY CHECK: Block cancel orders in test mode
      // Unlike AddOrder, Kraken's CancelOrder endpoint does NOT respect validate=true
      // It will actually cancel orders even with validate=true, so we must block entirely
      if (this.shouldUseTestMode()) {
        console.log(`[KRAKEN MODE] 🚫 BLOCKED: Cancel order in test mode! Order cancel: (${txid})`);
        console.log('[KRAKEN MODE] ⚠️  WARNING: Kraken CancelOrder API ignores validate=true parameter');
        console.log('[KRAKEN MODE] 🛡️  SAFETY: Preventing real cancellation during testing');
        
        // In test mode, still return successfully (no exception) but don't make API call
        return;
      }
      
      console.log(`[KRAKEN MODE]❗Running in production! Order cancel: (${txid})`);
      
      const nonce = await this.generateUniqueNonce();

      const orderParams: Record<string, string> = {
        nonce: nonce.toString(),
        txid,
        // NOTE: validate=true does NOT work for CancelOrder endpoint - removed for clarity
      };

      const postData = new URLSearchParams(orderParams).toString();
      const path = '/0/private/CancelOrder';
      const apiSecret = this.exchangeApiService.getAPISecret(exchangeName).trim();
      const apiKey = this.exchangeApiService.getAPIKey(exchangeName).trim();

      if (!apiKey || !apiSecret) {
        throw new Error(`${exchangeName} API credentials not configured`);
      }

      const signature = this.signKrakenRequest(path, postData, apiSecret);
      const url = this.getApiUrl(path);

      const headers = {
        'API-Key': apiKey,
        'API-Sign': signature,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'butterfly-services/1.0',
      };

      // Use the ExchangeApiService following the established design pattern
      await this.exchangeApiService.sendApiRequest(exchangeName, {
        url,
        method: 'POST',
        body: postData,
        headers,
      });

      // Return void on success - no content needed for DELETE operations

    } catch (error) {
      // If it's already a specific error we threw, preserve it
      if (error instanceof Error && error.message.includes('Kraken API error:')) {
        throw error;
      }

      console.error(`Failed to cancel order txid: ${txid}:`, error);
      console.error('Order details:', {
        txid,
        // hasApiKey: !!this.exchangeApiService.getAPIKey(exchangeName),
        // hasApiSecret: !!this.exchangeApiService.getAPISecret(exchangeName),
        // errorResponse: (error as any).response?.data,
      });
      throw new Error(`Could not cancel order txid: ${txid}`);
    }
  }
}
