# Development Log

## July 21, 2025

### Order Management API Implementation
**Context**: User asked "have you tested the new orders open and closed APIs?"

**Actions Taken**:
1. **Discovered missing API route tests** - Only service tests existed
2. **Implemented comprehensive order management**:
   - `GET /api/v1/kraken/orders/open` - List open orders
   - `GET /api/v1/kraken/orders/closed` - List closed orders
   - Added route handlers in `exchanges.ts`
   - Created service methods in `KrakenApiService`

**Key Technical Decisions**:
- **Array-based responses**: Changed from object format to arrays following "no count when returning arrays" rule
- **Object.values() transformation**: Convert Kraken's object-based response to clean arrays
- **Comprehensive error handling**: Kraken-specific error parsing and logging
- **Authentication flow**: Full API key/secret handling with request signing

**Test Coverage Added**:
- 4 new route integration tests
- Comprehensive order object validation
- Error scenario testing
- Achieved 20/20 tests passing

### Schema Documentation Enhancement
**Problem**: Swagger docs showed meaningless "additionalProp1" placeholders

**Solution**:
- Researched Kraken API documentation
- Created detailed `OrderObjectSchema` with all specific properties
- Replaced `additionalProperties: true` with comprehensive field definitions
- Enhanced client documentation experience

**Schema Structure**:
```typescript
// Order object with nested descr structure
refid, userref, status, opentm, descr{pair, type, ordertype}, vol, vol_exec, cost, fee, price, etc.
```

### Production Mode Configuration Issue
**Problem**: Orders were being placed in test mode during production (`npm run start`)

**Root Cause**: 
- The line `...(this.shouldUseTestMode() && { validate: 'true' })` was correctly adding validation mode
- Issue was likely `USE_TEST_MODE=true` in `.env.production` file

**Environment File Loading Logic**:
- `npm run start` sets `NODE_ENV=production`
- Code looks for `.env.production` first, then falls back to `.env`
- `shouldUseTestMode()` requires BOTH `USE_TEST_MODE=false` AND `NODE_ENV=production` for live trading

**Safety Mechanism Confirmed**:
- Double protection prevents accidental live trading
- Defaults to test mode unless explicitly configured
- Logging clearly indicates production vs test mode

### Documentation System Creation
**Motivation**: Need better context preservation across development sessions

**Created Files**:
- `docs/README.md` - Documentation index and quick reference
- `docs/PROJECT_OVERVIEW.md` - High-level architecture and goals
- `docs/EXCHANGE_SERVICES.md` - Service layer patterns and implementation
- `docs/API_ARCHITECTURE.md` - API design principles and endpoints
- `docs/DEVELOPMENT_LOG.md` - This file for chronological context

**Benefits**:
- External memory aid for future conversations
- Context preservation across sessions
- Architectural decision documentation
- Onboarding resource for new developers

## Key Patterns Established

### Test Mode vs Production
```typescript
// Safety-first approach
protected shouldUseTestMode(): boolean {
  const useTestMode = this.envService.getBoolean('app.useTestMode');
  const nodeEnv = this.envService.get('app.environment');
  
  // Only allow live trading if ALL conditions met
  if (useTestMode === false && nodeEnv === 'production') {
    return false; // Live trading
  }
  return true; // Test mode (safe default)
}
```

### Atomic Nonce Generation
```typescript
// Thread-safe, strictly increasing nonces
protected async generateAtomicNonce(
  globalNonceRef: { value: number },
  exchangeName: string,
  instanceId?: number
): Promise<number>
```

### Array-Based API Responses
```typescript
// Consistent format across all endpoints
return {
  orders: Object.values(result.orders.open), // Always array
  timestamp: new Date().toISOString()
};
```

### Comprehensive Schema Documentation
```typescript
// Detailed schemas instead of additionalProperties
const OrderObjectSchema = {
  type: 'object',
  properties: {
    refid: { type: 'string' },
    status: { enum: ['pending', 'open', 'closed'] },
    // ... all specific fields
  }
}
```

## August 1, 2025

### Frontend Integration Analysis
**Context**: Comprehensive review of batch-take-profit frontend integration with butterfly-services

**Key Findings**:
- **Nonce Issues Persist**: Frontend still experiences intermittent "EAPI:Invalid nonce" errors despite atomic generation improvements
- **Request Queue Implementation**: Frontend uses `RequestQueueService` to serialize API calls and prevent race conditions
- **Retry Logic**: Frontend implements recursive retry for nonce errors in `ExchangeComponent.updateAssetBalance()`
- **Interface Duplication**: Frontend duplicates `IOpenedOrderListItem` and `IClosedOrderListItem` interfaces from butterfly-services

**Frontend Architecture Observations**:
- **Aurelia Framework**: Uses dependency injection with `@inject` decorators
- **Service Layer**: `AssetExchangeApiService` acts as client-side proxy to butterfly-services
- **State Management**: Separate stores for assets and orders with reactive updates
- **Validation**: Complex client-side validation for percentage/amount calculations

**Integration Patterns**:
- Frontend queues all requests: `this.queueService.enqueue(() => this.updateAllCurrentPrices())`
- Manual balance refresh before order creation to prevent stale data
- Alert-based user feedback for order operations and validation errors

**Technical Debt Identified**:
- Interface duplication between frontend and backend
- Comment indicates nonce issues "due to being unable to avoid requests to the exchange arriving out of order"
- Recursive retry without exponential backoff could cause issues
- Mixed promise patterns (manual counting vs Promise.all)

**Recommendations**:
1. Investigate if recent atomic nonce improvements resolve frontend issues
2. Consider shared interface definitions between projects
3. Implement exponential backoff for retry logic
4. Standardize promise handling patterns
5. Add request deduplication to prevent unnecessary API calls

### Order Cancellation API Status Update
**Status**: ✅ **COMPLETED** - Order cancellation implemented for both Kraken and MEXC

**Implementation Details**:
- `DELETE /api/v1/kraken/orders/:txid` - Fully implemented with safety blocks in test mode
- `DELETE /api/v1/mexc/orders/:txid` - Basic implementation (requires symbol lookup enhancement)
- Both exchanges properly block cancellation in test mode for safety
- Following established design pattern with `ExchangeApiService` delegation

## Pending Work

### Immediate
- **MEXC Order Cancellation Enhancement**: Implement symbol lookup for complete cancellation support
- **Frontend Integration Testing**: Verify recent nonce improvements resolve frontend retry issues
- **Interface Consolidation**: Consider shared interface definitions between frontend and backend

### Future Enhancements
- Additional exchange integrations (Binance, Coinbase)
- WebSocket support for real-time data
- Rate limiting and request throttling
- Enhanced monitoring and metrics
- Shared TypeScript interfaces package for frontend/backend consistency

## Architecture Decisions Record

### Time Synchronization
- **Decision**: Use singleton time syncers per exchange
- **Rationale**: Accurate server time critical for API requests
- **Implementation**: `ExchangeTimeSyncer` with drift compensation

### Dependency Injection
- **Decision**: Use TSyringe for DI container
- **Rationale**: Clean separation of concerns, testability
- **Implementation**: Interface-based design with `@injectable` decorators

### Error Handling
- **Decision**: Preserve exchange-specific error context
- **Rationale**: Better debugging and client error handling
- **Implementation**: Try/catch with context preservation

### Testing Strategy
- **Decision**: Both unit and integration tests
- **Rationale**: Confidence in external API interactions
- **Implementation**: Vitest with real API testing capabilities
