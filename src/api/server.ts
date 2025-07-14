import Fastify, { FastifyInstance } from 'fastify';

export async function createServer(): Promise<FastifyInstance> {
  const server = Fastify({
    logger: {
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
        },
      },
    },
  });

  // Register CORS plugin
  await server.register(import('@fastify/cors'), {
    origin: true, // Allow all origins for development
    credentials: true,
  });

  // Register security headers
  await server.register(import('@fastify/helmet'), {
    contentSecurityPolicy: false, // Disable CSP for API
  });

  // Register Swagger documentation
  await server.register(import('@fastify/swagger'), {
    swagger: {
      info: {
        title: 'Butterfly Services API',
        description: 'Cryptocurrency exchange services API',
        version: '1.0.0',
      },
      host: 'localhost:3000',
      schemes: ['http', 'https'],
      consumes: ['application/json'],
      produces: ['application/json'],
      tags: [
        { name: 'health', description: 'Health check endpoints' },
        { name: 'exchanges', description: 'Exchange operations' },
      ],
    },
  });

  // Register Swagger UI
  await server.register(import('@fastify/swagger-ui'), {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
  });

  // Custom error handler to ensure timestamp is included
  server.setErrorHandler((error, request, reply) => {
    const statusCode = error.statusCode || 500;

    const errorResponse = {
      error: error.name || 'Error',
      message: error.message,
      statusCode,
      timestamp: new Date().toISOString(),
    };

    reply.status(statusCode).send(errorResponse);
  });

  // Health check endpoint
  server.get('/health', {
    schema: {
      description: 'Health check endpoint',
      tags: ['health'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
            uptime: { type: 'number' },
          },
        },
      },
    },
  }, async (_request, _reply) => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });

  // Register API routes
  await server.register(import('./routes/exchanges.js'), { prefix: '/api/v1' });

  return server;
}

export async function startServer(port: number = 3000, host: string = '0.0.0.0'): Promise<FastifyInstance> {
  const server = await createServer();

  try {
    await server.listen({ port, host });
    console.log(`🚀 Server running at http://${host}:${port}`);
    console.log(`📚 API Documentation available at http://${host}:${port}/docs`);
    return server;
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}
