import { prisma } from '../config/database';
import { Subscription, Business } from '../types';

export interface PricingTier {
  id: string;
  name: string;
  price: number; // in cents
  interval: 'month' | 'year';
  features: {
    maxLocations: number;
    maxInterviews: number;
    aiResponseSpeed: 'standard' | 'fast' | 'ultra_fast';
    languageCount: number;
    advancedAnalytics: boolean;
    apiAccess: boolean;
    whiteLabel: boolean;
    dedicatedSupport: boolean;
    customIntegrations: boolean;
  };
  popular?: boolean;
  description: string;
}

export class SubscriptionManager {
  private pricingTiers: PricingTier[] = [
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

  async createSubscription(businessId: string, planId: string): Promise<Subscription> {
    const tier = this.getPricingTier(planId);
    if (!tier) {
      throw new Error(`Invalid plan ID: ${planId}`);
    }

    // Check if business already has a subscription
    const existingSubscription = await prisma.subscription.findUnique({
      where: { businessId }
    });

    if (existingSubscription) {
      throw new Error('Business already has an active subscription');
    }

    const subscription = await prisma.subscription.create({
      data: {
        businessId,
        planType: tier.id,
        currentPeriodEnd: this.calculatePeriodEnd(tier.interval),
        monthlyPrice: tier.price,
        features: tier.features
      }
    });

    return subscription as Subscription;
  }

  async updateSubscription(businessId: string, newPlanId: string): Promise<Subscription> {
    const tier = this.getPricingTier(newPlanId);
    if (!tier) {
      throw new Error(`Invalid plan ID: ${newPlanId}`);
    }

    const existingSubscription = await prisma.subscription.findUnique({
      where: { businessId }
    });

    if (!existingSubscription) {
      throw new Error('No existing subscription found');
    }

    // Calculate prorated amount if upgrading/downgrading
    const proratedAmount = this.calculateProration(
      existingSubscription,
      tier
    );

    const subscription = await prisma.subscription.update({
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

    return subscription as Subscription;
  }

  async cancelSubscription(businessId: string): Promise<void> {
    await prisma.subscription.update({
      where: { businessId },
      data: {
        status: 'canceled',
        // Keep access until period ends
      }
    });
  }

  async checkUsageLimits(businessId: string): Promise<{
    interviews: { used: number; limit: number; exceeded: boolean };
    locations: { used: number; limit: number; exceeded: boolean };
  }> {
    const subscription = await prisma.subscription.findUnique({
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

    const features = subscription.features as any;
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

  async getSubscriptionDetails(businessId: string): Promise<{
    subscription: Subscription;
    usage: any;
    nextBilling: Date;
    features: PricingTier['features'];
  }> {
    const subscription = await prisma.subscription.findUnique({
      where: { businessId }
    });

    if (!subscription) {
      throw new Error('No subscription found');
    }

    const usage = await this.checkUsageLimits(businessId);
    const tier = this.getPricingTier(subscription.planType);

    return {
      subscription: subscription as Subscription,
      usage,
      nextBilling: subscription.currentPeriodEnd,
      features: tier?.features || {}
    };
  }

  getPricingTiers(): PricingTier[] {
    return this.pricingTiers;
  }

  getPricingTier(planId: string): PricingTier | undefined {
    return this.pricingTiers.find(tier => tier.id === planId);
  }

  calculateAnnualDiscount(monthlyPrice: number): number {
    // 20% discount for annual billing
    return Math.round(monthlyPrice * 12 * 0.8);
  }

  async generateUsageReport(businessId: string, startDate: Date, endDate: Date) {
    const [interviews, messages, reviewRequests] = await Promise.all([
      prisma.interview.findMany({
        where: {
          businessId,
          startedAt: { gte: startDate, lte: endDate }
        },
        include: {
          messages: true,
          reviewRequest: true
        }
      }),
      prisma.conversationMessage.count({
        where: {
          interview: { businessId },
          timestamp: { gte: startDate, lte: endDate }
        }
      }),
      prisma.reviewRequest.count({
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

  private calculatePeriodEnd(interval: 'month' | 'year'): Date {
    const now = new Date();
    if (interval === 'month') {
      return new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
    } else {
      return new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
    }
  }

  private getCurrentPeriodStart(periodEnd: Date): Date {
    // Assume monthly billing for simplicity
    return new Date(periodEnd.getFullYear(), periodEnd.getMonth() - 1, periodEnd.getDate());
  }

  private calculateProration(currentSub: any, newTier: PricingTier): number {
    const daysLeft = Math.ceil(
      (currentSub.currentPeriodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    const daysInMonth = 30; // Simplified
    
    const currentDailyRate = currentSub.monthlyPrice / daysInMonth;
    const newDailyRate = newTier.price / daysInMonth;
    
    return Math.round((newDailyRate - currentDailyRate) * daysLeft);
  }

  private calculateAverageDuration(interviews: any[]): number {
    const completedInterviews = interviews.filter(i => i.durationSeconds);
    if (completedInterviews.length === 0) return 0;
    
    return completedInterviews.reduce((sum, i) => sum + i.durationSeconds, 0) / completedInterviews.length;
  }

  private calculateAverageSentiment(interviews: any[]): number {
    const interviewsWithSentiment = interviews.filter(i => i.sentimentScore !== null);
    if (interviewsWithSentiment.length === 0) return 0;
    
    return interviewsWithSentiment.reduce((sum, i) => sum + i.sentimentScore, 0) / interviewsWithSentiment.length;
  }

  private calculateAverageResponseTime(interviews: any[]): number {
    const aiMessages = interviews.flatMap(i => 
      i.messages.filter((m: any) => m.sender === 'ai' && m.responseTimeMs)
    );
    
    if (aiMessages.length === 0) return 0;
    
    return aiMessages.reduce((sum: number, m: any) => sum + m.responseTimeMs, 0) / aiMessages.length;
  }
}