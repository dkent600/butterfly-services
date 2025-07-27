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

// Unified Open Orders Response Schema - Flat structure for consistent frontend usage
export const UnifiedOpenOrdersResponseSchema = {
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

// Legacy Kraken-specific schema (keeping for backward compatibility during transition)
export const OpenOrdersResponseSchema = {
  type: 'object',
  properties: {
    orders: { 
      type: 'object',
      description: 'object whose property names are order txIds and values are order details',
      additionalProperties: {
        type: 'object',
        description: 'Order details for a specific txId',
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
      type: 'object',
      description: 'object whose property names are order txIds and values are order details',
      additionalProperties: {
        type: 'object',
        description: 'Order details for a specific txId',
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
      },
    },
    timestamp: { type: 'string', format: 'date-time' },
  },
  required: ['orders', 'timestamp'],
} as const;

// MEXC-specific schemas (arrays instead of objects)
export const MexcOpenOrdersResponseSchema = {
  type: 'object',
  properties: {
    orders: { 
      type: 'array',
      description: 'Array of open orders from MEXC exchange',
      items: {
        type: 'object',
        description: 'Order details from MEXC',
        properties: {
          symbol: { type: 'string', description: 'Trading pair symbol' },
          orderId: { type: 'number', description: 'MEXC order ID' },
          clientOrderId: { type: 'string', description: 'Client order ID' },
          price: { type: 'string', description: 'Order price' },
          origQty: { type: 'string', description: 'Original quantity' },
          executedQty: { type: 'string', description: 'Executed quantity' },
          status: { type: 'string', enum: ['NEW', 'PARTIALLY_FILLED', 'FILLED', 'CANCELED', 'REJECTED', 'EXPIRED'], description: 'Order status' },
          side: { type: 'string', enum: ['BUY', 'SELL'], description: 'Order side' },
          type: { type: 'string', enum: ['LIMIT', 'MARKET', 'STOP_LOSS', 'STOP_LOSS_LIMIT', 'TAKE_PROFIT', 'TAKE_PROFIT_LIMIT'], description: 'Order type' },
        },
        required: ['symbol', 'orderId', 'clientOrderId', 'price', 'origQty', 'executedQty', 'status', 'side', 'type'],
      },
    },
    timestamp: { type: 'string', format: 'date-time' },
  },
  required: ['orders', 'timestamp'],
} as const;

export const MexcClosedOrdersResponseSchema = {
  type: 'object',
  properties: {
    orders: { 
      type: 'array',
      description: 'Array of closed orders from MEXC exchange',
      items: {
        type: 'object',
        description: 'Closed order details from MEXC',
        properties: {
          symbol: { type: 'string', description: 'Trading pair symbol' },
          orderId: { type: 'number', description: 'MEXC order ID' },
          clientOrderId: { type: 'string', description: 'Client order ID' },
          price: { type: 'string', description: 'Order price' },
          origQty: { type: 'string', description: 'Original quantity' },
          executedQty: { type: 'string', description: 'Executed quantity' },
          status: { type: 'string', enum: ['FILLED', 'CANCELED', 'REJECTED', 'EXPIRED'], description: 'Order status' },
          side: { type: 'string', enum: ['BUY', 'SELL'], description: 'Order side' },
          type: { type: 'string', enum: ['LIMIT', 'MARKET', 'STOP_LOSS', 'STOP_LOSS_LIMIT', 'TAKE_PROFIT', 'TAKE_PROFIT_LIMIT'], description: 'Order type' },
        },
        required: ['symbol', 'orderId', 'clientOrderId', 'price', 'origQty', 'executedQty', 'status', 'side', 'type'],
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
