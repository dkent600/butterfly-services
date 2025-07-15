// Load environment-specific configuration
import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

// Determine which .env file to load based on NODE_ENV
const nodeEnv = process.env.NODE_ENV || 'development';
const envFiles = [
  `.env.${nodeEnv}`,  // .env.test, .env.production.debug, etc.
  '.env',             // Default fallback
];

// Load the first existing env file
for (const envFile of envFiles) {
  const envPath = join(process.cwd(), envFile);
  if (existsSync(envPath)) {
    config({ path: envPath });
    console.log(`📁 Loaded environment from: ${envFile}`);
    break;
  }
}

import 'reflect-metadata';
import { configureDI, initializeServices } from './container.js';
import { startServer } from './api/server.js';

async function main() {
  try {
    // Initialize dependency injection
    configureDI();
    console.log('✅ Dependency injection configured');

    // Initialize services (loads environment configuration)
    await initializeServices();
    console.log('✅ Services initialized');

    // Start the server
    const port = parseInt(process.env.PORT || '3000', 10);
    const host = process.env.HOST || 'localhost'; // Changed from '0.0.0.0' to 'localhost'

    const server = await startServer(port, host);

    // Graceful shutdown
    const signals = ['SIGINT', 'SIGTERM'];
    signals.forEach((signal) => {
      process.on(signal, async () => {
        console.log(`\n📡 Received ${signal}, shutting down gracefully...`);
        try {
          await server.close();
          console.log('✅ Server closed successfully');
          process.exit(0);
        } catch (err) {
          console.error('❌ Error during shutdown:', err);
          process.exit(1);
        }
      });
    });

  } catch (error) {
    console.error('❌ Failed to start application:', error);
    process.exit(1);
  }
}

// Only run if this is the main module
void main();
