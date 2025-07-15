import { injectable } from 'tsyringe';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { IEnvService } from '../types/interfaces.js';

@injectable()
export class EnvService implements IEnvService {
  private config: Record<string, unknown> = {};

  async init(): Promise<void> {
    await this.loadConfig();
  }

  private async loadConfig(): Promise<void> {
    // First: Load from actual environment variables
    this.loadFromEnvironment();
    
    // Second: Load from local config file (if exists) - lower priority
    this.loadFromConfigFile();
  }

  private loadFromEnvironment(): void {
    // Map flat env vars to nested structure
    // MEXC_API_KEY -> api.mexc.apiKey
    // MEXC_API_SECRET -> api.mexc.apiSecret
    // KRAKEN_API_KEY -> api.kraken.apiKey
    // KRAKEN_API_SECRET -> api.kraken.apiSecret
    
    for (const [key, value] of Object.entries(process.env)) {
      if (value) {
        const configKey = this.mapEnvKeyToConfigKey(key);
        if (configKey) {
          this.setNestedValue(configKey, value);
        }
      }
    }
  }

  private loadFromConfigFile(): void {
    try {
      // Try different config file locations
      const configPaths = [
        'config.local.json',
        'config.json',
        '.env.json',
      ];

      for (const configPath of configPaths) {
        try {
          const fullPath = join(process.cwd(), configPath);
          const configContent = readFileSync(fullPath, 'utf-8');
          const fileConfig = JSON.parse(configContent) as Record<string, unknown>;
          
          // Merge file config (lower priority than env vars)
          this.config = { ...fileConfig, ...this.config };
          console.log(`✅ Loaded config from ${configPath}`);
          return;
        } catch {
          // Continue to next config file
        }
      }
    } catch {
      console.warn('No config file found, using environment variables only');
    }
  }

  private mapEnvKeyToConfigKey(envKey: string): string | null {
    // Map environment variable names to config paths
    const mappings: Record<string, string> = {
      'MEXC_API_KEY': 'api.mexc.apiKey',
      'MEXC_API_SECRET': 'api.mexc.apiSecret',
      'KRAKEN_API_KEY': 'api.kraken.apiKey',
      'KRAKEN_API_SECRET': 'api.kraken.apiSecret',
      'BINANCE_API_KEY': 'api.binance.apiKey',
      'BINANCE_API_SECRET': 'api.binance.apiSecret',
      'NODE_ENV': 'app.environment',
      'PORT': 'app.port',
      'HOST': 'app.host',
      'LOG_LEVEL': 'app.logLevel',
      'USE_TEST_MODE': 'app.useTestMode',
    };

    return mappings[envKey] || null;
  }

  private setNestedValue(path: string, value: string): void {
    const keys = path.split('.');
    let current = this.config;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
    }

    current[keys[keys.length - 1]] = value;
  }

  get(key: string): string | undefined {
    // Support dot notation for nested keys like "mexc.apiKey"
    const keys = key.split('.');
    let value: unknown = this.config;

    for (const k of keys) {
      if (value && typeof value === 'object' && value !== null && k in value) {
        value = (value as Record<string, unknown>)[k];
      } else {
        return undefined;
      }
    }

    if (typeof value === 'string') {
      return value;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    return undefined;
  }

  getNumber(key: string): number | undefined {
    const value = this.get(key);
    if (!value) return undefined;

    const parsed = parseFloat(value);
    return isNaN(parsed) ? undefined : parsed;
  }

  getBoolean(key: string): boolean | undefined {
    const value = this.get(key);
    return value ? value.toLowerCase() === 'true' : undefined;
  }
}
