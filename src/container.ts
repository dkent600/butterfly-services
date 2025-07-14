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

export { container };
