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
    message: { type: 'string' },
    orderId: { type: 'string' },
    asset: { type: 'string' },
    quantity: { type: 'number' },
    timestamp: { type: 'string', format: 'date-time' },
  },
  required: ['message', 'timestamp'],
} as const;

export const LimitSellOrderResponseSchema = {
  type: 'object',
  properties: {
    message: { type: 'string' },
    orderId: { type: 'string' },
    asset: { type: 'string' },
    quantity: { type: 'number' },
    price: { type: 'number' },
    timestamp: { type: 'string', format: 'date-time' },
  },
  required: ['message', 'timestamp'],
} as const;

// Open Orders Response Schema - Flat structure for consistent frontend usage
export const OpenedOrdersResponseSchema = {
  type: 'object',
  properties: {
    orders: {
      type: 'array',
      description: 'Array of normalized open orders from any exchange',
      items: {
        type: 'object',
        description: 'Normalized order details',
        properties: {
          orderId: { type: 'string', description: 'Unique order identifier (for cancellation)' },
          pair: { type: 'string', description: 'Trading pair (e.g., BTCUSDT, ETHUSDT)' },
          price: { type: 'string', description: 'Order price (limit price for limit orders, empty for market orders)' },
          amount: { type: 'string', description: 'Order amount/volume' },
          direction: { type: 'string', enum: ['buy', 'sell'], description: 'Order direction (buy or sell)' },
          type: { type: 'string', enum: ['market', 'limit'], description: 'Order type' },
        },
        required: ['orderId', 'pair', 'price', 'amount', 'direction', 'type'],
        additionalProperties: false,
      },
    },
    timestamp: { type: 'string', format: 'date-time' },
  },
  required: ['orders', 'timestamp'],
  additionalProperties: false,
} as const;

export const ClosedOrdersResponseSchema = {
  type: 'object',
  properties: {
    orders: {
      type: 'array',
      description: 'Array of normalized closed orders from any exchange',
      items: {
        type: 'object',
        description: 'Normalized closed order details',
        properties: {
          orderId: { type: 'string', description: 'Unique order identifier' },
          pair: { type: 'string', description: 'Trading pair (e.g., BTCUSDT, ETHUSDT)' },
          direction: { type: 'string', enum: ['buy', 'sell'], description: 'Order direction (buy or sell)' },
          type: { type: 'string', enum: ['market', 'limit'], description: 'Order type (market or limit)' },
          status: { type: 'string', description: 'Order status (closed, executed, canceled, etc.)' },
          amount: { type: 'string', description: 'Original order amount/volume' },
          amountExecuted: { type: 'string', description: 'Executed amount/volume' },
          price: { type: 'string', description: 'Executed price (for closed orders)' },
          limitPrice: { type: 'string', description: 'Limit price (for limit orders)' },
          cost: { type: 'string', description: 'Total cost (for executed orders)' },
        },
        required: ['orderId', 'pair', 'direction', 'type', 'status', 'amount', 'amountExecuted', 'price', 'limitPrice', 'cost'],
        additionalProperties: false,
      },
    },
    timestamp: { type: 'string', format: 'date-time' },
  },
  required: ['orders', 'timestamp'],
  additionalProperties: false,
} as const;

export const ClosedOrdersRequestSchema = {
  type: 'object',
  properties: {
    baseCoins: { 
      type: 'array',
      items: { type: 'string' },
      description: 'Array of base coins to filter orders for (e.g., ["BTC", "ETH"]). Must be same length as quoteCoins.',
    },
    quoteCoins: { 
      type: 'array',
      items: { type: 'string' },
      description: 'Array of quote coins to filter orders for (e.g., ["USD", "USDT"]). Must be same length as baseCoins.',
    },
  },
  additionalProperties: false,
  // Custom validation: if both arrays are provided, they must be the same length
  if: {
    properties: {
      baseCoins: { type: 'array', minItems: 1 },
      quoteCoins: { type: 'array', minItems: 1 },
    },
    required: ['baseCoins', 'quoteCoins'],
  },
  then: {
    properties: {
      baseCoins: { type: 'array' },
      quoteCoins: { type: 'array' },
    },
    // This will be validated in the route handler since JSON Schema can't easily compare array lengths
  },
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
