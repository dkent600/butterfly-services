# Exchange Services Architecture

## Overview
The exchange services layer provides a clean abstraction for interacting with different cryptocurrency exchanges while maintaining consistent patterns and safety mechanisms.

## BaseExchangeService (Abstract Class)

### Purpose
Eliminates code duplication across exchange implementations by providing:
- Time synchronization with exchange servers
- Atomic nonce generation for thread safety
- Common utility methods
- Environment-based test/production mode switching

### Key Methods

#### Time Synchronization
```typescript
protected async getTimeSyncer(): Promise<IExchangeTimeSyncer>
protected async getServerTimestamp(): Promise<string>
```
- Singleton time syncer per exchange
- Accurate server time for API requests
- Handles time drift and network latency

#### Nonce Generation
```typescript
protected async generateAtomicNonce(
  globalNonceRef: { value: number },
  exchangeName: string,
  instanceId?: number
): Promise<number>
```
- **Thread-safe**: Uses compare-and-swap pattern
- **Strictly increasing**: Never reuses nonces
- **Server-synchronized**: Based on exchange server time
- **Concurrent-safe**: Works with multiple service instances

#### Test Mode Control
```typescript
protected shouldUseTestMode(): boolean
```
- **Safety first**: Defaults to test mode
- **Double protection**: Requires both `USE_TEST_MODE=false` AND `NODE_ENV=production`
- **Environment aware**: Different behavior per environment

## KrakenApiService Implementation

### Key Features

#### Asset Name Mapping
```typescript
private mapAssetToKraken(assetName: string): string
```
Maps standard asset names to Kraken's conventions:
- BTC → XXBT
- ETH → XETH  
- USD → ZUSD
- Most others unchanged

#### Trading Pair Creation
```typescript
createPair(asset: IAsset, to: string): string
```
- Uses cached AssetPairs data from Kraken API
- Finds correct trading pair formats
- Handles Kraken's complex pair naming

#### Order Management
```typescript
async createSellOrder(asset: IAsset, options: {...}): Promise<any>
async getOpenedOrders(): Promise<any>
async getClosedOrders(): Promise<any>
```
- **Test Mode Integration**: Adds `validate: 'true'` when in test mode
- **Market vs Limit**: Different parameter sets
- **Error Handling**: Comprehensive Kraken-specific error parsing

#### API Signature Generation
```typescript
private signKrakenRequest(path: string, postData: string, apiSecret: string): string
```
Implements Kraken's exact signature algorithm:
1. SHA256 hash of nonce + postData
2. HMAC-SHA512 with API secret
3. Base64 encoding

### Caching Strategy
- **AssetPairs Cache**: 1-hour TTL for trading pair data
- **Static Cache**: Shared across all instances
- **Background Loading**: Non-blocking initialization

## Time Synchronization System

### ExchangeTimeSyncer
- **Per-exchange singletons**: Each exchange has its own time syncer
- **Drift compensation**: Tracks server time vs local time
- **Periodic updates**: Keeps synchronization fresh
- **Fallback handling**: Graceful degradation if sync fails

### Nonce Generation Deep Dive

#### The Problem
- Exchanges require strictly increasing nonces
- Concurrent requests can cause race conditions
- Server time drift can cause nonce conflicts
- Replay attacks must be prevented

#### The Solution
```typescript
// Atomic compare-and-swap pattern
while (attempts < maxAttempts) {
  const currentGlobalNonce = globalNonceRef.value;
  generatedNonce = currentGlobalNonce + 1;
  
  // Only update if no other thread changed the value
  if (globalNonceRef.value === currentGlobalNonce) {
    globalNonceRef.value = generatedNonce;
    break;
  }
  attempts++;
}
```

#### Safety Measures
- **Maximum attempts**: Prevents infinite loops
- **Time validation**: Ensures nonces aren't too old
- **Server time boost**: Uses server time as minimum
- **Detailed logging**: Comprehensive debugging information

## Error Handling Patterns

### Kraken-Specific Errors
```typescript
if (data.error && data.error.length > 0) {
  const errorMessage = data.error.join(', ');
  // Special handling for nonce errors
  if (errorMessage.toLowerCase().includes('nonce')) {
    // Detailed nonce analysis and logging
  }
  throw new Error(`Kraken API error: ${errorMessage}`);
}
```

### Environment Context Logging
```typescript
console.log(`[KRAKEN AUTH] Using credentials - Key: ${apiKey.substring(0, 6)}..., Secret: ${apiSecret.substring(0, 6)}..., Env: ${process.env.NODE_ENV || 'unknown'}`);
```

## Testing Strategy

### Service Tests
- **Nonce generation**: Thread safety and uniqueness
- **Time synchronization**: Accuracy and fallbacks
- **API interactions**: Mocked external calls
- **Error scenarios**: Comprehensive error handling

### Integration Tests
- **Real API calls**: Using test credentials
- **Concurrent scenarios**: Multiple simultaneous requests
- **Production simulation**: End-to-end workflows

## Future Extensibility

### Adding New Exchanges
1. Extend `BaseExchangeService`
2. Implement abstract methods
3. Add exchange-specific mapping logic
4. Create comprehensive tests
5. Update API routes

### Pattern Benefits
- **Consistent interface**: Same methods across exchanges
- **Shared infrastructure**: Time sync, nonce generation
- **Reduced complexity**: Focus on exchange-specific logic
- **Easy testing**: Mock common functionality
