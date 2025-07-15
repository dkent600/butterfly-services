import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { container } from '../../container.js';
import { IAsset, IExchangeService } from '../../types/interfaces.js';
import { MexcApiService } from '../../services/mexc-api-service.js';
import { KrakenApiService } from '../../services/kraken-api-service.js';
import {
  BalanceResponseSchema,
  PriceResponseSchema,
  MarketSellOrderRequestSchema,
  MarketSellOrderResponseSchema,
  ErrorResponseSchema,
} from '../schemas/exchange-schemas.js';

// Exchange configuration type
interface ExchangeConfig {
  name: string;
  displayName: string;
  serviceClass: new (...args: any[]) => IExchangeService;
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
 * - POST /api/v1/{exchange}/orders/sell - Create a market sell order
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
    { name: 'mexc', displayName: 'MEXC', serviceClass: MexcApiService },
    { name: 'kraken', displayName: 'Kraken', serviceClass: KrakenApiService },
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
        querystring: {
          type: 'object',
          properties: {
            apiUrl: { type: 'string', format: 'uri', description: `${exchange.displayName} API base URL` },
            percentage: { type: 'number', minimum: 0, maximum: 100, default: 100 },
          },
          required: ['apiUrl'],
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
        const { apiUrl, percentage = 100 } = request.query as { apiUrl: string; percentage?: number };

        const assetConfig: IAsset = {
          name: asset.toUpperCase(),
          exchange: exchange.name,
          percentage,
          apiUrl,
        };

        const exchangeService = container.resolve(exchange.serviceClass);
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
            apiUrl: { type: 'string', format: 'uri', description: `${exchange.displayName} API base URL` },
            to: { type: 'string', default: 'USDT', description: 'Target currency for price quote' },
          },
          required: ['apiUrl'],
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
        const { apiUrl, to = 'USDT' } = request.query as { apiUrl: string; to?: string };

        const assetConfig: IAsset = {
          name: asset.toUpperCase(),
          exchange: exchange.name,
          percentage: 100, // Not used for price fetching
          apiUrl,
        };

        const exchangeService = container.resolve(exchange.serviceClass);
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
   * Generic function to create sell order route for an exchange
   */
  function createSellOrderRoute(exchange: ExchangeConfig) {
    fastify.post(`/${exchange.name}/orders/sell`, {
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

        const exchangeService = container.resolve(exchange.serviceClass);
        await exchangeService.createMarketSellOrder(asset, to.toUpperCase());
        const quantity = await exchangeService.getSellAmount(asset);

        return {
          success: true,
          message: 'Market sell order created successfully',
          asset: asset.name.toUpperCase(),
          exchange: exchange.name,
          quantity,
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
    createSellOrderRoute(exchange);
  }
};

export default exchangeRoutes;
