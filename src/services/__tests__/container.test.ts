import { describe, it, expect, beforeEach } from 'vitest';
import { container } from 'tsyringe';
import { configureDI } from '../../container.js';
import { TYPES, ILogService, IEnvService, IExchangeApiService } from '../../types/interfaces.js';

describe('Dependency Injection Container', () => {
  beforeEach(() => {
    container.clearInstances();
    configureDI();
  });

  it('should resolve LogService', () => {
    const logService = container.resolve<ILogService>(TYPES.ILogService);
    expect(logService).toBeDefined();
    expect(typeof logService.info).toBe('function');
    expect(typeof logService.error).toBe('function');
    expect(typeof logService.report).toBe('function');
    expect(typeof logService.warn).toBe('function');
    expect(typeof logService.trace).toBe('function');
  });

  it('should resolve EnvService', () => {
    const envService = container.resolve<IEnvService>(TYPES.IEnvService);
    expect(envService).toBeDefined();
    expect(typeof envService.get).toBe('function');
    expect(typeof envService.getNumber).toBe('function');
    expect(typeof envService.getBoolean).toBe('function');
    expect(typeof envService.isProduction).toBe('function');
  });

  it('should resolve ExchangeApiService with dependencies', () => {
    const exchangeApiService = container.resolve<IExchangeApiService>(TYPES.IExchangeApiService);
    expect(exchangeApiService).toBeDefined();
    expect(typeof exchangeApiService.sign).toBe('function');
    expect(typeof exchangeApiService.getAPIKey).toBe('function');
    expect(typeof exchangeApiService.getAPISecret).toBe('function');
    expect(typeof exchangeApiService.sendApiRequest).toBe('function');
  });

  it('should provide singleton instances', () => {
    const logService1 = container.resolve<ILogService>(TYPES.ILogService);
    const logService2 = container.resolve<ILogService>(TYPES.ILogService);
    expect(logService1).toBe(logService2);
  });
});
