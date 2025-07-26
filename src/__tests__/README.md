# Test Organization by Exchange

This directory structure organizes automated tests by exchange to facilitate adding new exchanges in the future.

## Directory Structure

```
__tests__/
├── exchanges.test.ts          # Legacy notice file
├── server.test.ts             # General server tests
├── kraken/                    # Kraken-specific tests
│   └── kraken-routes.test.ts  # Kraken API route tests
└── mexc/                      # MEXC-specific tests
    └── mexc-routes.test.ts    # MEXC API route tests
```

## Service-Level Tests

Service-level tests are organized similarly under `src/services/__tests__/`:

```
services/__tests__/
├── container.test.ts                    # DI container tests
├── exchange-api-service.test.ts         # Shared API service tests
├── exchange-time-syncer.test.ts         # Time synchronization tests
├── exchange-time-syncer-performance.test.ts
├── base-exchange-service-reentrancy.test.ts
├── kraken/                              # Kraken service tests
│   ├── kraken-api-service.test.ts       # Main Kraken service tests
│   ├── kraken-nonce-stress.test.ts      # Nonce generation stress tests
│   ├── kraken-race-condition.test.ts    # Race condition tests
│   └── kraken-sequential-balance.test.ts # Sequential API call tests
└── mexc/                                # MEXC service tests
    └── mexc-api-service.test.ts         # Main MEXC service tests
```

## Adding a New Exchange

When adding a new exchange (e.g., Binance):

1. **Create service tests directory:**
   ```
   mkdir src/services/__tests__/binance
   ```

2. **Create API route tests directory:**
   ```
   mkdir src/api/__tests__/binance
   ```

3. **Create test files:**
   - `src/services/__tests__/binance/binance-api-service.test.ts`
   - `src/api/__tests__/binance/binance-routes.test.ts`

4. **Follow naming conventions:**
   - Service tests: `{exchange}-api-service.test.ts`
   - Route tests: `{exchange}-routes.test.ts`
   - Specialized tests: `{exchange}-{feature}.test.ts`

## Test Categories by Exchange

### Kraken Tests
- **API Service**: Core business logic, pair creation, order management
- **Nonce Generation**: Thread safety, uniqueness, stress testing
- **Race Conditions**: Concurrent request handling
- **Sequential Operations**: Balance fetching patterns
- **API Routes**: HTTP endpoints, request/response validation

### MEXC Tests
- **API Service**: Core business logic, order operations
- **API Routes**: HTTP endpoints, request/response validation

### Shared Tests
- **Exchange API Service**: Common HTTP functionality
- **Time Synchronization**: Server time sync across exchanges
- **Container**: Dependency injection setup
- **Base Exchange Service**: Shared functionality and reentrancy

## Benefits of This Organization

1. **Scalability**: Easy to add new exchanges without affecting existing tests
2. **Isolation**: Exchange-specific issues don't impact other exchange tests
3. **Maintenance**: Clear ownership and responsibility for test code
4. **Performance**: Can run tests for specific exchanges independently
5. **Documentation**: Test structure serves as documentation for exchange capabilities

## Running Tests

Run all tests:
```bash
npm test
```

Run tests for a specific exchange:
```bash
# Kraken tests only
npm test -- kraken

# MEXC tests only
npm test -- mexc
```

Run specific test categories:
```bash
# API route tests
npm test -- routes

# Service tests
npm test -- services
```
