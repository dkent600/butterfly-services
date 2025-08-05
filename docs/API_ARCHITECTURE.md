# API Architecture & Design

## Overview
The API layer provides a clean, documented HTTP interface for exchange services with comprehensive validation, error handling, and OpenAPI documentation.

## Technology Stack
- **Fastify**: High-performance web framework
- **JSON Schema**: Request/response validation
- **Swagger/OpenAPI**: Interactive API documentation
- **CORS & Helmet**: Security middleware

## API Design Principles

### 1. Array-Based Responses
**Rule**: "No count when returning arrays"
```json
{
  "orders": [...],        // Always array, never object
  "timestamp": "..."      // Metadata outside array
}
```

**Rationale**: 
- Consistent client parsing
- No need for count properties
- Easier iteration and mapping
- RESTful conventions

### 2. Comprehensive Schemas
Instead of generic `additionalProperties`, define specific schemas:
```typescript
// ❌ Generic (bad for documentation)
additionalProperties: true

// ✅ Specific (good for clients)
properties: {
  refid: { type: 'string' },
  userref: { type: 'integer' },
  status: { enum: ['pending', 'open', 'closed'] },
  // ... all specific fields
}
```

### 3. Consistent Error Responses
```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": { /* context */ }
}
```

## Current API Endpoints

### Exchange Routes (`/api/v1/:exchange/`)

#### System Information
```
GET /api/v1/:exchange/production-mode
```
- **Purpose**: Check if the service is running in production mode
- **Authentication**: Not required
- **Response**: `{ isProduction: boolean, timestamp: string }`
- **Note**: Returns `false` (test mode) by default for safety. Production mode is determined by the `NODE_ENV` environment variable.

#### Price Fetching
```
GET /api/v1/:exchange/:asset/price/:to
```
- **Purpose**: Get current market price
- **Parameters**: exchange, asset, target currency
- **Response**: `{ price: number, timestamp: string }`

#### Balance Retrieval
```
GET /api/v1/:exchange/:asset/balance
```
- **Purpose**: Get account balance for asset
- **Authentication**: Required (API keys)
- **Response**: `{ balance: number, timestamp: string }`

#### Order Management
```
GET /api/v1/:exchange/orders/open     # ✅ List open orders
GET /api/v1/:exchange/orders/closed   # ✅ List closed orders  
DELETE /api/v1/:exchange/orders/:txid # ✅ Cancel specific order
```
- **Purpose**: Comprehensive order lifecycle management
- **Authentication**: Required
- **Response**: `{ orders: [...], timestamp: string }` for list operations
- **Safety**: Order cancellation blocked in test mode for both exchanges

#### Order Creation
```
POST /api/v1/:exchange/orders/sell/market
POST /api/v1/:exchange/orders/sell/limit
POST /api/v1/:exchange/orders/buy/market
POST /api/v1/:exchange/orders/buy/limit
```
- **Purpose**: Create sell/buy orders (market/limit)
- **Body**: 
  - Sell orders: `{ name: string, amount: number, price?: number, to: string }`
  - Buy orders: `{ name: string, amount: number, price?: number, from: string }`
- **Response**: `{ message: string, asset: string, quantity: number, price?: number, timestamp: string }`
- **Test Mode**: Uses validation endpoints to prevent real trades
- **Note**: Buy order implementation complete for Kraken, MEXC implementation pending

#### Sell Order Endpoints
- **Market Sell**: `POST /api/v1/:exchange/orders/sell/market`
  - Body: `{ name: "BTC", amount: 0.5, to: "USDT" }`
  - Creates immediate market sell order
- **Limit Sell**: `POST /api/v1/:exchange/orders/sell/limit`
  - Body: `{ name: "BTC", amount: 0.5, price: 50000, to: "USDT" }`
  - Creates limit sell order at specified price

#### Buy Order Endpoints
- **Market Buy**: `POST /api/v1/:exchange/orders/buy/market`
  - Body: `{ name: "BTC", amount: 0.5, from: "USDT" }`
  - Creates immediate market buy order
- **Limit Buy**: `POST /api/v1/:exchange/orders/buy/limit`
  - Body: `{ name: "BTC", amount: 0.5, price: 48000, from: "USDT" }`
  - Creates limit buy order at specified price
- **Status**: ✅ Implemented for Kraken, MEXC implementation pending

## Schema Architecture

### Exchange Schemas (`exchange-schemas.ts`)

#### Order Object Schema
```typescript
const OrderObjectSchema = {
  type: 'object',
  properties: {
    refid: { type: 'string' },
    userref: { type: 'integer' },
    status: { 
      type: 'string',
      enum: ['pending', 'open', 'closed', 'canceled', 'expired']
    },
    opentm: { type: 'number' },
    descr: {
      type: 'object',
      properties: {
        pair: { type: 'string' },
        type: { type: 'string', enum: ['buy', 'sell'] },
        ordertype: { type: 'string', enum: ['market', 'limit'] },
        price: { type: 'string' },
        // ... more fields
      }
    },
    // ... more properties
  }
}
```

#### Response Schemas
```typescript
const OpenOrdersResponseSchema = {
  type: 'object',
  properties: {
    orders: {
      type: 'array',
      items: OrderObjectSchema
    },
    timestamp: { type: 'string' }
  }
}
```

### Benefits of Detailed Schemas
1. **Client Documentation**: Clear field definitions
2. **Validation**: Automatic request/response validation
3. **IDE Support**: Better autocomplete and typing
4. **API Contracts**: Clear expectations

## Request/Response Flow

### 1. Route Handler
```typescript
async function getOpenedOrders(request, reply) {
  const { exchange } = request.params;
  // Route-level logic
}
```

### 2. Service Layer
```typescript
const service = container.resolve<IExchangeService>(TYPES.IExchangeService);
const result = await service.getOpenedOrders();
```

### 3. Exchange Implementation
```typescript
// In KrakenApiService
async getOpenedOrders(): Promise<any> {
  // Exchange-specific API calls
  // Authentication and nonce handling
  // Error handling and response formatting
}
```

### 4. Response Transformation
```typescript
// Convert Kraken's object format to array
return {
  orders: Object.values(result.orders.open),
  timestamp: new Date().toISOString()
};
```

## Authentication Flow

### API Key Management
```typescript
// Environment-based credentials
const apiKey = this.exchangeApiService.getAPIKey(exchangeName);
const apiSecret = this.exchangeApiService.getAPISecret(exchangeName);
```

### Request Signing
```typescript
// Kraken signature generation
const signature = this.signKrakenRequest(path, postData, apiSecret);
const headers = {
  'API-Key': apiKey,
  'API-Sign': signature,
  'Content-Type': 'application/x-www-form-urlencoded'
};
```

## Performance Considerations

### Request Queuing and Nonce Management
- **Client-Side Queuing**: Frontend applications should implement request queuing to prevent nonce conflicts
- **Atomic Nonce Generation**: Server uses compare-and-swap pattern for thread-safe nonce generation
- **Time Synchronization**: Each exchange maintains server time sync to ensure accurate nonces
- **Retry Logic**: Clients should implement exponential backoff for nonce-related errors

### Rate Limiting Recommendations
- **Exchange Limits**: Respect individual exchange rate limits (Kraken: 1 req/sec private, MEXC: varies by endpoint)
- **Concurrent Requests**: Avoid parallel requests to same exchange for authenticated endpoints
- **Request Batching**: Group related operations where possible (e.g., balance updates)

### Caching Strategy
- **AssetPairs**: Kraken trading pairs cached for 1 hour
- **Time Synchronization**: Server time cached and periodically refreshed
- **Client-Side**: Frontend should cache non-critical data (prices, balances) appropriately

## Error Handling Strategy

### API Layer Errors
```typescript
// Route-level error handling
try {
  const result = await service.getOpenedOrders();
  reply.send(result);
} catch (error) {
  reply.code(500).send({
    error: error.message,
    exchange,
    timestamp: new Date().toISOString()
  });
}
```

### Service Layer Errors
```typescript
// Exchange service error handling
if (data.error && data.error.length > 0) {
  const errorMessage = data.error.join(', ');
  throw new Error(`Kraken API error: ${errorMessage}`);
}
```

### Error Context Preservation
- Request details logged
- Exchange-specific error codes preserved
- Context information included
- Debugging information available

## Swagger Documentation

### Interactive API Explorer
- Available at `/docs` endpoint
- Live API testing interface
- Schema visualization
- Example requests/responses

### Schema Benefits for Clients
```json
// Instead of meaningless:
"additionalProp1": "string"

// Clients see meaningful:
"refid": "OQCLML-BW3P3-BUCMWZ",
"status": "open",
"opentm": 1616663226.8842,
"descr": {
  "pair": "XBTUSD",
  "type": "sell",
  "ordertype": "limit"
}
```

## Performance Considerations

### Response Optimization
- Minimal data transformation
- Efficient JSON serialization
- Cached exchange metadata (AssetPairs)

### Concurrent Request Handling
- Thread-safe nonce generation
- Async/await throughout
- Non-blocking I/O operations

### Monitoring & Logging
- Request/response timing
- Exchange API performance
- Error rate tracking
- Authentication success/failure rates

## Future API Enhancements

### Planned Endpoints
```
DELETE /api/v1/:exchange/orders/:txid    # Cancel order
GET /api/v1/:exchange/orders/:txid       # Get order details
POST /api/v1/:exchange/:asset/buy        # Buy orders
GET /api/v1/:exchange/trades             # Trade history
```

### WebSocket Support
- Real-time price feeds
- Order status updates
- Balance change notifications

### Rate Limiting
- Exchange-specific limits
- Client-based throttling
- Graceful degradation
