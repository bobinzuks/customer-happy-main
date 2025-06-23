"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionManager = void 0;
const database_1 = require("../config/database");
class SubscriptionManager {
    constructor() {
        this.pricingTiers = [
            {
                id: 'starter',
                name: 'Starter',
                price: 4900, // $49.00
                interval: 'month',
                description: 'Perfect for small businesses getting started with customer interviews',
                features: {
                    maxLocations: 1,
                    maxInterviews: 500,
                    aiResponseSpeed: 'standard',
                    languageCount: 2,
                    advancedAnalytics: false,
                    apiAccess: false,
                    whiteLabel: false,
                    dedicatedSupport: false,
                    customIntegrations: false
                }
            },
            {
                id: 'professional',
                name: 'Professional',
                price: 14900, // $149.00
                interval: 'month',
                description: 'For growing businesses that need advanced features and analytics',
                popular: true,
                features: {
                    maxLocations: 3,
                    maxInterviews: 2000,
                    aiResponseSpeed: 'fast',
                    languageCount: 5,
                    advancedAnalytics: true,
                    apiAccess: true,
                    whiteLabel: false,
                    dedicatedSupport: true,
                    customIntegrations: false
                }
            },
            {
                id: 'enterprise',
                name: 'Enterprise',
                price: 39900, // $399.00
                interval: 'month',
                description: 'For large organizations with unlimited scaling and white-label options',
                features: {
                    maxLocations: -1, // unlimited
                    maxInterviews: -1, // unlimited
                    aiResponseSpeed: 'ultra_fast',
                    languageCount: 25,
                    advancedAnalytics: true,
                    apiAccess: true,
                    whiteLabel: true,
                    dedicatedSupport: true,
                    customIntegrations: true
                }
            }
        ];
    }
    async createSubscription(businessId, planId) {
        const tier = this.getPricingTier(planId);
        if (!tier) {
            throw new Error(`Invalid plan ID: ${planId}`);
        }
        // Check if business already has a subscription
        const existingSubscription = await database_1.prisma.subscription.findUnique({
            where: { businessId }
        });
        if (existingSubscription) {
            throw new Error('Business already has an active subscription');
        }
        const subscription = await database_1.prisma.subscription.create({
            data: {
                businessId,
                planType: tier.id,
                currentPeriodEnd: this.calculatePeriodEnd(tier.interval),
                monthlyPrice: tier.price,
                features: tier.features
            }
        });
        return subscription;
    }
    async updateSubscription(businessId, newPlanId) {
        const tier = this.getPricingTier(newPlanId);
        if (!tier) {
            throw new Error(`Invalid plan ID: ${newPlanId}`);
        }
        const existingSubscription = await database_1.prisma.subscription.findUnique({
            where: { businessId }
        });
        if (!existingSubscription) {
            throw new Error('No existing subscription found');
        }
        // Calculate prorated amount if upgrading/downgrading
        const proratedAmount = this.calculateProration(existingSubscription, tier);
        const subscription = await database_1.prisma.subscription.update({
            where: { businessId },
            data: {
                planType: tier.id,
                monthlyPrice: tier.price,
                features: tier.features,
                // Extend period if upgrading
                currentPeriodEnd: tier.price > existingSubscription.monthlyPrice
                    ? this.calculatePeriodEnd(tier.interval)
                    : existingSubscription.currentPeriodEnd
            }
        });
        return subscription;
    }
    async cancelSubscription(businessId) {
        await database_1.prisma.subscription.update({
            where: { businessId },
            data: {
                status: 'canceled',
                // Keep access until period ends
            }
        });
    }
    async checkUsageLimits(businessId) {
        const subscription = await database_1.prisma.subscription.findUnique({
            where: { businessId },
            include: {
                business: {
                    include: {
                        _count: {
                            select: {
                                interviews: {
                                    where: {
                                        startedAt: {
                                            gte: this.getCurrentPeriodStart(new Date())
                                        }
                                    }
                                },
                                locations: true
                            }
                        }
                    }
                }
            }
        });
        if (!subscription) {
            throw new Error('No subscription found');
        }
        const features = subscription.features;
        const interviewsUsed = subscription.business._count.interviews;
        const locationsUsed = subscription.business._count.locations;
        return {
            interviews: {
                used: interviewsUsed,
                limit: features.maxInterviews,
                exceeded: features.maxInterviews > 0 && interviewsUsed >= features.maxInterviews
            },
            locations: {
                used: locationsUsed,
                limit: features.maxLocations,
                exceeded: features.maxLocations > 0 && locationsUsed >= features.maxLocations
            }
        };
    }
    async getSubscriptionDetails(businessId) {
        const subscription = await database_1.prisma.subscription.findUnique({
            where: { businessId }
        });
        if (!subscription) {
            throw new Error('No subscription found');
        }
        const usage = await this.checkUsageLimits(businessId);
        const tier = this.getPricingTier(subscription.planType);
        return {
            subscription: subscription,
            usage,
            nextBilling: subscription.currentPeriodEnd,
            features: tier?.features || {}
        };
    }
    getPricingTiers() {
        return this.pricingTiers;
    }
    getPricingTier(planId) {
        return this.pricingTiers.find(tier => tier.id === planId);
    }
    calculateAnnualDiscount(monthlyPrice) {
        // 20% discount for annual billing
        return Math.round(monthlyPrice * 12 * 0.8);
    }
    async generateUsageReport(businessId, startDate, endDate) {
        const [interviews, messages, reviewRequests] = await Promise.all([
            database_1.prisma.interview.findMany({
                where: {
                    businessId,
                    startedAt: { gte: startDate, lte: endDate }
                },
                include: {
                    messages: true,
                    reviewRequest: true
                }
            }),
            database_1.prisma.conversationMessage.count({
                where: {
                    interview: { businessId },
                    timestamp: { gte: startDate, lte: endDate }
                }
            }),
            database_1.prisma.reviewRequest.count({
                where: {
                    businessId,
                    sentAt: { gte: startDate, lte: endDate }
                }
            })
        ]);
        return {
            period: { startDate, endDate },
            interviews: {
                total: interviews.length,
                completed: interviews.filter(i => i.status === 'completed').length,
                abandoned: interviews.filter(i => i.status === 'abandoned').length,
                averageDuration: this.calculateAverageDuration(interviews),
                averageSentiment: this.calculateAverageSentiment(interviews)
            },
            messages: {
                total: messages,
                aiResponses: interviews.reduce((sum, i) => sum + i.messages.filter(m => m.sender === 'ai').length, 0),
                averageResponseTime: this.calculateAverageResponseTime(interviews)
            },
            reviews: {
                requestsSent: reviewRequests,
                googleReviews: interviews.filter(i => i.reviewRequest?.type === 'google_review').length,
                privateFeedback: interviews.filter(i => i.reviewRequest?.type === 'private_feedback').length
            }
        };
    }
    calculatePeriodEnd(interval) {
        const now = new Date();
        if (interval === 'month') {
            return new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
        }
        else {
            return new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
        }
    }
    getCurrentPeriodStart(periodEnd) {
        // Assume monthly billing for simplicity
        return new Date(periodEnd.getFullYear(), periodEnd.getMonth() - 1, periodEnd.getDate());
    }
    calculateProration(currentSub, newTier) {
        const daysLeft = Math.ceil((currentSub.currentPeriodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        const daysInMonth = 30; // Simplified
        const currentDailyRate = currentSub.monthlyPrice / daysInMonth;
        const newDailyRate = newTier.price / daysInMonth;
        return Math.round((newDailyRate - currentDailyRate) * daysLeft);
    }
    calculateAverageDuration(interviews) {
        const completedInterviews = interviews.filter(i => i.durationSeconds);
        if (completedInterviews.length === 0)
            return 0;
        return completedInterviews.reduce((sum, i) => sum + i.durationSeconds, 0) / completedInterviews.length;
    }
    calculateAverageSentiment(interviews) {
        const interviewsWithSentiment = interviews.filter(i => i.sentimentScore !== null);
        if (interviewsWithSentiment.length === 0)
            return 0;
        return interviewsWithSentiment.reduce((sum, i) => sum + i.sentimentScore, 0) / interviewsWithSentiment.length;
    }
    calculateAverageResponseTime(interviews) {
        const aiMessages = interviews.flatMap(i => i.messages.filter((m) => m.sender === 'ai' && m.responseTimeMs));
        if (aiMessages.length === 0)
            return 0;
        return aiMessages.reduce((sum, m) => sum + m.responseTimeMs, 0) / aiMessages.length;
    }
}
exports.SubscriptionManager = SubscriptionManager;
