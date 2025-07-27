export interface IAsset {
  name: string;
  exchange: string;
  amount: number;
}

export interface IOpenedOrderListItem {
  orderId: string;
  pair: string;
  price: string;
  amount: string;
  direction: 'buy' | 'sell';
  type: 'market' | 'limit';
}

export interface IClosedOrderListItem {
  orderId: string;
  pair: string;
  price: string;
  amount: string;
  direction: 'buy' | 'sell';
  type: 'market' | 'limit';
  status: string;
  amountExecuted: string;
  limitPrice: string;
  cost: string;
}

export interface ILogService {
  log(message: string): void;
  logError(err: Error | string): void;
  logReport(message: string): void;
}

export interface IEnvService {
  init(): Promise<void>;
  get(key: string): string | undefined;
  getNumber(key: string): number | undefined;
  getBoolean(key: string): boolean | undefined;
}

export interface IExchangeApiService {
  sendApiRequest(
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
  createPair(asset: IAsset, to: string): string;
  fetchPrice(asset: IAsset, to: string): Promise<number>;
  fetchBalance(asset: IAsset): Promise<number>;
  createSellOrder(
    asset: IAsset, 
    options: {
      orderType: 'market' | 'limit';
      price?: number;
      to: string;
    },
  ): Promise<any>;
  getOpenedOrders(): Promise<any>;
  getClosedOrders(): Promise<any>;
  cancelOrder(txid: string): Promise<void>;
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