export const AssetSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Asset symbol (e.g., BTC, ETH)' },
    exchange: { type: 'string', description: 'Exchange name (e.g., mexc)' },
    percentage: { type: 'number', minimum: 0, maximum: 100, description: 'Percentage to sell (0-100)' },
    apiUrl: { type: 'string', format: 'uri', description: 'Exchange API base URL' },
  },
  required: ['name', 'exchange', 'percentage', 'apiUrl'],
  additionalProperties: false,
} as const;

export const BalanceResponseSchema = {
  type: 'object',
  properties: {
    asset: { type: 'string' },
    exchange: { type: 'string' },
    balance: { type: 'number', minimum: 0 },
    timestamp: { type: 'string', format: 'date-time' },
  },
  required: ['asset', 'exchange', 'balance', 'timestamp'],
} as const;

export const PriceResponseSchema = {
  type: 'object',
  properties: {
    asset: { type: 'string' },
    exchange: { type: 'string' },
    price: { type: 'number', minimum: 0 },
    pair: { type: 'string' },
    timestamp: { type: 'string', format: 'date-time' },
  },
  required: ['asset', 'exchange', 'price', 'pair', 'timestamp'],
} as const;

export const MarketSellOrderRequestSchema = {
  type: 'object',
  properties: {
    asset: AssetSchema,
    to: { type: 'string', default: 'USDT', description: 'Target currency (default: USDT)' },
  },
  required: ['asset'],
  additionalProperties: false,
} as const;

export const MarketSellOrderResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    message: { type: 'string' },
    orderId: { type: 'string' },
    asset: { type: 'string' },
    exchange: { type: 'string' },
    quantity: { type: 'number' },
    timestamp: { type: 'string', format: 'date-time' },
  },
  required: ['success', 'message', 'timestamp'],
} as const;

export const ErrorResponseSchema = {
  type: 'object',
  properties: {
    error: { type: 'string' },
    message: { type: 'string' },
    statusCode: { type: 'number' },
    timestamp: { type: 'string', format: 'date-time' },
  },
  required: ['error', 'message', 'statusCode', 'timestamp'],
} as const;
