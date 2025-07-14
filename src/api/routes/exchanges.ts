import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { container } from '../../container.js';
import { IAsset } from '../../types/interfaces.js';
import { MexcApiService } from '../../services/mexc-api-service.js';
import {
  BalanceResponseSchema,
  PriceResponseSchema,
  MarketSellOrderRequestSchema,
  MarketSellOrderResponseSchema,
  ErrorResponseSchema,
} from '../schemas/exchange-schemas.js';

/**
 * Exchange API Routes Plugin
 * 
 * This Fastify plugin provides REST API endpoints for interacting with cryptocurrency exchanges.
 * Currently supports MEXC exchange operations including:
 * 
 * Endpoints:
 * - GET /api/v1/mexc/balance/:asset - Retrieve asset balance from MEXC exchange
 * - GET /api/v1/mexc/price/:asset - Get current market price for an asset
 * - POST /api/v1/mexc/orders/sell - Create a market sell order
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

  /**
   * GET /api/v1/mexc/balance/:asset
   * 
   * Retrieves the current balance for a specific cryptocurrency asset from the MEXC exchange.
   * Supports percentage-based balance calculation for partial position management.
   * 
   * @param asset - The cryptocurrency symbol (e.g., BTC, ETH, DOGE)
   * @param apiUrl - MEXC API base URL for the request
   * @param percentage - Optional percentage of total balance to consider (0-100, default: 100)
   * @returns Balance information with timestamp and exchange metadata
   */
  // GET /api/v1/mexc/balance/:asset
  fastify.get('/mexc/balance/:asset', {
    schema: {
      description: 'Get balance for a specific asset on MEXC exchange',
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
          apiUrl: { type: 'string', format: 'uri', description: 'MEXC API base URL' },
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
        exchange: 'mexc',
        percentage,
        apiUrl,
      };

      const mexcService = container.resolve(MexcApiService);
      const balance = await mexcService.fetchBalance(assetConfig);

      return {
        asset: asset.toUpperCase(),
        exchange: 'mexc',
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

  /**
   * GET /api/v1/mexc/price/:asset
   * 
   * Fetches the current market price for a specified cryptocurrency asset on MEXC exchange.
   * Supports configurable quote currency (default: USDT) for price conversion.
   * 
   * @param asset - The cryptocurrency symbol to get price for
   * @param apiUrl - MEXC API base URL for the request
   * @param to - Quote currency for price conversion (default: USDT)
   * @returns Current price information with trading pair and timestamp
   */
  // GET /api/v1/mexc/price/:asset
  fastify.get('/mexc/price/:asset', {
    schema: {
      description: 'Get current price for a specific asset on MEXC exchange',
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
          apiUrl: { type: 'string', format: 'uri', description: 'MEXC API base URL' },
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
        exchange: 'mexc',
        percentage: 100, // Not used for price fetching
        apiUrl,
      };

      const mexcService = container.resolve(MexcApiService);
      const price = await mexcService.fetchPrice(assetConfig);
      const pair = mexcService.createPair(assetConfig, to.toUpperCase());

      return {
        asset: asset.toUpperCase(),
        exchange: 'mexc',
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

  /**
   * POST /api/v1/mexc/orders/sell
   * 
   * Creates a market sell order for a cryptocurrency asset on MEXC exchange.
   * This endpoint handles immediate market orders at current market prices.
   * 
   * SAFETY FEATURES:
   * - Validates exchange type to ensure MEXC compatibility
   * - Uses safety-first trading mode by default (configured in MexcApiService)
   * - Comprehensive error handling for order failures
   * 
   * @param asset - IAsset object containing asset configuration and exchange info
   * @param to - Target currency for the sell order (default: USDT)
   * @returns Order confirmation with quantity and execution details
   */
  // POST /api/v1/mexc/orders/sell
  fastify.post('/mexc/orders/sell', {
    schema: {
      description: 'Create a market sell order on MEXC exchange',
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

      // Ensure it's MEXC exchange
      if (asset.exchange.toLowerCase() !== 'mexc') {
        return reply.status(400).send({
          error: 'InvalidExchange',
          message: `Asset exchange must be 'mexc', got '${asset.exchange}'`,
          statusCode: 400,
          timestamp: new Date().toISOString(),
        });
      }

      const mexcService = container.resolve(MexcApiService);
      await mexcService.createMarketSellOrder(asset, to.toUpperCase());
      const quantity = await mexcService.getSellAmount(asset);

      return {
        success: true,
        message: 'Market sell order created successfully',
        asset: asset.name.toUpperCase(),
        exchange: 'mexc',
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
};

export default exchangeRoutes;
