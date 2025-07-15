# butterfly-services
Random services designed to support dApps and more

This project is a Node.js app running as a service, hosting REST API endpoints for cryptocurrency exchange operations.

## Setup

1. **Clone the repository**
2. **Install dependencies**: `npm install`
3. **Configure environment**: Copy `.env.development.example` to `.env.development` and fill in your API credentials
4. **Build**: `npm run build`
5. **Start**: `npm start` or `npm run dev` for development

## Starting the Service

### Development Mode (Recommended)
```bash
npm run dev
```
- Uses `tsx watch` for hot reloading
- Automatically restarts when you make code changes
- Runs directly from TypeScript source files
- Perfect for development and testing

### Production Mode
```bash
npm run build    # Compile TypeScript to JavaScript
npm start        # Run the compiled version
```

### Expected Startup Output
```
📁 Loaded environment from: .env.development
✅ Dependency injection configured
✅ Services initialized  
🚀 Server running at http://localhost:3000
📚 API Documentation available at http://localhost:3000/docs
[timestamp] INFO: Server listening at http://127.0.0.1:3000
[timestamp] INFO: Server listening at http://[::1]:3000
```
> Note: You'll see both IPv4 (127.0.0.1) and IPv6 ([::1]) localhost addresses

### Access Points
- **API Server**: `http://localhost:3000`
- **Swagger Documentation**: `http://localhost:3000/docs`
- **API Endpoints**: `http://localhost:3000/api/v1/...`

## Checking if Service is Running

### Quick Browser Test
Open your browser and navigate to:
- `http://localhost:3000` - Should show the API welcome page
- `http://localhost:3000/docs` - Should show Swagger documentation

### Command Line Checks

**PowerShell (Windows):**
```powershell
# Check if port 3000 is in use
netstat -an | Select-String ":3000"

# Check TCP connections on port 3000
Get-NetTCPConnection -LocalPort 3000

# Test connection to the port
Test-NetConnection -ComputerName localhost -Port 3000
```

**Command Prompt (Windows):**
```cmd
# Check specific port
netstat -an | findstr ":3000"

# Show all listening ports
netstat -an | findstr "LISTENING"
```

**Bash/Linux/macOS:**
```bash
# Check if port is in use
netstat -an | grep :3000

# Or use ss (modern alternative)
ss -tulnp | grep :3000

# Test with curl
curl http://localhost:3000
```

### Expected Results When Running
- **Port Check**: Should show `127.0.0.1:3000` and `[::1]:3000` in LISTEN state
- **Console Output**: Should show both IPv4 (`127.0.0.1:3000`) and IPv6 (`[::1]:3000`) localhost addresses
- **Browser**: Should display API documentation or welcome page at `http://localhost:3000`
- **curl**: Should return HTTP response (not connection refused)

## Development Commands Reference

### Startup Commands

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `npm run dev` | Development server with hot reload | When hosting for development clients |
| `npm run dev:debug` | Development server with debugger + hot reload | Debug while developing (restarts on file changes) |
| `npm run debug` | Development server with debugger (no hot reload) | Debug single session (no auto-restart) |
| `npm run build` | Compile TypeScript to JavaScript | Before production deployment |
| **`npm start`** | **Production server** (runs compiled JS) | **Production deployment** |

### Testing Commands

| Command | Purpose | Output |
|---------|---------|---------|
| `npm test` | Full test suite with linting | Comprehensive validation |
| `npm run test:quick` | Tests only (skip linting) | Fast feedback loop |
| `npm run test:ui` | Interactive test UI | Visual test management |
| `npm run test:watch` | Tests in watch mode | Continuous testing |
| `npm run test:coverage` | Tests with coverage report | Quality metrics |

### Code Quality Commands

| Command | Purpose | Use Case |
|---------|---------|----------|
| `npm run lint` | Check code style | Pre-commit validation |
| `npm run lint:fix` | Auto-fix style issues | Code cleanup |
| `npm run lint:check` | Strict linting (zero warnings) | CI/CD pipeline |

### Production Commands

| Command | Purpose | Usage |
|---------|---------|-------|
| `npm run build` | Compile TypeScript to JavaScript | Required before production |
| `npm start` | Run production server | Production deployment |
| `npm run debug:production` | **Debug production** with real credentials | **Production troubleshooting** |

> **Production Workflow**: `npm run build` → `npm start`  
> **Production Debug**: `npm run debug:production` (⚠️ uses real credentials)

### Debugging Options

#### 1. Command Line Debugging
```bash
# Start with debugger attached (inspect mode)
npm run debug

# Development with debugger (hot reload + inspect)
npm run dev:debug
```
- Debugger listens on `ws://127.0.0.1:9229`
- Use Chrome DevTools: `chrome://inspect`
- Or attach VS Code debugger to running process

#### 2. VS Code Debug Configurations

The project includes 5 VS Code debug configurations in `.vscode/launch.json`:

**A. Debug Butterfly Services** (Main Application)
- **Purpose**: Debug the main server application
- **Command**: Uses `tsx --inspect src/index.ts`
- **Usage**: Press F5 or Run → Start Debugging
- **Best for**: Server logic, API endpoints, service initialization

**B. Debug Current TS File** (Any File)
- **Purpose**: Debug any TypeScript file currently open
- **Command**: Uses `tsx --inspect ${file}`
- **Usage**: Open any .ts file → F5 to debug that specific file
- **Best for**: Testing individual modules, utility functions

**C. Debug Tests** (Test Runner)
- **Purpose**: Debug test execution with breakpoints
- **Command**: Uses `vitest --inspect-brk --no-coverage --run`
- **Usage**: Set breakpoints in tests → Run this configuration
- **Best for**: Troubleshooting failing tests, test logic

**D. Attach to Running Server** (External Process)
- **Purpose**: Attach to already running debug server
- **Command**: Attaches to `localhost:9229`
- **Usage**: Start `npm run dev:debug` first, then use this config
- **Best for**: Debugging live development server

**E. Debug Production (CAUTION)** (Production Issues)
- **Purpose**: Debug with real production data and credentials
- **Command**: Uses `tsx --inspect` with `.env.production.debug`
- **Usage**: Only when debugging production issues
- **Best for**: Production troubleshooting with enhanced logging
- **⚠️ WARNING**: Uses real credentials and production data

#### 3. Debugging Workflow Examples

**Debug Server Startup:**
1. Set breakpoints in `src/index.ts`
2. Use "Debug Butterfly Services" configuration
3. Step through initialization logic

**Debug API Endpoints:**
1. Start server: `npm run dev:debug`
2. Use "Attach to Running Server" configuration
3. Set breakpoints in service files
4. Make API calls via Swagger UI or curl

**Debug Tests:**
1. Set breakpoints in test files
2. Use "Debug Tests" configuration
3. Step through test execution

**Debug Individual Files:**
1. Open any TypeScript file (e.g., `src/services/mexc-api-service.ts`)
2. Set breakpoints
3. Use "Debug Current TS File" configuration
4. File runs in isolation for testing

#### 4. Debug Server Connection

When debugging is active, you'll see:
```
Debugger listening on ws://127.0.0.1:9229/[uuid]
For help, see: https://nodejs.org/en/docs/inspector
```

**Manual Connection Options:**
- **Chrome**: Open `chrome://inspect` → Configure `localhost:9229`
- **VS Code**: Use "Attach to Running Server" configuration
- **External Tools**: Any debugger that supports Node.js inspect protocol

### Quick Reference Commands

```bash
# 🚀 Start developing
npm run dev

# 🐛 Debug while developing  
npm run dev:debug

# 🧪 Test everything
npm test

# 🎯 Quick test feedback
npm run test:quick

# 🔍 Check code style
npm run lint

# 🏗️ Build for production
npm run build

# 📦 Run production build
npm start

# 🚨 Debug production issues (CAUTION: real credentials)
npm run debug:production
```

### Development Workflow with Debugging

1. **Start Development**: `npm run dev:debug`
2. **Set Breakpoints**: In VS Code or Chrome DevTools
3. **Attach Debugger**: Use VS Code "Attach to Running Server"
4. **Make Changes**: Code auto-reloads with debugger attached
5. **Test Changes**: Use Swagger UI or run tests
6. **Debug Issues**: Step through code with full debugging capabilities

## Troubleshooting

### Service Won't Start
```bash
# Check if port 3000 is already in use
netstat -an | Select-String ":3000"  # PowerShell
netstat -an | findstr ":3000"        # Command Prompt

# If port is in use, either:
# 1. Stop the other service using port 3000
# 2. Change PORT in your .env.development file to a different port
```

### Connection Refused Errors
- Verify the service is actually running (`npm run dev`)
- Check the correct port in your `.env.development` file
- Ensure no firewall is blocking the connection
- Try `http://127.0.0.1:3000` instead of `localhost:3000`

### Missing API Credentials
- Verify your `.env.development` file exists and has proper API keys
- Check that `USE_TEST_MODE=true` for safe testing
- Ensure `.env.development` file is in the project root directory

## Environment Configuration

The project uses environment-specific configuration files for different contexts:

### Environment Files

| File | Purpose | Committed to Git | When Used |
|------|---------|------------------|-----------|
| `.env.development` | Development settings with real credentials | ❌ No | Development and debugging |
| `.env.development.example` | Template for development setup | ✅ Yes | Initial project setup |
| `.env.test` | Test-specific overrides | ✅ Yes | During `npm test` |
| `.env.production` | Production settings | ❌ No | Production deployment |
| `.env.production.debug` | Production debugging | ❌ No | Production issue debugging |
| `.env.production.example` | Production template | ✅ Yes | Production setup guide |

### Environment Loading Priority

The application loads environment files in this order (first found wins):
1. `.env.{NODE_ENV}` (e.g., `.env.development`, `.env.test`, `.env.production.debug`)
2. `.env` (legacy fallback - prefer explicit naming)

### File Purposes Explained

**`.env.development.example`** - Development template file
- Contains placeholder values and comments
- Safe to commit (no real credentials)
- Used for onboarding new developers
- Shows the expected structure and required variables

**`.env.development`** - Your actual development configuration  
- Contains your real API credentials
- Gitignored to protect sensitive information
- Created by copying from `.env.development.example`
- Used when NODE_ENV=development (default)

### Setup Instructions

**1. Basic Development Setup**
```bash
# Copy the template and add your real credentials
cp .env.development.example .env.development
# Edit .env.development with your actual API keys
npm run dev  # Uses .env.development automatically

# Option 2: Start from template (for new setups)
cp .env.example .env
# Edit .env with your actual API credentials
npm run dev
```

> 💡 **Note**: The repository includes both `.env.example` (template) and `.env` (ready-to-use). 
> The `.env` file is pre-configured for immediate development use, while `.env.example` 
> serves as the original template for reference and onboarding.

**2. Test Environment (Automatic)**
```bash
npm test     # Automatically uses .env.test with safe settings
```
- Forced `USE_TEST_MODE=true` (prevents real trades)
- Test API credentials (dummy values)
- Separate port (3001) to avoid conflicts

**3. Debug Mode**
```bash
npm run debug        # Single-run debug (no auto-restart)
npm run dev:debug    # Debug with hot reload (restarts on file changes)
```
- Both use same `.env` file with `NODE_ENV=debug` and `LOG_LEVEL=debug`
- Automatically enables verbose logging and debug features
- **Choose based on need**: single session vs. continuous development

**4. Production Debugging (Advanced)**
```bash
# CAUTION: Uses real production credentials and data
npm run debug:production  # Uses .env.production.debug
```
- Requires manual setup of `.env.production.debug` with real credentials
- Enhanced logging with production data
- USE_TEST_MODE=true by default for safety

**5. Production Setup**
```bash
# Copy the production template
cp .env.production.example .env.production
# Edit .env.production with actual production values
# IMPORTANT: Set USE_TEST_MODE=false only when ready for live trading

# For production debugging (optional):
cp .env.production.debug.example .env.production.debug  # (if template exists)
# Or manually create .env.production.debug with production credentials + debug settings
```

### Environment Variables Reference

```bash
# Application Settings
NODE_ENV=development|test|debug|production
PORT=3000
HOST=localhost|0.0.0.0
LOG_LEVEL=debug|info|warn|error

# TRADING SAFETY
USE_TEST_MODE=true|false  # CRITICAL: Controls real vs test trading

# API Credentials
MEXC_API_KEY=your-api-key
MEXC_API_SECRET=your-api-secret

# Debug-specific (only in debug environments)
DEBUG_MODE=true
VERBOSE_LOGGING=true
ENABLE_REQUEST_LOGGING=true

# Test-specific (only in .env.test)
DISABLE_NETWORK_CALLS=true
```

### Safety Features by Environment

| Environment | USE_TEST_MODE | Real Trading | Network Calls | Logging |
|-------------|---------------|--------------|---------------|---------|
| **test** | ✅ Always true | ❌ Never | ❌ Disabled | ⚠️ Minimal |
| **debug** | ✅ Default true | ❌ Only if explicitly enabled | ✅ Enabled | 📝 Verbose |
| **development** | ✅ Default true | ❌ Only if explicitly enabled | ✅ Enabled | 📝 Standard |
| **production** | ⚠️ Configurable | 🚨 If USE_TEST_MODE=false | ✅ Enabled | 📝 Minimal |

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

### Available Scripts
```bash
# Development
npm run dev       # Start development server with hot reload

# Building
npm run build     # Build TypeScript to JavaScript

# Testing
npm test          # Run tests with linting
npm run test:quick # Run tests without linting  
npm run test:ui   # Run tests with UI
npm run test:watch # Run tests in watch mode
npm run test:coverage # Run tests with coverage

# Code Quality
npm run lint      # Run ESLint
npm run lint:fix  # Fix ESLint issues automatically
npm run lint:check # Check for ESLint issues (no warnings allowed)
```

### Development Workflow
1. **Setup environment**: Copy `.env.development.example` to `.env.development` and add your API credentials
2. **Start the service**: `npm run dev`
3. **Make changes**: Edit TypeScript files in `src/`
4. **Service auto-restarts**: Thanks to `tsx watch`
5. **Test your changes**: Use Swagger UI at `http://localhost:3000/docs`
6. **Run tests**: `npm test` to ensure everything works
7. **Check code quality**: `npm run lint` before committing

### Safety Notes for Development
- ✅ Default configuration uses `USE_TEST_MODE=true` (safe)
- ✅ `NODE_ENV=development` enables additional safety checks
- ✅ `.env.development` is gitignored to protect your credentials
- ⚠️ Never commit real API credentials to version control
- 🚨 Only set `USE_TEST_MODE=false` in production with extreme caution
