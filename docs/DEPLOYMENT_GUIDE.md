# Deployment Guide

## Environment Configuration

### Environment File Structure
The application loads environment files based on `NODE_ENV`:
```
.env.production      # Production configuration (npm run start)
.env.development     # Development configuration (npm run dev)
.env.test           # Test configuration (npm test)
.env                # Fallback configuration
```

### Loading Order
1. `.env.${NODE_ENV}` (e.g., `.env.production`)
2. `.env` (fallback)

**Important**: The first existing file is loaded and processing stops.

## Required Environment Variables

### Core Application
```bash
NODE_ENV=production|development|test
PORT=3000                    # Server port (optional, defaults to 3000)
LOG_LEVEL=info|debug|error   # Logging verbosity
```

### Exchange API Credentials
```bash
# Kraken
KRAKEN_API_KEY=your_api_key
KRAKEN_API_SECRET=your_api_secret

# MEXC (if using)
MEXC_API_KEY=your_api_key
MEXC_API_SECRET=your_api_secret
```

### Safety Configuration
```bash
USE_TEST_MODE=false    # CRITICAL: Must be false for live trading
```

## Production Deployment

### Safety Checklist
- [ ] `NODE_ENV=production` set
- [ ] `USE_TEST_MODE=false` set
- [ ] Valid API credentials configured
- [ ] All tests passing (`npm run test`)
- [ ] Application builds successfully (`npm run build`)

### Deployment Steps

#### 1. Build Application
```bash
npm run build
```
Compiles TypeScript to JavaScript in `dist/` directory.

#### 2. Production Start
```bash
npm run start
```
Equivalent to: `cross-env NODE_ENV=production node dist/index.js`

#### 3. Verify Deployment
- Check logs for environment loading confirmation
- Verify test mode status in logs
- Test API endpoints via `/docs` interface
- Confirm exchange connectivity

### Environment Verification Logs
Look for these log messages on startup:
```
📁 Loaded environment from: .env.production
[KRAKEN MODE]❗Running in production! BTC at 50000, validate: undefined
```

**Warning Signs**:
```
[KRAKEN MODE] Running in test mode! BTC at 50000, validate: true
```
This indicates test mode is still active.

## Development Environment

### Development Setup
```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Development Configuration
```bash
# .env.development
NODE_ENV=development
USE_TEST_MODE=true
LOG_LEVEL=debug
KRAKEN_API_KEY=test_key
KRAKEN_API_SECRET=test_secret
```

### Development Commands
```bash
npm run dev           # Development with hot reload
npm run dev:debug     # Development with debugging
npm run debug         # Single debug run
npm run debug:production  # Production debugging
```

## Testing Environment

### Test Configuration
```bash
# .env.test
NODE_ENV=test
USE_TEST_MODE=true
LOG_LEVEL=error
```

### Test Commands
```bash
npm run test          # Full test suite with linting
npm run test:quick    # Tests only
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
npm run test:ui       # Visual test interface
```

## Security Considerations

### API Key Management
- **Never commit credentials** to version control
- Use environment-specific files (`.env.production`, etc.)
- Rotate keys regularly
- Use least-privilege API permissions

### Production Security
- Enable API key IP restrictions
- Monitor API usage and rate limits
- Log authentication attempts
- Set up alerting for unusual activity

### Environment Isolation
- Separate credentials for each environment
- Test mode should use sandbox/test exchange accounts
- Production credentials should be restricted to production servers

## Monitoring & Logging

### Log Levels
- **ERROR**: Critical issues requiring immediate attention
- **WARN**: Important issues that don't break functionality
- **INFO**: General operational information
- **DEBUG**: Detailed debugging information (development only)

### Key Monitoring Points
- Exchange API response times
- Authentication success/failure rates
- Nonce generation performance
- Order execution results
- Error rates by endpoint

### Health Checks
```bash
# Basic health check
curl http://localhost:3000/health

# API documentation
curl http://localhost:3000/docs
```

## Troubleshooting

### Common Issues

#### 1. Test Mode in Production
**Symptoms**: Orders show `validate: true` in logs
**Solution**: 
- Check `.env.production` has `USE_TEST_MODE=false`
- Verify `NODE_ENV=production` is set
- Restart application

#### 2. API Authentication Failures
**Symptoms**: "Invalid API credentials" errors
**Solution**:
- Verify API keys are correct and not expired
- Check API key permissions on exchange
- Ensure keys are properly set in environment file

#### 3. Nonce Errors
**Symptoms**: "Invalid nonce" from exchange
**Solution**:
- Check system time synchronization
- Verify exchange time syncer is working
- Review nonce generation logs

#### 4. Environment File Not Loading
**Symptoms**: Default values being used
**Solution**:
- Verify file exists in project root
- Check file naming (`.env.production` not `.env.prod`)
- Review startup logs for loading confirmation

### Debug Commands
```bash
# Check environment loading
NODE_ENV=production node -e "
require('dotenv').config({path: '.env.production'});
console.log('USE_TEST_MODE:', process.env.USE_TEST_MODE);
console.log('NODE_ENV:', process.env.NODE_ENV);
"

# Test specific environment file
node -e "
require('dotenv').config({path: '.env.production'});
console.log(Object.keys(process.env).filter(k => k.includes('KRAKEN')));
"
```

## Scaling Considerations

### Horizontal Scaling
- Stateless service design allows multiple instances
- Shared nonce counters need coordination
- Consider Redis for distributed nonce management

### Performance Optimization
- Enable response compression
- Implement request rate limiting
- Cache exchange metadata (AssetPairs)
- Monitor memory usage and garbage collection

### Database Integration
- Consider order history persistence
- Transaction logging for audit trails
- User session management
- Rate limiting storage

## Build System & Artifacts

### TypeScript Build Process
The project uses TypeScript with incremental compilation for faster builds:

```bash
npm run build    # Compiles TypeScript to JavaScript in dist/
```

### Build Artifacts
- **`dist/`** - Compiled JavaScript output (created by `tsc`)
- **`tsconfig.tsbuildinfo`** - TypeScript incremental compilation cache
- **`tsconfig.tsbuildinfo.backup`** - Backup of build info (if exists)

### TypeScript Build Info File
**`tsconfig.tsbuildinfo`** is automatically generated by TypeScript compiler:
- **Purpose**: Speeds up subsequent builds by caching compilation metadata
- **Contains**: File timestamps, dependency graph, type checking results
- **Regenerated**: Automatically on each `tsc` build
- **Git Status**: ✅ Already in `.gitignore` (should not be committed)
- **Safe to Delete**: Yes - will be recreated on next build

#### When to Clean Build Cache
```bash
# Clean build (removes cache, rebuilds everything)
rm tsconfig.tsbuildinfo
npm run build

# Or use clean build script if available
npm run clean && npm run build
```

### Build Performance
- **Incremental builds**: Only recompile changed files
- **Full rebuild**: Clean cache when experiencing build issues
- **Watch mode**: `npm run dev` uses TypeScript watch for live recompilation

## Backup & Recovery

### Critical Data
- Environment configuration files
- Exchange API credentials
- Application logs
- Transaction history

### Recovery Procedures
- Environment restoration process
- API key regeneration steps
- Service restart procedures
- Data validation after recovery
