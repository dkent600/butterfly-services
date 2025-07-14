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

const exchangeRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {

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
