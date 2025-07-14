import 'dotenv/config'; // Load environment variables from .env file
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
    const host = process.env.HOST || '0.0.0.0';

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
if (import.meta.url === new URL(process.argv[1], 'file://').href) {
  void main();
}
