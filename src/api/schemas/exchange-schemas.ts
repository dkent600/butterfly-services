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
      type: 'array',
      description: 'Array of open orders',
      items: {
        type: 'object',
        properties: {
          refid: { type: ['string', 'null'], description: 'Referral order transaction ID that created this order' },
          userref: { type: 'number', description: 'User reference ID' },
          status: { type: 'string', enum: ['pending', 'open', 'closed', 'canceled', 'expired'], description: 'Status of order' },
          opentm: { type: 'number', description: 'Unix timestamp of when order was placed' },
          starttm: { type: 'number', description: 'Unix timestamp of order start time (or 0 if not set)' },
          expiretm: { type: 'number', description: 'Unix timestamp of order expiration time (or 0 if not set)' },
          descr: {
            type: 'object',
            description: 'Order description info',
            properties: {
              pair: { type: 'string', description: 'Asset pair' },
              type: { type: 'string', enum: ['buy', 'sell'], description: 'Type of order (buy/sell)' },
              ordertype: { type: 'string', enum: ['market', 'limit', 'stop-loss', 'take-profit', 'stop-loss-limit', 'take-profit-limit', 'settle-position'], description: 'Order type' },
              price: { type: 'string', description: 'Primary price' },
              price2: { type: 'string', description: 'Secondary price' },
              leverage: { type: 'string', description: 'Amount of leverage' },
              order: { type: 'string', description: 'Order description' },
              close: { type: 'string', description: 'Conditional close order description (if conditional close set)' },
            },
            required: ['pair', 'type', 'ordertype', 'price', 'price2', 'leverage', 'order', 'close'],
          },
          vol: { type: 'string', description: 'Volume of order (base currency unless viqc set in oflags)' },
          vol_exec: { type: 'string', description: 'Volume executed (base currency unless viqc set in oflags)' },
          cost: { type: 'string', description: 'Total cost (quote currency unless unless viqc set in oflags)' },
          fee: { type: 'string', description: 'Total fee (quote currency)' },
          price: { type: 'string', description: 'Average price (quote currency unless viqc set in oflags)' },
          stopprice: { type: 'string', description: 'Stop price (quote currency, for trailing stops)' },
          limitprice: { type: 'string', description: 'Triggered limit price (quote currency, when limit based order type triggered)' },
          misc: { type: 'string', description: 'Miscellaneous info' },
          oflags: { type: 'string', description: 'Order flags' },
        },
        required: ['refid', 'userref', 'status', 'opentm', 'starttm', 'expiretm', 'descr', 'vol', 'vol_exec', 'cost', 'fee', 'price', 'stopprice', 'limitprice', 'misc', 'oflags'],
      },
    },
    timestamp: { type: 'string', format: 'date-time' },
  },
  required: ['orders', 'timestamp'],
} as const;

export const ClosedOrdersResponseSchema = {
  type: 'object',
  properties: {
    orders: { 
      type: 'array',
      description: 'Array of closed orders',
      items: {
        type: 'object',
        properties: {
          refid: { type: ['string', 'null'], description: 'Referral order transaction ID that created this order' },
          userref: { type: 'number', description: 'User reference ID' },
          status: { type: 'string', enum: ['closed', 'canceled', 'expired'], description: 'Status of order' },
          reason: { type: 'string', description: 'Additional info on status (if any)' },
          opentm: { type: 'number', description: 'Unix timestamp of when order was placed' },
          closetm: { type: 'number', description: 'Unix timestamp of when order was closed' },
          starttm: { type: 'number', description: 'Unix timestamp of order start time (or 0 if not set)' },
          expiretm: { type: 'number', description: 'Unix timestamp of order expiration time (or 0 if not set)' },
          descr: {
            type: 'object',
            description: 'Order description info',
            properties: {
              pair: { type: 'string', description: 'Asset pair' },
              type: { type: 'string', enum: ['buy', 'sell'], description: 'Type of order (buy/sell)' },
              ordertype: { type: 'string', enum: ['market', 'limit', 'stop-loss', 'take-profit', 'stop-loss-limit', 'take-profit-limit', 'settle-position'], description: 'Order type' },
              price: { type: 'string', description: 'Primary price' },
              price2: { type: 'string', description: 'Secondary price' },
              leverage: { type: 'string', description: 'Amount of leverage' },
              order: { type: 'string', description: 'Order description' },
              close: { type: 'string', description: 'Conditional close order description (if conditional close set)' },
            },
            required: ['pair', 'type', 'ordertype', 'price', 'price2', 'leverage', 'order', 'close'],
          },
          vol: { type: 'string', description: 'Volume of order (base currency unless viqc set in oflags)' },
          vol_exec: { type: 'string', description: 'Volume executed (base currency unless viqc set in oflags)' },
          cost: { type: 'string', description: 'Total cost (quote currency unless unless viqc set in oflags)' },
          fee: { type: 'string', description: 'Total fee (quote currency)' },
          price: { type: 'string', description: 'Average price (quote currency unless viqc set in oflags)' },
          stopprice: { type: 'string', description: 'Stop price (quote currency, for trailing stops)' },
          limitprice: { type: 'string', description: 'Triggered limit price (quote currency, when limit based order type triggered)' },
          misc: { type: 'string', description: 'Miscellaneous info' },
          oflags: { type: 'string', description: 'Order flags' },
        },
        required: ['refid', 'userref', 'status', 'opentm', 'starttm', 'expiretm', 'descr', 'vol', 'vol_exec', 'cost', 'fee', 'price', 'stopprice', 'limitprice', 'misc', 'oflags'],
      },
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
