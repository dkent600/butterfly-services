# Butterfly Services Documentation

This directory contains comprehensive documentation for the Butterfly Services project to maintain context and architectural decisions across development sessions.

## Documentation Structure

- **[PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md)** - High-level project architecture and goals
- **[API_ARCHITECTURE.md](API_ARCHITECTURE.md)** - API design patterns and endpoints
- **[EXCHANGE_SERVICES.md](EXCHANGE_SERVICES.md)** - Exchange service implementations and patterns
- **[DEVELOPMENT_LOG.md](DEVELOPMENT_LOG.md)** - Chronological development decisions and changes
- **[TESTING_STRATEGY.md](TESTING_STRATEGY.md)** - Testing approach and coverage
- **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** - Environment configuration and deployment

## Quick Reference

### Current Status (August 1, 2025)
- ✅ Order Management APIs (open/closed/cancel orders)
- ✅ Comprehensive Swagger documentation
- ✅ Production/test mode configuration
- ✅ Time synchronization and nonce management
- ✅ Frontend integration with batch-take-profit application
- � MEXC order cancellation enhancement (symbol lookup)
- 🔄 Interface consolidation between frontend and backend

### Key Commands
```bash
npm run start          # Production mode
npm run dev            # Development mode
npm run test           # Run all tests
npm run build          # Build TypeScript
```

### Environment Files
- `.env.production` - Production configuration (loaded by `npm run start`)
- `.env.development` - Development configuration
- `.env.test` - Test configuration

## Architecture Highlights

### Exchange Services
- **BaseExchangeService** - Abstract base with common functionality
- **KrakenApiService** - Kraken-specific implementation
- **ExchangeTimeSyncer** - Server time synchronization
- **Atomic Nonce Generation** - Thread-safe nonce management

### API Structure
- **Fastify** server with Swagger documentation
- **Dependency Injection** using TSyringe
- **JSON Schema validation** for all endpoints
- **Array-based responses** for consistent API design

### Test Mode vs Production
- `shouldUseTestMode()` controls Kraken's `validate` parameter
- Requires `USE_TEST_MODE=false` AND `NODE_ENV=production` for live trading
- Safety-first approach - defaults to test mode

## Recent Conversations Context

This documentation system is designed to preserve important context between development sessions, including:
- Architectural decisions and rationale
- Implementation patterns and best practices
- Test strategies and coverage
- Environment configuration details
- API design principles

Each document contains detailed information that can be referenced to quickly restore context in future development sessions.
