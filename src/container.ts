/**
 * Dependency Injection Container Configuration
 * 
 * This file sets up the TSyringe dependency injection container for the application.
 * It registers all services as singletons and provides initialization functions.
 * 
 * Services registered:
 * - LogService: Centralized logging functionality
 * - EnvService: Environment variable and configuration management
 * - ExchangeApiService: Core API operations (signing, authentication)
 * - ExchangeTimeSyncer: Server time synchronization for exchanges
 * - MexcApiService: MEXC exchange-specific operations
 */
import 'reflect-metadata';
import { container } from 'tsyringe';
import { TYPES } from './types/interfaces.js';
import { LogService } from './services/log-service.js';
import { EnvService } from './services/env-service.js';
import { ExchangeApiService } from './services/exchange-api-service.js';
import { MexcApiService } from './services/mexc-api-service.js';
import { ExchangeTimeSyncer } from './services/exchange-time-syncer.js';

export function configureDI(): void {
  // Register services
  container.registerSingleton(TYPES.ILogService, LogService);
  container.registerSingleton(TYPES.IEnvService, EnvService);
  container.registerSingleton(TYPES.IExchangeApiService, ExchangeApiService);
  container.registerSingleton(TYPES.IExchangeTimeSyncer, ExchangeTimeSyncer);

  // Register exchange-specific services
  container.registerSingleton('MexcApiService', MexcApiService);
}

export async function initializeServices(): Promise<void> {
  // Initialize environment service
  const envService = container.resolve<EnvService>(TYPES.IEnvService);
  await envService.init();
}

export { container };
