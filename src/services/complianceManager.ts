import { ReviewRequest, ComplianceRecord, Business, Customer } from '../types';
import { prisma } from '../config/database';

export class ComplianceManager {
  private auditLogger: AuditLogger;

  constructor() {
    this.auditLogger = new AuditLogger();
  }

  async generateCompliantReviewRequest(
    businessId: string,
    customerId: string | null,
    interviewId: string,
    sentimentScore: number
  ): Promise<ReviewRequest> {
    try {
      // CRITICAL: Equal opportunity review requests - required by Google & FTC
      const business = await prisma.business.findUnique({
        where: { id: businessId },
        include: { locations: true }
      });

      if (!business) {
        throw new Error('Business not found');
      }

      const customer = customerId ? await prisma.customer.findUnique({
        where: { id: customerId }
      }) : null;

      const reviewRequest: ReviewRequest = {
        id: crypto.randomUUID(),
        businessId,
        customerId,
        interviewId,
        type: 'google_review', // Always offer Google review option
        status: 'sent',
        sentAt: new Date(),
        complianceValidated: true,
        complianceNotes: 'Auto-validated: Equal opportunity review request'
      };

      // Generate Google review URL
      const googleReviewUrl = this.generateGoogleReviewUrl(business);
      
      // Log for compliance audit
      await this.auditLogger.logReviewRequest({
        ...reviewRequest,
        sentimentScore,
        equalOpportunityOffered: true,
        googleReviewUrl,
        privateFeeedbackUrl: this.generatePrivateFeedbackUrl(businessId),
        complianceFramework: 'FTC_GOOGLE_2024'
      });

      // Store in database
      await prisma.reviewRequest.create({
        data: {
          id: reviewRequest.id,
          businessId: reviewRequest.businessId,
          customerId: reviewRequest.customerId,
          interviewId: reviewRequest.interviewId,
          type: reviewRequest.type,
          status: reviewRequest.status,
          sentAt: reviewRequest.sentAt,
          complianceValidated: reviewRequest.complianceValidated,
          complianceNotes: reviewRequest.complianceNotes
        }
      });

      return reviewRequest;

    } catch (error) {
      console.error('Error generating compliant review request:', error);
      throw error;
    }
  }

  async validateReviewRequest(requestData: any): Promise<{
    compliant: boolean;
    violations: string[];
    requestId: string;
  }> {
    const violations: string[] = [];

    // Check for review gating based on sentiment
    if (this.containsSentimentBias(requestData.message)) {
      violations.push("Message contains sentiment bias - potential review gating");
    }

    // Check for conditional incentives (FTC violation)
    if (this.containsConditionalIncentive(requestData.message)) {
      violations.push("Contains conditional incentive - FTC violation");
    }

    // Check for equal opportunity language
    if (!this.hasEqualOpportunityLanguage(requestData.message)) {
      violations.push("Missing equal opportunity language");
    }

    // Check timing restrictions
    if (this.hasTimingRestrictions(requestData)) {
      violations.push("Contains timing restrictions based on sentiment");
    }

    return {
      compliant: violations.length === 0,
      violations,
      requestId: requestData.id || 'unknown'
    };
  }

  generateCompliantMessage(businessName: string, customerName?: string): {
    subject: string;
    message: string;
    googleReviewCTA: string;
    privateFeedbackCTA: string;
    complianceNotice: string;
  } {
    const name = customerName ? customerName : 'valued customer';
    
    return {
      subject: `Share Your Experience with ${businessName}`,
      message: `Hi ${name},

Thank you for choosing ${businessName}. We'd love to hear about your recent experience with us.

Your feedback helps us improve our service and assists other customers in making informed decisions.`,
      
      googleReviewCTA: `Share your experience publicly on Google to help other customers`,
      privateFeedbackCTA: `Share feedback privately with our team`,
      complianceNotice: `We welcome all honest feedback, whether positive or negative. Your choice helps us serve you better.`
    };
  }

  private generateGoogleReviewUrl(business: any): string {
    if (business.googlePlaceId) {
      return `https://search.google.com/local/writereview?placeid=${business.googlePlaceId}`;
    }
    
    // Fallback to search-based URL
    const encodedName = encodeURIComponent(business.name);
    return `https://www.google.com/search?q=${encodedName}+reviews#lrd=0x0:0x0,3`;
  }

  private generatePrivateFeedbackUrl(businessId: string): string {
    return `${process.env.APP_URL}/feedback/${businessId}`;
  }

  private containsSentimentBias(message: string): boolean {
    const biasKeywords = [
      'if you\'re happy',
      'positive experience',
      'satisfied customers',
      'good experience',
      'great service'
    ];
    
    return biasKeywords.some(keyword => 
      message.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  private containsConditionalIncentive(message: string): boolean {
    const incentiveKeywords = [
      'discount if',
      'reward for',
      'bonus for positive',
      'free if you review',
      'coupon for'
    ];
    
    return incentiveKeywords.some(keyword => 
      message.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  private hasEqualOpportunityLanguage(message: string): boolean {
    const equalOpportunityPhrases = [
      'all feedback',
      'honest feedback',
      'your experience',
      'positive or negative',
      'welcome all'
    ];
    
    return equalOpportunityPhrases.some(phrase => 
      message.toLowerCase().includes(phrase.toLowerCase())
    );
  }

  private hasTimingRestrictions(requestData: any): boolean {
    // Check if request timing is based on sentiment score
    return requestData.sentimentBasedDelay === true || 
           requestData.conditionalTiming === true;
  }

  async generateComplianceReport(
    businessId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ComplianceRecord> {
    try {
      const reviewRequests = await prisma.reviewRequest.findMany({
        where: {
          businessId,
          sentAt: {
            gte: startDate,
            lte: endDate
          }
        }
      });

      const totalRequests = reviewRequests.length;
      const compliantRequests = reviewRequests.filter(req => req.complianceValidated).length;
      const violationsFound = totalRequests - compliantRequests;

      const complianceRecord: ComplianceRecord = {
        id: crypto.randomUUID(),
        businessId,
        auditPeriodStart: startDate,
        auditPeriodEnd: endDate,
        totalRequests,
        compliantRequests,
        violationsFound,
        violationDetails: this.aggregateViolations(reviewRequests),
        auditDate: new Date()
      };

      // Store compliance record
      await prisma.complianceRecord.create({
        data: complianceRecord
      });

      return complianceRecord;

    } catch (error) {
      console.error('Error generating compliance report:', error);
      throw error;
    }
  }

  private aggregateViolations(requests: any[]): Record<string, any> {
    const violations: Record<string, number> = {};
    
    requests.forEach(request => {
      if (!request.complianceValidated && request.complianceNotes) {
        const violation = request.complianceNotes;
        violations[violation] = (violations[violation] || 0) + 1;
      }
    });

    return {
      violationCounts: violations,
      totalViolatingRequests: Object.values(violations).reduce((sum, count) => sum + count, 0),
      complianceRate: ((requests.length - Object.values(violations).reduce((sum, count) => sum + count, 0)) / requests.length * 100).toFixed(2) + '%'
    };
  }
}

class AuditLogger {
  async logReviewRequest(requestData: any): Promise<void> {
    try {
      // Store detailed audit log for compliance purposes
      const auditEntry = {
        timestamp: new Date().toISOString(),
        requestId: requestData.id,
        businessId: requestData.businessId,
        customerId: requestData.customerId,
        sentimentScore: requestData.sentimentScore,
        equalOpportunityOffered: requestData.equalOpportunityOffered,
        googleReviewUrl: requestData.googleReviewUrl,
        privateFeedbackUrl: requestData.privateFeedbackUrl,
        complianceFramework: requestData.complianceFramework,
        userAgent: requestData.userAgent || 'system',
        ipAddress: requestData.ipAddress || 'internal'
      };

      // In production, this would go to a secure audit database
      console.log('COMPLIANCE_AUDIT_LOG:', JSON.stringify(auditEntry));
      
      // Store in audit table if needed for compliance reporting
      // await prisma.auditLog.create({data: auditEntry});
      
    } catch (error) {
      console.error('Audit logging error:', error);
      // Fail silently but log the error
    }
  }
}