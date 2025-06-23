// Core Types for AI-Powered Customer Interview SaaS

export interface Customer {
  id: string;
  email?: string;
  phone?: string;
  name?: string;
  businessId: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Business {
  id: string;
  name: string;
  industry: string;
  ownerId: string;
  settings: BusinessSettings;
  locations?: Location[];
  googlePlaceId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BusinessSettings {
  branding: {
    primaryColor: string;
    logo?: string;
    companyName: string;
  };
  reviewSettings: {
    googleReviewUrl?: string;
    customThankYouMessage?: string;
    enableVoiceInput: boolean;
    supportedLanguages: string[];
  };
  interviewSettings: {
    maxQuestions: number;
    enableSentimentAnalysis: boolean;
    customPrompts?: string[];
  };
}

export interface Location {
  id: string;
  businessId: string;
  name: string;
  address: string;
  googlePlaceId?: string;
  phone?: string;
}

export interface Interview {
  id: string;
  sessionId: string;
  businessId: string;
  customerId?: string;
  startedAt: Date;
  completedAt?: Date;
  status: 'active' | 'completed' | 'abandoned';
  sentimentScore?: number;
  finalAction?: 'google_review' | 'private_feedback' | 'none';
  languageCode: string;
  deviceType: 'mobile' | 'desktop' | 'tablet';
  messageCount: number;
  durationSeconds?: number;
  metadata: Record<string, any>;
}

export interface ConversationMessage {
  id: string;
  interviewId: string;
  sender: 'user' | 'ai';
  content: string;
  messageType: 'text' | 'voice' | 'button';
  sentimentScore?: number;
  responseTimeMs?: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface AIResponse {
  content: string;
  nextQuestionType?: string;
  sentimentAnalysis: {
    score: number;
    confidence: number;
    emotions: string[];
  };
  shouldContinue: boolean;
  suggestedActions?: string[];
}

export interface ReviewRequest {
  id: string;
  businessId: string;
  customerId?: string;
  interviewId: string;
  type: 'google_review' | 'private_feedback';
  status: 'sent' | 'completed' | 'declined';
  sentAt: Date;
  completedAt?: Date;
  complianceValidated: boolean;
  complianceNotes?: string;
}

export interface ComplianceRecord {
  id: string;
  businessId: string;
  auditPeriodStart: Date;
  auditPeriodEnd: Date;
  totalRequests: number;
  compliantRequests: number;
  violationsFound: number;
  violationDetails?: Record<string, any>;
  auditDate: Date;
}

export interface Subscription {
  id: string;
  businessId: string;
  planType: 'starter' | 'professional' | 'enterprise';
  status: 'active' | 'past_due' | 'canceled';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  monthlyPrice: number;
  features: {
    maxLocations: number;
    maxInterviews: number;
    aiResponseSpeed: 'standard' | 'fast' | 'ultra_fast';
    languageCount: number;
    advancedAnalytics: boolean;
    apiAccess: boolean;
    whiteLabel: boolean;
  };
}

export interface AnalyticsSummary {
  businessId: string;
  period: 'day' | 'week' | 'month';
  startDate: Date;
  endDate: Date;
  metrics: {
    totalInterviews: number;
    completedInterviews: number;
    averageSentiment: number;
    averageDuration: number;
    googleReviewRate: number;
    privateFeeedbackRate: number;
    abandonmentRate: number;
  };
  sentimentTrend: Array<{
    date: Date;
    sentiment: number;
    count: number;
  }>;
}