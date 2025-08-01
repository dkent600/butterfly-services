# Testing Strategy

## Overview
Comprehensive testing approach combining unit tests, integration tests, and real-world scenarios to ensure reliability of exchange integrations.

## Testing Framework
- **Vitest**: Modern, fast test runner
- **Coverage**: Comprehensive code coverage reporting
- **Real API Testing**: Integration tests with actual exchange APIs

## Test Structure

### Current Test Coverage (All tests passing)

#### Service Layer Tests (`src/services/__tests__/`)
- **Container Tests**: Dependency injection verification
- **Exchange API Service**: Core service functionality
- **Exchange Time Syncer**: Time synchronization accuracy
- **Base Exchange Service**: Reentrancy and common functionality
- **Kraken API Service**: Complete exchange integration tests
- **MEXC API Service**: Exchange-specific implementations

#### API Route Tests (`src/api/__tests__/`)
- **Server Tests**: Basic server functionality
- **Kraken Route Tests**: Complete HTTP endpoint testing
  - Price fetching endpoints
  - Balance retrieval endpoints
  - Order management endpoints (open/closed orders)
  - Order creation endpoints
- **MEXC Route Tests**: HTTP endpoint validation

#### Specialized Test Categories
- **Nonce Stress Tests**: Concurrent nonce generation under load
- **Race Condition Tests**: Multi-instance service testing
- **Performance Tests**: Time synchronization and API response times

## Test Categories

### 1. Unit Tests
**Purpose**: Test individual components in isolation

**Examples**:
```typescript
// Nonce generation testing
describe('KrakenApiService - Nonce Generation', () => {
  it('should generate unique, increasing nonces', async () => {
    const service = new KrakenApiService(mockExchangeApi, mockEnv);
    const nonce1 = await service.testGenerateNonce();
    const nonce2 = await service.testGenerateNonce();
    expect(nonce2).toBeGreaterThan(nonce1);
  });
});
```

### 2. Integration Tests
**Purpose**: Test complete API workflows

**Examples**:
```typescript
// Route integration testing
describe('GET /api/v1/kraken/orders/open', () => {
  it('should return array of open orders', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/kraken/orders/open'
    });
    
    expect(response.statusCode).toBe(200);
    const result = response.json();
    expect(Array.isArray(result.orders)).toBe(true);
    expect(result.timestamp).toBeDefined();
  });
});
```

### 3. Real API Tests
**Purpose**: Verify actual exchange API interactions

**Requirements**:
- Test API credentials configured
- Network connectivity
- Exchange API availability

**Safety Measures**:
- Always use test/sandbox environments
- Small transaction amounts only
- Comprehensive cleanup procedures

## Test Data Management

### Mock Data Strategy
```typescript
// Realistic test data based on actual API responses
const mockOpenOrdersResponse = {
  result: {
    open: {
      "OQCLML-BW3P3-BUCMWZ": {
        refid: null,
        userref: 0,
        status: "open",
        opentm: 1616663226.8842,
        descr: {
          pair: "XBTUSD",
          type: "sell",
          ordertype: "limit",
          price: "37500.0"
        },
        vol: "1.25000000",
        vol_exec: "0.00000000",
        cost: "0.00000",
        fee: "0.00000",
        price: "0.00000"
      }
    }
  }
};
```

### Array Conversion Testing
```typescript
// Verify object-to-array transformation
it('should convert Kraken object format to array', () => {
  const krakenResponse = { open: { "order1": {...}, "order2": {...} } };
  const result = Object.values(krakenResponse.open);
  expect(Array.isArray(result)).toBe(true);
  expect(result.length).toBe(2);
});
```

## Concurrent Testing

### Nonce Generation Under Load
```typescript
describe('Concurrent Nonce Generation', () => {
  it('should handle multiple simultaneous requests', async () => {
    const promises = Array(10).fill(0).map(() => 
      service.testGenerateNonce()
    );
    
    const nonces = await Promise.all(promises);
    const uniqueNonces = new Set(nonces);
    expect(uniqueNonces.size).toBe(nonces.length);
  });
});
```

### Race Condition Testing
- Multiple service instances
- Simultaneous API calls
- Shared resource access

## Error Scenario Testing

### Network Failures
```typescript
it('should handle network timeouts gracefully', async () => {
  // Mock network failure
  mockAxios.onPost().timeout();
  
  await expect(service.fetchBalance(asset))
    .rejects.toThrow('Could not fetch balance');
});
```

### Exchange API Errors
```typescript
it('should parse Kraken error responses', async () => {
  mockAxios.onPost().reply(200, {
    error: ['EGeneral:Invalid arguments']
  });
  
  await expect(service.getOpenedOrders())
    .rejects.toThrow('Kraken API error: EGeneral:Invalid arguments');
});
```

### Authentication Failures
- Invalid API keys
- Expired credentials
- Insufficient permissions

## Environment-Specific Testing

### Test Mode Verification
```typescript
describe('Test Mode Behavior', () => {
  it('should add validate parameter in test mode', () => {
    const testService = new KrakenApiService(mockApi, testEnv);
    // Verify validate=true is added to order parameters
  });
  
  it('should not add validate parameter in production', () => {
    const prodService = new KrakenApiService(mockApi, prodEnv);
    // Verify no validate parameter in production
  });
});
```

### Configuration Testing
- Environment variable parsing
- Default value handling
- Invalid configuration scenarios

## Integration Testing with Frontend

### Frontend Integration Scenarios
- **Request Queue Testing**: Verify frontend request queuing prevents nonce conflicts
- **Error Handling**: Test frontend retry logic for nonce and network errors  
- **State Synchronization**: Ensure frontend stores stay in sync with backend API
- **Order Flow Testing**: End-to-end order creation and management workflows

### Common Integration Issues
- **Nonce Conflicts**: Despite atomic generation, frontend still experiences intermittent issues
- **Interface Drift**: Frontend duplicates backend interfaces - potential for inconsistency
- **Error Recovery**: Frontend implements recursive retry without exponential backoff

### Testing Recommendations
1. **Shared Test Data**: Use consistent test fixtures between frontend and backend
2. **Contract Testing**: Verify API contracts match frontend expectations
3. **Load Testing**: Test nonce generation under concurrent frontend usage
4. **Error Simulation**: Test frontend resilience to backend errors

## Performance Testing

### Response Time Benchmarks
```typescript
it('should respond within acceptable time limits', async () => {
  const start = Date.now();
  await service.fetchPrice(asset, 'USD');
  const duration = Date.now() - start;
  expect(duration).toBeLessThan(5000); // 5 second limit
});
```

### Memory Usage
- Service instance lifecycle
- Cache management
- Resource cleanup

## Test Commands

### Standard Test Suite
```bash
npm run test        # Full test suite with linting
npm run test:quick  # Tests only, no linting
npm run test:watch  # Watch mode for development
npm run test:coverage  # Coverage report
```

### Test Environment Setup
```bash
# Test-specific environment
NODE_ENV=test
USE_TEST_MODE=true
KRAKEN_API_KEY=test_key
KRAKEN_API_SECRET=test_secret
```

## Continuous Integration

### Pre-commit Hooks
- Linting validation
- Type checking
- Unit test execution

### CI Pipeline
- Full test suite execution
- Coverage reporting
- Integration test runs
- Performance benchmarks

## Test Maintenance

### Regular Updates
- Exchange API changes
- New endpoint additions
- Error handling improvements
- Performance optimizations

### Test Data Refresh
- Update mock responses
- Verify real API compatibility
- Maintain test credentials
