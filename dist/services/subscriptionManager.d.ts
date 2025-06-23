import { Subscription } from '../types';
export interface PricingTier {
    id: string;
    name: string;
    price: number;
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
export declare class SubscriptionManager {
    private pricingTiers;
    createSubscription(businessId: string, planId: string): Promise<Subscription>;
    updateSubscription(businessId: string, newPlanId: string): Promise<Subscription>;
    cancelSubscription(businessId: string): Promise<void>;
    checkUsageLimits(businessId: string): Promise<{
        interviews: {
            used: number;
            limit: number;
            exceeded: boolean;
        };
        locations: {
            used: number;
            limit: number;
            exceeded: boolean;
        };
    }>;
    getSubscriptionDetails(businessId: string): Promise<{
        subscription: Subscription;
        usage: any;
        nextBilling: Date;
        features: PricingTier['features'];
    }>;
    getPricingTiers(): PricingTier[];
    getPricingTier(planId: string): PricingTier | undefined;
    calculateAnnualDiscount(monthlyPrice: number): number;
    generateUsageReport(businessId: string, startDate: Date, endDate: Date): Promise<{
        period: {
            startDate: Date;
            endDate: Date;
        };
        interviews: {
            total: any;
            completed: any;
            abandoned: any;
            averageDuration: number;
            averageSentiment: number;
        };
        messages: {
            total: any;
            aiResponses: any;
            averageResponseTime: number;
        };
        reviews: {
            requestsSent: any;
            googleReviews: any;
            privateFeedback: any;
        };
    }>;
    private calculatePeriodEnd;
    private getCurrentPeriodStart;
    private calculateProration;
    private calculateAverageDuration;
    private calculateAverageSentiment;
    private calculateAverageResponseTime;
}
