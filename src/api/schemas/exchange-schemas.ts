/**
 * All API responses should contain "timestamp".
 * No responses should contain "exchange"
 * No responses should contain "count" when they are returning arrays.
 * All API requests should be flattened, no nested objects.
 **/
export const BalanceResponseSchema = {
  type: 'object',
  properties: {
    asset: { type: 'string' },
    balance: { type: 'number', minimum: 0 },
    timestamp: { type: 'string', format: 'date-time' },
  },
  required: ['asset', 'balance', 'timestamp'],
} as const;

export const PriceResponseSchema = {
  type: 'object',
  properties: {
    asset: { type: 'string' },
    price: { type: 'number', minimum: 0 },
    pair: { type: 'string' },
    timestamp: { type: 'string', format: 'date-time' },
  },
  required: ['asset', 'price', 'pair', 'timestamp'],
} as const;

export const MarketSellOrderRequestSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Asset symbol (e.g., BTC, ETH)' },
    amount: { type: 'number', minimum: 0, description: 'Amount to sell (> 0)' },
    to: { type: 'string', description: 'Target currency' },
    timestamp: { type: 'string', format: 'date-time' },
  },
  required: ['name', 'amount', 'to'],
  additionalProperties: false,
} as const;

export const LimitSellOrderRequestSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Asset symbol (e.g., BTC, ETH)' },
    amount: { type: 'number', minimum: 0, description: 'Amount to sell (> 0)' },
    price: { type: 'number', minimum: 0, description: 'Limit price for the order' },
    to: { type: 'string', description: 'Target currency' },
    timestamp: { type: 'string', format: 'date-time' },
  },
  required: ['name', 'amount', 'price', 'to'],
  additionalProperties: false,
} as const;

export const MarketSellOrderResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    message: { type: 'string' },
    orderId: { type: 'string' },
    asset: { type: 'string' },
    quantity: { type: 'number' },
    timestamp: { type: 'string', format: 'date-time' },
  },
  required: ['success', 'message', 'timestamp'],
} as const;

export const LimitSellOrderResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    message: { type: 'string' },
    orderId: { type: 'string' },
    asset: { type: 'string' },
    quantity: { type: 'number' },
    price: { type: 'number' },
    timestamp: { type: 'string', format: 'date-time' },
  },
  required: ['success', 'message', 'timestamp'],
} as const;

export const OpenOrdersResponseSchema = {
  type: 'object',
  properties: {
    orders: { 
      type: 'object',
      description: 'Open orders keyed by order ID',
      additionalProperties: true,
    },
    timestamp: { type: 'string', format: 'date-time' },
  },
  required: ['orders', 'timestamp'],
} as const;

export const ClosedOrdersResponseSchema = {
  type: 'object',
  properties: {
    orders: { 
      type: 'object',
      description: 'Closed orders keyed by order ID',
      additionalProperties: true,
    },
    timestamp: { type: 'string', format: 'date-time' },
  },
  required: ['orders', 'timestamp'],
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
