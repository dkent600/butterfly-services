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
  const corsOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
    : true; // Allow all origins in development
    
  await server.register(import('@fastify/cors'), {
    origin: corsOrigins,
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

  // Root welcome route
  server.get('/', {
    schema: {
      description: 'Welcome message and API information',
      tags: ['health'],
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            documentation: { type: 'string' },
            health: { type: 'string' },
            version: { type: 'string' },
          },
        },
      },
    },
  }, async (_request, _reply) => {
    return {
      message: 'Welcome to Butterfly Services API! 🦋',
      documentation: '/docs',
      health: '/health',
      version: '1.0.0',
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
    
    // Show user-friendly URLs instead of 0.0.0.0
    const displayHost = host === '0.0.0.0' ? 'localhost' : host;
    console.log(`🚀 Server running at http://${displayHost}:${port}`);
    console.log(`📚 API Documentation available at http://${displayHost}:${port}/docs`);
    
    return server;
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}
