import { ReviewRequest, ComplianceRecord } from '../types';
export declare class ComplianceManager {
    private auditLogger;
    constructor();
    generateCompliantReviewRequest(businessId: string, customerId: string | null, interviewId: string, sentimentScore: number): Promise<ReviewRequest>;
    validateReviewRequest(requestData: any): Promise<{
        compliant: boolean;
        violations: string[];
        requestId: string;
    }>;
    generateCompliantMessage(businessName: string, customerName?: string): {
        subject: string;
        message: string;
        googleReviewCTA: string;
        privateFeedbackCTA: string;
        complianceNotice: string;
    };
    private generateGoogleReviewUrl;
    private generatePrivateFeedbackUrl;
    private containsSentimentBias;
    private containsConditionalIncentive;
    private hasEqualOpportunityLanguage;
    private hasTimingRestrictions;
    generateComplianceReport(businessId: string, startDate: Date, endDate: Date): Promise<ComplianceRecord>;
    private aggregateViolations;
}
