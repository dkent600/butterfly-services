# Test Scripts Organization

This directory contains development and debugging scripts that were previously in the root folder. These are **not** the formal unit tests (which are in `src/**/__tests__/`), but rather utility scripts for testing specific functionality during development.

## Directory Structure

### `api-testing/`
Scripts for testing API endpoints and functionality:
- `test-new-order-api.ts` - Testing new order API functionality
- `test-production-scenario.js` - Production scenario testing
- `test-real-client.js` - Real client interaction testing

### `concurrency-testing/`
Scripts for testing concurrent request handling and performance:
- `test-concurrent-requests.js` - Testing concurrent API requests
- `test-concurrent-api.mjs` - ES module concurrent API testing
- `test-concurrent.ps1` - PowerShell concurrent testing script
- `test-balance-concurrency.js` - Balance request concurrency testing
- `test-multi-process.js` - Multi-process testing scenarios
- `test-sequential-vs-concurrent.cjs` - Comparing sequential vs concurrent performance

### `nonce-testing/`
Scripts for testing nonce generation and management:
- `test-nonce-fix.js` - Testing nonce fix implementations
- `test-nonce-fix.cjs` - CommonJS version of nonce testing
- `test-nonce-fix.mjs` - ES module version of nonce testing
- `test-nonce-queue.js` - Testing nonce queue functionality
- `test-real-nonces.js` - Real nonce generation testing
- `debug-nonce.js` - Nonce debugging utilities

### `exchange-testing/`
Scripts for testing exchange-specific functionality:
- `test-kraken-api.js` - Direct Kraken API testing
- `test-public-kraken.js` - Public Kraken endpoint testing
- `test-kraken-pairs.js` - Kraken trading pair testing
- `test-doge-pairs.js` - DOGE-specific pair testing
- `test-pair-creation.js` - Trading pair creation testing
- `test-usd-formats.js` - USD format handling testing

## Usage

These scripts are development tools and should be run individually as needed:

```bash
# Example: Test concurrent requests
node scripts/concurrency-testing/test-concurrent-requests.js

# Example: Test Kraken API directly
node scripts/exchange-testing/test-kraken-api.js

# Example: Debug nonce generation
node scripts/nonce-testing/debug-nonce.js
```

## Important Notes

⚠️ **Security Warning**: Some scripts may contain API credentials. These should be reviewed before committing to version control.

🔧 **Development Only**: These scripts are for development and debugging purposes only. They are not part of the production application.

📋 **Formal Tests**: For formal unit and integration tests, see:
- `src/api/__tests__/` - API route tests
- `src/services/__tests__/` - Service layer tests
- Run with: `npm run test`

## Maintenance

When adding new development scripts:
1. Place them in the appropriate subdirectory
2. Use descriptive filenames with `test-` prefix
3. Update this README if creating new categories
4. Ensure no sensitive credentials are hardcoded
