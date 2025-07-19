// Exchange routes for butterfly-services API
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { container } from '../../container.js';
import { IAsset, IExchangeService } from '../../types/interfaces.js';
import {
  BalanceResponseSchema,
  PriceResponseSchema,
  MarketSellOrderRequestSchema,
  MarketSellOrderResponseSchema,
  LimitSellOrderRequestSchema,
  LimitSellOrderResponseSchema,
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
          exchange: exchange.name,
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
            to: { type: 'string', default: 'USDT', description: 'Target currency for price quote' },
          },
          required: [],
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
        const { to = 'USDT' } = request.query as { to?: string };

        const assetConfig: IAsset = {
          name: asset.toUpperCase(),
          exchange: exchange.name,
          amount: 0, // Not used for price fetching
        };

        // Use singleton service instances to prevent multiple service creation
        const exchangeService = container.resolve<IExchangeService>(exchange.serviceToken);
        const price = await exchangeService.fetchPrice(assetConfig);
        const pair = exchangeService.createPair(assetConfig, to.toUpperCase());

        return {
          asset: asset.toUpperCase(),
          exchange: exchange.name,
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
          200: MarketSellOrderResponseSchema,
          400: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    }, async (request, reply) => {
      try {
        const { asset, to = 'USDT' } = request.body as { asset: IAsset; to?: string };

        // Ensure it's the correct exchange
        if (asset.exchange.toLowerCase() !== exchange.name) {
          return reply.status(400).send({
            error: 'InvalidExchange',
            message: `Asset exchange must be '${exchange.name}', got '${asset.exchange}'`,
            statusCode: 400,
            timestamp: new Date().toISOString(),
          });
        }

        // Use singleton service instances to prevent multiple service creation
        const exchangeService = container.resolve<IExchangeService>(exchange.serviceToken);
        await exchangeService.createSellOrder(asset, { orderType: 'market', to: to.toUpperCase() });

        return {
          success: true,
          message: 'Market sell order created successfully',
          asset: asset.name.toUpperCase(),
          exchange: exchange.name,
          quantity: asset.amount, // Include the quantity in the response
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
   * Generic function to create limit sell order route for an exchange
   */
  function createLimitSellOrderRoute(exchange: ExchangeConfig) {
    fastify.post(`/${exchange.name}/orders/sell/limit`, {
      schema: {
        description: `Create a limit sell order on ${exchange.displayName} exchange`,
        tags: ['exchanges'],
        body: LimitSellOrderRequestSchema,
        response: {
          200: LimitSellOrderResponseSchema,
          400: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    }, async (request, reply) => {
      try {
        const { asset, price, to = 'USDT' } = request.body as { asset: IAsset; price: number; to?: string };

        // Ensure it's the correct exchange
        if (asset.exchange.toLowerCase() !== exchange.name) {
          return reply.status(400).send({
            error: 'InvalidExchange',
            message: `Asset exchange must be '${exchange.name}', got '${asset.exchange}'`,
            statusCode: 400,
            timestamp: new Date().toISOString(),
          });
        }

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
        await exchangeService.createSellOrder(asset, { orderType: 'limit', price, to: to.toUpperCase() });

        return {
          success: true,
          message: 'Limit sell order created successfully',
          asset: asset.name.toUpperCase(),
          exchange: exchange.name,
          quantity: asset.amount,
          price,
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

  // Register all routes for all exchanges
  for (const exchange of exchanges) {
    createBalanceRoute(exchange);
    createPriceRoute(exchange);
    createMarketSellOrderRoute(exchange);
    createLimitSellOrderRoute(exchange);
  }
};

export default exchangeRoutes;
