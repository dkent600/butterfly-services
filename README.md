# butterfly-services
Random services designed to support dApps and more

This project is a Node.js app running as a service, hosting REST API endpoints for cryptocurrency exchange operations.

## Setup

1. **Clone the repository**
2. **Install dependencies**: `npm install`
3. **Configure environment**: Copy `.env.example` to `.env` and fill in your API credentials
4. **Build**: `npm run build`
5. **Start**: `npm start` or `npm run dev` for development

## Environment Configuration

Create a `.env` file in the root directory:

```bash
# Copy the example file
cp .env.example .env
```

Then edit `.env` with your actual API credentials:

```bash
# Application Settings
NODE_ENV=development
PORT=3000
USE_TEST_MODE=true  # Set to false for live trading

# MEXC Exchange API Credentials
MEXC_API_KEY=your-mexc-api-key-here
MEXC_API_SECRET=your-mexc-api-secret-here
```

### Test Mode vs Live Mode

- **Test Mode** (`USE_TEST_MODE=true`): Validates orders but doesn't execute trades
- **Live Mode** (`USE_TEST_MODE=false`): Executes actual trades (use with caution!)

## Architecture

- **TypeScript** with ES modules
- **TSyringe** for dependency injection
- **Vitest** for testing with mocking
- **Fastify** for REST API
- **dotenv** for environment configuration
- **Modern Node.js** with proper crypto support

## Services

- **ExchangeApiService**: Core API operations (signing, authentication)
- **MexcApiService**: MEXC exchange-specific operations
- **LogService**: Centralized logging
- **EnvService**: Configuration management with dotenv support
- **ExchangeTimeSyncer**: Server time synchronization

## Development

```bash
npm test          # Run tests with linting
npm run test:quick # Run tests without linting  
npm run test:ui   # Run tests with UI
npm run dev       # Start development server
npm run build     # Build for production
npm run lint      # Run ESLint
```
