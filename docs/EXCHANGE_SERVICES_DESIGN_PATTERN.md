# Exchange Services Design Pattern

## Overview

The Exchange Services in the Butterfly Services application follow a specific architectural pattern that promotes separation of concerns, testability, and maintainability. This document outlines the design pattern that **must** be followed when implementing new exchange services or modifying existing ones.

## Architecture Components

### 1. ExchangeApiService (Infrastructure Layer)
- **Purpose**: Handles low-level HTTP communication and common API operations
- **Location**: `src/services/exchange-api-service.ts`
- **Interface**: `IExchangeApiService` in `src/types/interfaces.ts`
- **Responsibilities**:
  - HTTP request execution (GET, POST, DELETE)
  - Request/response logging and debugging
  - Common error handling and logging
  - API credential management
  - Generic signing utilities

### 2. Exchange-Specific Services (Business Logic Layer)
- **Examples**: `KrakenApiService`, `MexcApiService`
- **Location**: `src/services/{exchange}-api-service.ts`
- **Interface**: `IExchangeService` in `src/types/interfaces.ts`
- **Responsibilities**:
  - Exchange-specific business logic
  - Data transformation and mapping
  - Exchange-specific API authentication
  - Nonce generation and management
  - Request preparation and response processing

## Design Pattern Requirements

### 1. Dependency Injection
All exchange services **must** use dependency injection for the `ExchangeApiService`:

```typescript
@injectable()
export class KrakenApiService extends BaseExchangeService implements IExchangeService {
  constructor(
    @inject(TYPES.IExchangeApiService) private readonly exchangeApiService: IExchangeApiService,
    @inject(TYPES.IEnvService) envService: IEnvService,
  ) {
    super(envService);
  }
}
```

### 2. API Request Delegation
All HTTP requests **must** be delegated to the `ExchangeApiService`. Exchange services should **not** make direct HTTP calls using axios or other libraries.

#### ✅ Correct Pattern:
```typescript
async cancelOrder(txid: string): Promise<any> {
  // 1. Prepare exchange-specific data
  const nonce = await this.generateUniqueNonce();
  const postData = `nonce=${nonce}&txid=${txid}`;
  const path = '/0/private/CancelOrder';
  
  // 2. Get credentials via exchangeApiService
  const apiKey = this.exchangeApiService.getAPIKey(exchangeName);
  const apiSecret = this.exchangeApiService.getAPISecret(exchangeName);
  
  // 3. Create exchange-specific signature
  const signature = this.signKrakenRequest(path, postData, apiSecret);
  const url = this.getApiUrl(path);
  
  // 4. Delegate HTTP request to exchangeApiService
  const response = await this.exchangeApiService.cancelOrder(txid, exchangeName, {
    url,
    method: 'POST',
    body: postData,
    headers: {
      'API-Key': apiKey,
      'API-Sign': signature,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
  
  // 5. Process exchange-specific response
  return this.processResponse(response);
}
```

#### ❌ Incorrect Pattern:
```typescript
async cancelOrder(txid: string): Promise<any> {
  // DON'T DO THIS - direct HTTP calls bypass the architecture
  const { data } = await axios.post(url, postData, { headers });
  return data;
}
```

### 3. Credential Management
Credentials **must** be accessed through the `ExchangeApiService`:

```typescript
// ✅ Correct
const apiKey = this.exchangeApiService.getAPIKey(exchangeName);
const apiSecret = this.exchangeApiService.getAPISecret(exchangeName);

// ❌ Incorrect - bypassing the service layer
const apiKey = process.env.KRAKEN_API_KEY;
```

### 4. Error Handling
Follow the established error handling pattern:

```typescript
try {
  const response = await this.exchangeApiService.someOperation(...);
  
  // Handle exchange-specific errors
  if (response.error && response.error.length > 0) {
    const errorMessage = response.error.join(', ');
    throw new Error(`${exchangeName} API error: ${errorMessage}`);
  }
  
  return this.processResponse(response);
} catch (error: any) {
  console.error(`[${exchangeName.toUpperCase()} ERROR] Operation failed:`, error);
  
  // Preserve specific errors
  if (error.message.includes(`${exchangeName} API error:`)) {
    throw error;
  }
  
  // Wrap generic errors
  throw new Error(`Failed to perform operation: ${error.message}`);
}
```

## ExchangeApiService Interface Extension

When adding new operations, extend the `IExchangeApiService` interface:

```typescript
export interface IExchangeApiService {
  // Existing methods...
  sendApiRequest(...): Promise<void>;
  // More methods as needed...
}
```

## Benefits of This Pattern

1. **Separation of Concerns**: HTTP logic separated from business logic
2. **Testability**: Easy to mock `ExchangeApiService` for unit tests
3. **Consistency**: Uniform logging, error handling, and debugging
4. **Maintainability**: Changes to HTTP handling affect all exchanges uniformly
5. **Debugging**: Centralized request/response logging
6. **Security**: Centralized credential management

## Migration Guidelines

When updating existing methods that don't follow this pattern:

1. Extend `IExchangeApiService` interface if needed
2. Implement new method in `ExchangeApiService`
3. Update exchange service to use `this.exchangeApiService`
4. Remove direct HTTP calls
5. Update tests to mock `ExchangeApiService`

## Examples

### Current Implementation Status

#### ✅ Following Pattern:
- `KrakenApiService.createSellOrder()` - Uses `exchangeApiService.sendApiRequest()`
- `KrakenApiService.cancelOrder()` - Uses `exchangeApiService.sendApiRequest()`
- `MexcApiService.createSellOrder()` - Uses `exchangeApiService.sendApiRequest()`
- `MexcApiService.cancelOrder()` - Uses `exchangeApiService.sendApiRequest()` (partial - needs symbol lookup)

#### 🔄 Needs Migration:
- `KrakenApiService.fetchPrice()` - Direct axios calls (public endpoint - lower priority)
- `KrakenApiService.fetchBalance()` - Direct axios calls 
- `KrakenApiService.getOpenedOrders()` - Direct axios calls
- `KrakenApiService.getClosedOrders()` - Direct axios calls
- `MexcApiService.fetchPrice()` - Direct axios calls (public endpoint - lower priority)
- `MexcApiService.fetchBalance()` - Direct axios calls
- `MexcApiService.getOpenedOrders()` - Direct axios calls
- `MexcApiService.getClosedOrders()` - Direct axios calls

#### 📋 Migration Priority:
1. **High Priority**: Private endpoints (balance, orders) - security and consistency critical
2. **Medium Priority**: Public endpoints (price) - consistency helpful but not security critical
3. **Future**: Consider separating public vs private endpoint patterns

## Testing Pattern

When testing exchange services, mock the `ExchangeApiService`:

```typescript
const mockExchangeApiService = {
  cancelOrder: vi.fn(),
  getAPIKey: vi.fn().mockReturnValue('test-key'),
  getAPISecret: vi.fn().mockReturnValue('test-secret'),
} as any;

// Test the business logic without HTTP concerns
```

This design pattern ensures consistency, maintainability, and proper separation of concerns across all exchange implementations.
