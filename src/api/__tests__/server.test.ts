import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createServer } from '../server.js';

describe('API Server', () => {
  let server: FastifyInstance;

  beforeEach(async () => {
    server = await createServer();
  });

  afterEach(async () => {
    await server.close();
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('ok');
      expect(body.timestamp).toBeDefined();
      expect(body.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Swagger Documentation', () => {
    it('should serve swagger documentation', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/docs',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/html');
    });

    it('should serve swagger JSON', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/docs/json',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.info.title).toBe('Butterfly Services API');
    });
  });

  describe('Production Mode Check', () => {
    it('should return production mode status with development environment', async () => {
      // Ensure NODE_ENV is not set to production for this test
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/production-mode',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.isProduction).toBe(false);
      expect(body.environment).toBe('development');
      expect(body.timestamp).toBeDefined();
      expect(new Date(body.timestamp)).toBeInstanceOf(Date);

      // Restore original environment
      process.env.NODE_ENV = originalEnv;
    });

    it('should return production mode status with production environment', async () => {
      // Set NODE_ENV to production for this test
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/production-mode',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.isProduction).toBe(true);
      expect(body.environment).toBe('production');
      expect(body.timestamp).toBeDefined();

      // Restore original environment
      process.env.NODE_ENV = originalEnv;
    });

    it('should handle missing NODE_ENV by defaulting to development', async () => {
      // Remove NODE_ENV for this test
      const originalEnv = process.env.NODE_ENV;
      delete process.env.NODE_ENV;

      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/production-mode',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.isProduction).toBe(false);
      expect(body.environment).toBe('development');

      // Restore original environment
      process.env.NODE_ENV = originalEnv;
    });
  });
});
