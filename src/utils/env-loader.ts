/**
 * Environment Loader Utility
 * 
 * Shared utility for loading environment-specific configuration files
 * across the application and integration test scripts.
 */

import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Load environment variables from .env files based on NODE_ENV
 * This provides consistent environment loading across the entire application
 * @returns The name of the loaded environment file, or null if none found
 */
export function loadEnvironment(): string | null {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const envFiles = [
    `.env.${nodeEnv}`,  // .env.development, .env.test, .env.production, etc.
    '.env',             // Legacy fallback
  ];

  // Load the first existing env file
  for (const envFile of envFiles) {
    const envPath = join(process.cwd(), envFile);
    if (existsSync(envPath)) {
      config({ path: envPath });
      console.log(`📁 Loaded environment from: ${envFile}`);
      return envFile;
    }
  }

  console.log('⚠️  No environment file found, using system environment variables');
  return null;
}
