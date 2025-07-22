# Project Overview - Butterfly Services

## Project Mission
Butterfly Services is a TypeScript-based API service that provides secure, reliable interfaces to cryptocurrency exchanges for dApps and other applications. The project emphasizes safety, testing, and production-ready exchange integrations.

## Core Architecture

### Technology Stack
- **Runtime**: Node.js with TypeScript
- **API Framework**: Fastify with Swagger/OpenAPI documentation
- **Dependency Injection**: TSyringe for clean architecture
- **Testing**: Vitest with comprehensive coverage
- **Build**: TypeScript compiler with ES modules

### Key Design Principles

1. **Safety First**: Default to test mode unless explicitly configured for production
2. **Clean Architecture**: Dependency injection and interface-based design
3. **Exchange Abstraction**: Common patterns across different exchange APIs
4. **Time Synchronization**: Accurate server time for API requests
5. **Atomic Operations**: Thread-safe nonce generation for concurrent requests

## Project Structure

```
src/
├── api/                    # HTTP API layer
│   ├── routes/            # Fastify route handlers
│   ├── schemas/           # JSON schema definitions
│   └── server.ts          # Main server configuration
├── services/              # Business logic layer
│   ├── base-exchange-service.ts    # Abstract base class
│   ├── kraken-api-service.ts       # Kraken implementation
│   ├── exchange-time-syncer.ts     # Time synchronization
│   └── env-service.ts              # Environment configuration
├── types/                 # TypeScript interfaces
└── container.ts           # Dependency injection setup
```

## Supported Exchanges

### Kraken
- ✅ Price fetching
- ✅ Balance retrieval
- ✅ Order creation (market/limit)
- ✅ Open orders listing
- ✅ Closed orders listing
- 🚧 Order cancellation (planned)

### Future Exchanges
- MEXC (partially implemented)
- Binance (planned)
- Coinbase (planned)

## Environment Configuration

### Required Environment Variables
```bash
NODE_ENV=production|development|test
USE_TEST_MODE=false         # Required for live trading
KRAKEN_API_KEY=your_key
KRAKEN_API_SECRET=your_secret
LOG_LEVEL=info|debug
```

### Safety Mechanisms
- **Double Protection**: Both `USE_TEST_MODE=false` AND `NODE_ENV=production` required for live trading
- **Default Test Mode**: Always defaults to safe test mode
- **Validation Mode**: Kraken's `validate=true` parameter for testing API calls

## API Design Patterns

### Response Format
```json
{
  "orders": [...],           // Always arrays for consistency
  "timestamp": "ISO_STRING"  // Server timestamp
}
```

### Error Handling
- Consistent error responses across all endpoints
- Detailed logging with context preservation
- Graceful fallbacks for external API failures

## Development Philosophy

1. **Test-Driven**: Comprehensive test coverage with real-world scenarios
2. **Documentation-First**: Swagger schemas define API contracts
3. **Monitoring**: Extensive logging for debugging and monitoring
4. **Extensibility**: Easy to add new exchanges following established patterns
