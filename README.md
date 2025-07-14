# butterfly-services
Random services designed to support dApps and more

This project is a Node.js app running as a service, hosting REST API endpoints for cryptocurrency exchange operations.

## Architecture

- **TypeScript** with ES modules
- **TSyringe** for dependency injection
- **Vitest** for testing with mocking
- **Fastify** (coming soon) for REST API
- **Modern Node.js** with proper crypto support

## Services

- **ExchangeApiService**: Core API operations (signing, authentication)
- **MexcApiService**: MEXC exchange-specific operations
- **LogService**: Centralized logging
- **EnvService**: Configuration management
- **ExchangeTimeSyncer**: Server time synchronization

## Development

```bash
npm test          # Run tests
npm run test:ui   # Run tests with UI (coming soon)
npm run dev       # Start development server (coming soon)
```tterfly-services
Random services designed to support dApps and more

This project is meant to be a node.js app running as a service, hosting REST methods.

Stack:

TSyringe for dependency injection
Vitest for testing
Fastify for REST hosting
