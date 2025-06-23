"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildServer = buildServer;
exports.start = start;
const fastify_1 = __importDefault(require("fastify"));
const static_1 = __importDefault(require("@fastify/static"));
const websocket_1 = __importDefault(require("@fastify/websocket"));
const cors_1 = __importDefault(require("@fastify/cors"));
const helmet_1 = __importDefault(require("@fastify/helmet"));
const path_1 = __importDefault(require("path"));
const interview_1 = require("./api/interview");
const dashboard_1 = require("./api/dashboard");
const auth_1 = require("./api/auth");
const database_1 = require("./config/database");
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const HOST = process.env.HOST || '0.0.0.0';
async function buildServer() {
    const fastify = (0, fastify_1.default)({
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
    await fastify.register(helmet_1.default, {
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
    await fastify.register(cors_1.default, {
        origin: process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : process.env.FRONTEND_URL,
        credentials: true,
    });
    // WebSocket support
    await fastify.register(websocket_1.default);
    // Static files
    await fastify.register(static_1.default, {
        root: path_1.default.join(__dirname, '..', 'public'),
        prefix: '/',
    });
    // Rate limiting
    await fastify.register(Promise.resolve().then(() => __importStar(require('@fastify/rate-limit'))), {
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
            await database_1.prisma.$queryRaw `SELECT 1`;
            return {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                version: process.env.npm_package_version || '1.0.0',
            };
        }
        catch (error) {
            reply.code(503);
            return {
                status: 'unhealthy',
                timestamp: new Date().toISOString(),
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    });
    // API routes
    await fastify.register(auth_1.authRoutes);
    await fastify.register(interview_1.interviewRoutes);
    await fastify.register(dashboard_1.dashboardRoutes);
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
                }
                catch (error) {
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
    const gracefulShutdown = async (signal) => {
        console.log(`Received ${signal}, shutting down gracefully...`);
        try {
            await fastify.close();
            await database_1.prisma.$disconnect();
            console.log('Server closed successfully');
            process.exit(0);
        }
        catch (error) {
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
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}
// Start server if this file is run directly
if (require.main === module) {
    start();
}
