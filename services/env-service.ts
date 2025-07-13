export interface IEnvService {
  init(): Promise<void>;
  get(key: string): string | undefined;
  getNumber(key: string): number | undefined;
  getBoolean(key: string): boolean | undefined;
}

export class EnvService implements IEnvService {
  private config: Record<string, unknown> = {};

  async init(): Promise<void> {
    await this.loadConfig();
  }

  private async loadConfig(): Promise<void> {
    try {
      // Try to load local config first
      const response = await fetch('/config.local.json');
      if (response.ok) {
        this.config = await response.json() as Record<string, unknown>;
        return;
      }
    } catch {
      console.warn('Local config not found, falling back to public config');
    }
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