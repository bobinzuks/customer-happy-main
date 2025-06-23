import Fastify, { FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyWebsocket from '@fastify/websocket';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import path from 'path';
import { interviewRoutes } from './api/interview';
import { dashboardRoutes } from './api/dashboard';
import { authRoutes } from './api/auth';
import { prisma } from './config/database';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const HOST = process.env.HOST || '0.0.0.0';

async function buildServer(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport: process.env.NODE_ENV === 'development' ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      } : undefined,
    },
    bodyLimit: 10 * 1024 * 1024, // 10MB
  });

  // Security headers
  await fastify.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "ws:", "wss:"],
        fontSrc: ["'self'", "https:"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false
  });

  // CORS
  await fastify.register(fastifyCors, {
    origin: (origin, cb) => {
      const allowedOrigins = [
        'https://gsurveyai.pages.dev',
        'https://gsurveyai.com',
        'https://www.gsurveyai.com',
        'http://localhost:3000',
        'http://localhost:8788'
      ];
      // Also allow FRONTEND_URL if set
      if (process.env.FRONTEND_URL) {
        allowedOrigins.push(process.env.FRONTEND_URL);
      }
      // Allow requests with no origin (like Postman)
      if (!origin || allowedOrigins.includes(origin)) {
        cb(null, true);
      } else {
        cb(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  });

  // WebSocket support
  await fastify.register(fastifyWebsocket);

  // Static files
  await fastify.register(fastifyStatic, {
    root: path.join(__dirname, '..', 'public'),
    prefix: '/',
  });

  // Rate limiting
  await fastify.register(import('@fastify/rate-limit'), {
    max: 100,
    timeWindow: '1 minute',
    errorResponseBuilder: function (request, context) {
      return {
        code: 429,
        error: 'Too Many Requests',
        message: `Rate limit exceeded, retry in ${Math.round(context.ttl / 1000)} seconds.`,
        date: Date.now(),
        expiresIn: Math.round(context.ttl / 1000),
      };
    },
  });

  // Health check
  fastify.get('/health', async (request, reply) => {
    try {
      // Check database connection
      await prisma.$queryRaw`SELECT 1`;
      
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.env.npm_package_version || '1.0.0',
      };
    } catch (error) {
      reply.code(503);
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // API routes
  await fastify.register(authRoutes);
  await fastify.register(interviewRoutes);
  await fastify.register(dashboardRoutes);

  // WebSocket for real-time dashboard updates
  fastify.register(async function (fastify) {
    fastify.get('/ws/dashboard', { websocket: true }, (connection, req) => {
      const dashboardConnections = fastify.dashboardConnections || new Set();
      
      dashboardConnections.add(connection);
      fastify.dashboardConnections = dashboardConnections;
      
      connection.socket.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          
          if (data.type === 'subscribe') {
            connection.businessId = data.businessId;
            connection.socket.send(JSON.stringify({
              type: 'subscribed',
              businessId: data.businessId
            }));
          }
        } catch (error) {
          console.error('WebSocket message error:', error);
        }
      });

      connection.socket.on('close', () => {
        dashboardConnections.delete(connection);
      });

      // Send initial connection message
      connection.socket.send(JSON.stringify({
        type: 'connected',
        timestamp: new Date().toISOString()
      }));
    });
  });

  // Serve PWA for interview routes
  fastify.get('/interview/*', async (request, reply) => {
    return reply.sendFile('index.html');
  });

  // Serve dashboard for business routes
  fastify.get('/dashboard/*', async (request, reply) => {
    return reply.sendFile('dashboard.html');
  });

  // 404 handler
  fastify.setNotFoundHandler(async (request, reply) => {
    if (request.url.startsWith('/api/')) {
      reply.code(404);
      return { error: 'API endpoint not found' };
    }
    
    // Serve index.html for SPA routes
    return reply.sendFile('index.html');
  });

  // Error handler
  fastify.setErrorHandler(async (error, request, reply) => {
    fastify.log.error(error);
    
    if (error.validation) {
      reply.code(400);
      return {
        error: 'Validation Error',
        message: error.message,
        details: error.validation,
      };
    }

    if (error.statusCode) {
      reply.code(error.statusCode);
      return {
        error: error.name || 'Error',
        message: error.message,
      };
    }

    reply.code(500);
    return {
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    };
  });

  // Graceful shutdown
  const gracefulShutdown = async (signal: string) => {
    console.log(`Received ${signal}, shutting down gracefully...`);
    
    try {
      await fastify.close();
      await prisma.$disconnect();
      console.log('Server closed successfully');
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  return fastify;
}

async function start() {
  try {
    const server = await buildServer();
    
    await server.listen({
      port: PORT,
      host: HOST,
    });
    
    console.log(`🚀 Server running at http://${HOST}:${PORT}`);
    console.log(`📊 Dashboard: http://${HOST}:${PORT}/dashboard`);
    console.log(`💬 Interview: http://${HOST}:${PORT}/interview`);
    console.log(`🔍 Health: http://${HOST}:${PORT}/health`);
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start server if this file is run directly
if (require.main === module) {
  start();
}

export { buildServer, start };