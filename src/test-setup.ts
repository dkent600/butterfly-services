// Load test-specific environment configuration
import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

// Force NODE_ENV to test if not already set
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test';
}

// Load test environment file
const testEnvPath = join(process.cwd(), '.env.test');
if (existsSync(testEnvPath)) {
  config({ path: testEnvPath });
  console.log('🧪 Loaded test environment from .env.test');
}

import 'reflect-metadata';

// This file runs before all tests to set up the DI container
// Global test setup and environment configuration

// Ensure we're always in test mode during tests
process.env.USE_TEST_MODE = 'true';
process.env.NODE_ENV = 'test';
