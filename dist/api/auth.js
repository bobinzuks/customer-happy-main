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
exports.authRoutes = authRoutes;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = require("../config/database");
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
async function authRoutes(fastify) {
    // Register new business owner
    fastify.post('/api/auth/register', async (request, reply) => {
        try {
            const { email, password, name, businessName, industry } = request.body;
            // Validate input
            if (!email || !password || !name || !businessName) {
                return reply.code(400).send({
                    error: 'Missing required fields: email, password, name, businessName'
                });
            }
            if (password.length < 8) {
                return reply.code(400).send({
                    error: 'Password must be at least 8 characters long'
                });
            }
            // Check if user already exists
            const existingUser = await database_1.prisma.user.findUnique({
                where: { email: email.toLowerCase() }
            });
            if (existingUser) {
                return reply.code(409).send({
                    error: 'User with this email already exists'
                });
            }
            // Hash password
            const hashedPassword = await bcryptjs_1.default.hash(password, 12);
            // Create user and business in transaction
            const result = await database_1.prisma.$transaction(async (tx) => {
                // Create user
                const user = await tx.user.create({
                    data: {
                        email: email.toLowerCase(),
                        password: hashedPassword,
                        name,
                        role: 'owner'
                    }
                });
                // Create business
                const business = await tx.business.create({
                    data: {
                        name: businessName,
                        industry: industry || 'General',
                        ownerId: user.id,
                        settings: {
                            branding: {
                                primaryColor: '#007AFF',
                                companyName: businessName
                            },
                            reviewSettings: {
                                enableVoiceInput: true,
                                supportedLanguages: ['en']
                            },
                            interviewSettings: {
                                maxQuestions: 5,
                                enableSentimentAnalysis: true
                            }
                        }
                    }
                });
                // Create starter subscription
                await tx.subscription.create({
                    data: {
                        businessId: business.id,
                        planType: 'starter',
                        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
                        monthlyPrice: 4900, // $49.00 in cents
                        features: {
                            maxLocations: 1,
                            maxInterviews: 500,
                            aiResponseSpeed: 'standard',
                            languageCount: 1,
                            advancedAnalytics: false,
                            apiAccess: false,
                            whiteLabel: false
                        }
                    }
                });
                return { user, business };
            });
            // Generate JWT token
            const token = jsonwebtoken_1.default.sign({
                userId: result.user.id,
                email: result.user.email,
                role: result.user.role
            }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
            reply.send({
                user: {
                    id: result.user.id,
                    email: result.user.email,
                    name: result.user.name,
                    role: result.user.role
                },
                business: {
                    id: result.business.id,
                    name: result.business.name,
                    industry: result.business.industry
                },
                token,
                expiresIn: JWT_EXPIRES_IN
            });
        }
        catch (error) {
            console.error('Registration error:', error);
            reply.code(500).send({ error: 'Failed to create account' });
        }
    });
    // Login existing user
    fastify.post('/api/auth/login', async (request, reply) => {
        try {
            const { email, password } = request.body;
            if (!email || !password) {
                return reply.code(400).send({
                    error: 'Email and password are required'
                });
            }
            // Find user with business
            const user = await database_1.prisma.user.findUnique({
                where: { email: email.toLowerCase() },
                include: {
                    businesses: {
                        include: {
                            subscription: true,
                            locations: true
                        }
                    }
                }
            });
            if (!user) {
                return reply.code(401).send({
                    error: 'Invalid email or password'
                });
            }
            // Verify password
            const isValidPassword = await bcryptjs_1.default.compare(password, user.password);
            if (!isValidPassword) {
                return reply.code(401).send({
                    error: 'Invalid email or password'
                });
            }
            // Generate JWT token
            const token = jsonwebtoken_1.default.sign({
                userId: user.id,
                email: user.email,
                role: user.role
            }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
            reply.send({
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role
                },
                businesses: user.businesses.map(business => ({
                    id: business.id,
                    name: business.name,
                    industry: business.industry,
                    settings: business.settings,
                    subscription: business.subscription,
                    locationCount: business.locations.length
                })),
                token,
                expiresIn: JWT_EXPIRES_IN
            });
        }
        catch (error) {
            console.error('Login error:', error);
            reply.code(500).send({ error: 'Login failed' });
        }
    });
    // Refresh token
    fastify.post('/api/auth/refresh', {
        preHandler: authenticateToken
    }, async (request, reply) => {
        try {
            if (!request.user) {
                return reply.code(401).send({ error: 'Authentication required' });
            }
            // Generate new token
            const token = jsonwebtoken_1.default.sign({
                userId: request.user.id,
                email: request.user.email,
                role: request.user.role
            }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
            reply.send({
                token,
                expiresIn: JWT_EXPIRES_IN
            });
        }
        catch (error) {
            console.error('Token refresh error:', error);
            reply.code(500).send({ error: 'Failed to refresh token' });
        }
    });
    // Get current user profile
    fastify.get('/api/auth/me', {
        preHandler: authenticateToken
    }, async (request, reply) => {
        try {
            if (!request.user) {
                return reply.code(401).send({ error: 'Authentication required' });
            }
            const user = await database_1.prisma.user.findUnique({
                where: { id: request.user.id },
                include: {
                    businesses: {
                        include: {
                            subscription: true,
                            locations: true,
                            _count: {
                                select: {
                                    interviews: true,
                                    customers: true
                                }
                            }
                        }
                    }
                }
            });
            if (!user) {
                return reply.code(404).send({ error: 'User not found' });
            }
            reply.send({
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    createdAt: user.createdAt
                },
                businesses: user.businesses.map(business => ({
                    id: business.id,
                    name: business.name,
                    industry: business.industry,
                    settings: business.settings,
                    subscription: business.subscription,
                    locationCount: business.locations.length,
                    interviewCount: business._count.interviews,
                    customerCount: business._count.customers
                }))
            });
        }
        catch (error) {
            console.error('Get profile error:', error);
            reply.code(500).send({ error: 'Failed to get profile' });
        }
    });
    // Logout (invalidate token on client side)
    fastify.post('/api/auth/logout', async (request, reply) => {
        // In a real implementation, you might want to maintain a blacklist of tokens
        // For now, we'll just return success as the client should remove the token
        reply.send({ message: 'Logged out successfully' });
    });
    // Change password
    fastify.put('/api/auth/password', {
        preHandler: authenticateToken
    }, async (request, reply) => {
        try {
            const { currentPassword, newPassword } = request.body;
            if (!request.user) {
                return reply.code(401).send({ error: 'Authentication required' });
            }
            if (!currentPassword || !newPassword) {
                return reply.code(400).send({
                    error: 'Current password and new password are required'
                });
            }
            if (newPassword.length < 8) {
                return reply.code(400).send({
                    error: 'New password must be at least 8 characters long'
                });
            }
            // Get current user
            const user = await database_1.prisma.user.findUnique({
                where: { id: request.user.id }
            });
            if (!user) {
                return reply.code(404).send({ error: 'User not found' });
            }
            // Verify current password
            const isValidPassword = await bcryptjs_1.default.compare(currentPassword, user.password);
            if (!isValidPassword) {
                return reply.code(401).send({ error: 'Current password is incorrect' });
            }
            // Hash new password
            const hashedNewPassword = await bcryptjs_1.default.hash(newPassword, 12);
            // Update password
            await database_1.prisma.user.update({
                where: { id: user.id },
                data: { password: hashedNewPassword }
            });
            reply.send({ message: 'Password updated successfully' });
        }
        catch (error) {
            console.error('Change password error:', error);
            reply.code(500).send({ error: 'Failed to change password' });
        }
    });
    // Authentication middleware
    async function authenticateToken(request, reply) {
        try {
            const authHeader = request.headers.authorization;
            const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
            if (!token) {
                return reply.code(401).send({ error: 'Access token required' });
            }
            const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
            // Verify user still exists
            const user = await database_1.prisma.user.findUnique({
                where: { id: decoded.userId }
            });
            if (!user) {
                return reply.code(401).send({ error: 'User not found' });
            }
            request.user = {
                id: user.id,
                email: user.email,
                role: user.role
            };
        }
        catch (error) {
            console.error('Token verification error:', error);
            return reply.code(401).send({ error: 'Invalid or expired token' });
        }
    }
    // Rate limiting for auth endpoints
    await fastify.register(Promise.resolve().then(() => __importStar(require('@fastify/rate-limit'))), {
        max: 5,
        timeWindow: '15 minutes',
        errorResponseBuilder: function (request, context) {
            return {
                code: 429,
                error: 'Too Many Requests',
                message: 'Too many authentication attempts, please try again later.',
                retryAfter: Math.round(context.ttl / 1000)
            };
        },
        keyGenerator: function (request) {
            return request.ip; // Rate limit by IP
        },
        // Apply only to auth endpoints
        routeKey: 'auth'
    });
}
