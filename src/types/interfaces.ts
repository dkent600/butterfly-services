export interface IAsset {
  name: string;
  exchange: string;
  amount: number;
}

export interface ILogService {
  log(message: string): void;
  logError(err: Error | unknown): void;
  logReport(message: string): void;
}

export interface IEnvService {
  init(): Promise<void>;
  get(key: string): string | undefined;
  getNumber(key: string): number | undefined;
  getBoolean(key: string): boolean | undefined;
}

export interface IExchangeApiService {
  createMarketSellOrder(
    coinpair: string,
    quantity: number,
    exchangeName: string,
    requestOptions: {
      url: string;
      method: 'GET' | 'POST';
      body?: string;
      headers: Record<string, string>;
    }
  ): Promise<void>;

  sign(queryString: string, apiSecret: string): string;
  getAPIKey(exchange: string): string;
  getAPISecret(exchange: string): string;
}

export interface IExchangeService {
  createPair(asset: IAsset, to?: string): string;
  fetchPrice(asset: IAsset): Promise<number>;
  fetchBalance(asset: IAsset): Promise<number>;
  createMarketSellOrder(asset: IAsset, to?: string): Promise<any>;
}

export interface IExchangeTimeSyncer {
  initFromServer(serverTime: number): Promise<void>;
  getTimestampString(): string;
  now(): number;
}

// DI Tokens
export const TYPES = {
  ILogService: Symbol.for('ILogService'),
  IEnvService: Symbol.for('IEnvService'),
  IExchangeApiService: Symbol.for('IExchangeApiService'),
  IExchangeTimeSyncer: Symbol.for('IExchangeTimeSyncer'),
} as const;
