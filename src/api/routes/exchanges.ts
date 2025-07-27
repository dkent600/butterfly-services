// Exchange routes for butterfly-services API
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { container } from '../../container.js';
import { IAsset, IExchangeService } from '../../types/interfaces.js';
import { KrakenApiService } from '../../services/kraken-api-service.js';
import {
  BalanceResponseSchema,
  PriceResponseSchema,
  MarketSellOrderRequestSchema,
  MarketSellOrderResponseSchema,
  LimitSellOrderRequestSchema,
  LimitSellOrderResponseSchema,
  OpenOrdersResponseSchema,
  ClosedOrdersResponseSchema,
  MexcOpenOrdersResponseSchema,
  MexcClosedOrdersResponseSchema,
  ErrorResponseSchema,
} from '../schemas/exchange-schemas.js';

// Exchange configuration type
interface ExchangeConfig {
  name: string;
  displayName: string;
  serviceToken: string; // Token for DI container resolution
}

/**
 * Exchange API Routes Plugin
 * 
 * This Fastify plugin provides REST API endpoints for interacting with cryptocurrency exchanges.
 * Currently supports MEXC and Kraken exchange operations including:
 * 
 * Endpoints:
 * - GET /api/v1/{exchange}/balance/:asset - Retrieve asset balance from exchange
 * - GET /api/v1/{exchange}/price/:asset - Get current market price for an asset
 * - POST /api/v1/{exchange}/orders/sell/market - Create a market sell order
 * - POST /api/v1/{exchange}/orders/sell/limit - Create a limit sell order
 * 
 * Features:
 * - Comprehensive input validation using JSON Schema
 * - Swagger/OpenAPI documentation integration
 * - Standardized error handling and response formats
 * - Dependency injection via TSyringe container
 * - Support for configurable API URLs and trading parameters
 * 
 * Security:
 * - All trading operations use safety-first mode by default
 * - Input validation prevents malformed requests
 * - Proper error handling prevents information leakage
 * 
 * @param fastify - Fastify instance to register routes on
 * @returns Promise<void> - Resolves when all routes are registered
 */
const exchangeRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {

  // Exchange configurations
  const exchanges: ExchangeConfig[] = [
    { name: 'mexc', displayName: 'MEXC', serviceToken: 'MexcApiService' },
    { name: 'kraken', displayName: 'Kraken', serviceToken: 'KrakenApiService' },
  ];

  /**
   * Generic function to create balance route for an exchange
   */
  function createBalanceRoute(exchange: ExchangeConfig) {
    fastify.get(`/${exchange.name}/balance/:asset`, {
      schema: {
        description: `Get balance for a specific asset on ${exchange.displayName} exchange`,
        tags: ['exchanges'],
        params: {
          type: 'object',
          properties: {
            asset: { type: 'string', description: 'Asset symbol (e.g., BTC)' },
          },
          required: ['asset'],
        },

        response: {
          200: BalanceResponseSchema,
          400: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    }, async (request, reply) => {
      try {
        const { asset } = request.params as { asset: string };

        const assetConfig: IAsset = {
          name: asset.toUpperCase(),
          exchange: exchange.name,
          amount: 0, // Not used for balance fetching, only required by interface
        };

        // Use singleton service instances to prevent multiple service creation
        const exchangeService = container.resolve<IExchangeService>(exchange.serviceToken);
        const balance = await exchangeService.fetchBalance(assetConfig);

        return {
          asset: asset.toUpperCase(),
          balance,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'InternalServerError',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          statusCode: 500,
          timestamp: new Date().toISOString(),
        });
      }
    });
  }

  /**
   * Generic function to create price route for an exchange
   */
  function createPriceRoute(exchange: ExchangeConfig) {
    fastify.get(`/${exchange.name}/price/:asset`, {
      schema: {
        description: `Get current price for a specific asset on ${exchange.displayName} exchange`,
        tags: ['exchanges'],
        params: {
          type: 'object',
          properties: {
            asset: { type: 'string', description: 'Asset symbol (e.g., BTC)' },
          },
          required: ['asset'],
        },
        querystring: {
          type: 'object',
          properties: {
            to: { type: 'string', description: 'Target currency for price quote' },
          },
          required: ['to'],
        },
        response: {
          200: PriceResponseSchema,
          400: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    }, async (request, reply) => {
      try {
        const { asset } = request.params as { asset: string };
        const { to } = request.query as { to: string };

        const assetConfig: IAsset = {
          name: asset.toUpperCase(),
          exchange: exchange.name,
          amount: 0, // Not used for price fetching
        };

        // Use singleton service instances to prevent multiple service creation
        const exchangeService = container.resolve<IExchangeService>(exchange.serviceToken);
        const price = await exchangeService.fetchPrice(assetConfig, to.toUpperCase());
        const pair = exchangeService.createPair(assetConfig, to.toUpperCase());

        return {
          asset: asset.toUpperCase(),
          price,
          pair,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'InternalServerError',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          statusCode: 500,
          timestamp: new Date().toISOString(),
        });
      }
    });
  }

  /**
   * Generic function to create market sell order route for an exchange
   */
  function createMarketSellOrderRoute(exchange: ExchangeConfig) {
    fastify.post(`/${exchange.name}/orders/sell/market`, {
      schema: {
        description: `Create a market sell order on ${exchange.displayName} exchange`,
        tags: ['exchanges'],
        body: MarketSellOrderRequestSchema,
        response: {
          201: MarketSellOrderResponseSchema,
          400: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    }, async (request, reply) => {
      try {
        const { name, amount, to } = request.body as { name: string; amount: number; to: string };

        // Create the full asset object with exchange from URL path
        const fullAsset: IAsset = {
          name,
          amount,
          exchange: exchange.name,
        };

        // Use singleton service instances to prevent multiple service creation
        const exchangeService = container.resolve<IExchangeService>(exchange.serviceToken);
        await exchangeService.createSellOrder(fullAsset, { orderType: 'market', to: to.toUpperCase() });

        return reply.status(201).send({
          message: 'Market sell order created successfully',
          asset: fullAsset.name.toUpperCase(),
          quantity: fullAsset.amount, // Include the quantity in the response
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'InternalServerError',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          statusCode: 500,
          timestamp: new Date().toISOString(),
        });
      }
    });
  }

  /**
   * Generic function to create limit sell order route for an exchange
   */
  function createLimitSellOrderRoute(exchange: ExchangeConfig) {
    fastify.post(`/${exchange.name}/orders/sell/limit`, {
      schema: {
        description: `Create a limit sell order on ${exchange.displayName} exchange`,
        tags: ['exchanges'],
        body: LimitSellOrderRequestSchema,
        response: {
          201: LimitSellOrderResponseSchema,
          400: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    }, async (request, reply) => {
      try {
        const { name, amount, price, to } = request.body as { name: string; amount: number; price: number; to: string };

        // Create the full asset object with exchange from URL path
        const fullAsset: IAsset = {
          name,
          amount,
          exchange: exchange.name,
        };

        // Validate price
        if (price <= 0) {
          return reply.status(400).send({
            error: 'InvalidPrice',
            message: 'Price must be greater than 0',
            statusCode: 400,
            timestamp: new Date().toISOString(),
          });
        }

        // Use singleton service instances to prevent multiple service creation
        const exchangeService = container.resolve<IExchangeService>(exchange.serviceToken);
        await exchangeService.createSellOrder(fullAsset, { orderType: 'limit', price, to: to.toUpperCase() });

        return reply.status(201).send({
          message: 'Limit sell order created successfully',
          asset: fullAsset.name.toUpperCase(),
          quantity: fullAsset.amount,
          price,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'InternalServerError',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          statusCode: 500,
          timestamp: new Date().toISOString(),
        });
      }
    });
  }

  /**
   * Creates open orders route for Kraken exchange only
   * This is Kraken-specific as different exchanges have different order management APIs
   */
  function createOpenOrdersRoute(exchange: ExchangeConfig) {
    // Only create this route for Kraken
    if (exchange.name !== 'kraken') {
      return;
    }

    fastify.get(`/${exchange.name}/orders/opened`, {
      schema: {
        description: `Get open orders from ${exchange.displayName} exchange`,
        tags: ['exchanges'],
        response: {
          200: OpenOrdersResponseSchema,
          400: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    }, async (request, reply) => {
      try {
        // Use the concrete KrakenApiService type for order-specific methods
        const krakenService = container.resolve<KrakenApiService>('KrakenApiService');
        const result = await krakenService.getOpenOrders();

        // Convert Kraken's object-based orders
        const ordersObject = result.orders.open;

        return {
          orders: ordersObject,
          timestamp: result.timestamp,
        };
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'InternalServerError',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          statusCode: 500,
          timestamp: new Date().toISOString(),
        });
      }
    });
  }

  /**
   * Creates closed orders route for Kraken exchange only
   * This is Kraken-specific as different exchanges have different order management APIs
   */
  function createClosedOrdersRoute(exchange: ExchangeConfig) {
    // Only create this route for Kraken
    if (exchange.name !== 'kraken') {
      return;
    }

    fastify.get(`/${exchange.name}/orders/closed`, {
      schema: {
        description: `Get closed orders from ${exchange.displayName} exchange`,
        tags: ['exchanges'],
        response: {
          200: ClosedOrdersResponseSchema,
          400: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    }, async (request, reply) => {
      try {
        // Use the concrete KrakenApiService type for order-specific methods
        const krakenService = container.resolve<KrakenApiService>('KrakenApiService');
        const result = await krakenService.getClosedOrders();

        // Convert Kraken's object-based orders
        const ordersObject = result.orders.closed ?? [];

        return {
          orders: ordersObject,
          timestamp: result.timestamp,
        };
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'InternalServerError',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          statusCode: 500,
          timestamp: new Date().toISOString(),
        });
      }
    });
  }

  /**
   * Creates cancel order route for Kraken exchange only
   * This is Kraken-specific as different exchanges have different order management APIs
   */
  function createCancelOrderRoute(exchange: ExchangeConfig) {
    // Only create this route for Kraken
    if (exchange.name !== 'kraken') {
      return;
    }

    fastify.delete(`/${exchange.name}/orders/cancel/:orderId`, {
      schema: {
        description: `Cancel an order on ${exchange.displayName} exchange by order identifier`,
        tags: ['exchanges'],
        params: {
          type: 'object',
          properties: {
            orderId: { 
              type: 'string',
              description: 'Order identifier to cancel (txid for Kraken)',
            },
          },
          required: ['orderId'],
        },
        response: {
          204: {
            type: 'null',
            description: 'Order cancelled successfully (no content)',
          },
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    }, async (request, reply) => {
      try {
        const { orderId } = request.params as { orderId: string };

        console.log(`[ROUTE DEBUG] Cancel order route called with orderId: ${orderId}`);

        // Use the concrete KrakenApiService type for order-specific methods
        const krakenService = container.resolve<KrakenApiService>('KrakenApiService');
        
        console.log(`[ROUTE DEBUG] About to call krakenService.cancelOrder(${orderId})`);
        await krakenService.cancelOrder(orderId);
        console.log('[ROUTE DEBUG] cancelOrder completed successfully');

        // Return 204 No Content for successful cancellation
        return reply.status(204).send();
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'InternalServerError',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          statusCode: 500,
          timestamp: new Date().toISOString(),
        });
      }
    });
  }

  /**
   * Creates MEXC-specific open orders route
   * MEXC returns arrays directly, different from Kraken's object structure
   */
  function createMexcOpenOrdersRoute(exchange: ExchangeConfig) {
    fastify.get(`/${exchange.name}/orders/opened`, {
      schema: {
        description: `Get open orders from ${exchange.displayName} exchange`,
        tags: ['exchanges'],
        response: {
          200: MexcOpenOrdersResponseSchema,
          400: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    }, async (request, reply) => {
      try {
        const exchangeService = container.resolve<IExchangeService>(exchange.serviceToken);
        const result = await exchangeService.getOpenOrders();

        // MEXC returns arrays directly
        return {
          orders: result.orders,
          timestamp: result.timestamp,
        };
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'InternalServerError',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          statusCode: 500,
          timestamp: new Date().toISOString(),
        });
      }
    });
  }

  /**
   * Creates MEXC-specific closed orders route
   * MEXC returns arrays directly, different from Kraken's object structure
   */
  function createMexcClosedOrdersRoute(exchange: ExchangeConfig) {
    fastify.get(`/${exchange.name}/orders/closed`, {
      schema: {
        description: `Get closed orders from ${exchange.displayName} exchange`,
        tags: ['exchanges'],
        response: {
          200: MexcClosedOrdersResponseSchema,
          400: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    }, async (request, reply) => {
      try {
        const exchangeService = container.resolve<IExchangeService>(exchange.serviceToken);
        const result = await exchangeService.getClosedOrders();

        // MEXC returns arrays directly
        return {
          orders: result.orders,
          timestamp: result.timestamp,
        };
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'InternalServerError',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          statusCode: 500,
          timestamp: new Date().toISOString(),
        });
      }
    });
  }

  /**
   * Creates MEXC-specific cancel order route
   * MEXC uses orderId instead of txid and has different response format
   */
  function createMexcCancelOrderRoute(exchange: ExchangeConfig) {
    fastify.delete(`/${exchange.name}/orders/cancel/:orderId`, {
      schema: {
        description: `Cancel an order on ${exchange.displayName} exchange by order identifier`,
        tags: ['exchanges'],
        params: {
          type: 'object',
          properties: {
            orderId: { 
              type: 'string', 
              description: 'Order identifier to cancel (order ID for MEXC)',
            },
          },
          required: ['orderId'],
        },
        response: {
          204: { 
            type: 'null', 
            description: 'Order cancelled successfully (no content)', 
          },
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    }, async (request, reply) => {
      try {
        const { orderId } = request.params as { orderId: string };

        const exchangeService = container.resolve<IExchangeService>(exchange.serviceToken);
        await exchangeService.cancelOrder(orderId);

        // Return 204 No Content for successful cancellation
        return reply.status(204).send();
      } catch (error) {
        // Handle validation errors with 400 status
        if (error instanceof Error && error.message.includes('Order ID is required')) {
          return reply.status(400).send({
            error: 'BadRequest',
            message: error.message,
            statusCode: 400,
            timestamp: new Date().toISOString(),
          });
        }

        fastify.log.error(error);
        return reply.status(500).send({
          error: 'InternalServerError',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          statusCode: 500,
          timestamp: new Date().toISOString(),
        });
      }
    });
  }

  // Register all routes for all exchanges
  for (const exchange of exchanges) {
    createBalanceRoute(exchange);
    createPriceRoute(exchange);
    createMarketSellOrderRoute(exchange);
    createLimitSellOrderRoute(exchange);
    
    // Use exchange-specific route functions
    if (exchange.name === 'kraken') {
      createOpenOrdersRoute(exchange);
      createClosedOrdersRoute(exchange);
      createCancelOrderRoute(exchange);
    } else if (exchange.name === 'mexc') {
      createMexcOpenOrdersRoute(exchange);
      createMexcClosedOrdersRoute(exchange);
      createMexcCancelOrderRoute(exchange);
    }
  }
};

export default exchangeRoutes;
