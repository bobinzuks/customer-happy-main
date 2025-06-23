import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AIInterviewEngine } from '../services/aiInterviewEngine';
import { ComplianceManager } from '../services/complianceManager';
import { prisma } from '../config/database';
import { Interview, ConversationMessage } from '../types';

interface InterviewParams {
  sessionId: string;
}

interface MessageBody {
  content: string;
  messageType?: 'text' | 'voice' | 'button';
  languageCode?: string;
  deviceType?: 'mobile' | 'desktop' | 'tablet';
}

interface StartInterviewBody {
  businessId: string;
  customerId?: string;
  languageCode?: string;
  deviceType?: 'mobile' | 'desktop' | 'tablet';
  metadata?: Record<string, any>;
}

export async function interviewRoutes(fastify: FastifyInstance) {
  const aiEngine = new AIInterviewEngine();
  const complianceManager = new ComplianceManager();

  // Start a new interview session
  fastify.post<{Body: StartInterviewBody}>('/api/interview/start', async (request, reply) => {
    try {
      const { businessId, customerId, languageCode = 'en', deviceType = 'mobile', metadata = {} } = request.body;

      // Validate business exists
      const business = await prisma.business.findUnique({
        where: { id: businessId },
        include: { subscription: true }
      });

      if (!business) {
        return reply.code(404).send({ error: 'Business not found' });
      }

      // Check subscription limits
      if (!await checkInterviewLimits(business)) {
        return reply.code(429).send({ error: 'Interview limit exceeded for current plan' });
      }

      // Create new interview session
      const sessionId = crypto.randomUUID();
      const interview = await prisma.interview.create({
        data: {
          sessionId,
          businessId,
          customerId,
          languageCode,
          deviceType,
          metadata,
          status: 'active'
        }
      });

      // Generate welcome message
      const businessSettings = business.settings as any;
      const welcomeMessage = `Hi! I'm your AI assistant from ${businessSettings?.branding?.companyName || business.name}. I'd love to hear about your recent experience with us. How was everything?`;

      // Store welcome message
      await prisma.conversationMessage.create({
        data: {
          interviewId: interview.id,
          sender: 'ai',
          content: welcomeMessage,
          messageType: 'text',
          timestamp: new Date()
        }
      });

      reply.send({
        sessionId,
        interviewId: interview.id,
        welcomeMessage,
        businessName: business.name,
        businessSettings: businessSettings?.branding || {}
      });

    } catch (error) {
      console.error('Start interview error:', error);
      reply.code(500).send({ error: 'Failed to start interview' });
    }
  });

  // Send message in interview
  fastify.post<{Params: InterviewParams, Body: MessageBody}>('/api/interview/:sessionId/message', async (request, reply) => {
    try {
      const { sessionId } = request.params;
      const { content, messageType = 'text', languageCode = 'en', deviceType = 'mobile' } = request.body;

      // Find active interview
      const interview = await prisma.interview.findUnique({
        where: { sessionId },
        include: { 
          business: true,
          messages: {
            orderBy: { timestamp: 'asc' },
            take: 20 // Last 20 messages for context
          }
        }
      });

      if (!interview || interview.status !== 'active') {
        return reply.code(404).send({ error: 'Interview session not found or inactive' });
      }

      // Store user message
      const userMessage = await prisma.conversationMessage.create({
        data: {
          interviewId: interview.id,
          sender: 'user',
          content,
          messageType,
          timestamp: new Date()
        }
      });

      // Update interview message count
      await prisma.interview.update({
        where: { id: interview.id },
        data: { messageCount: { increment: 1 } }
      });

      // Generate AI response
      const businessSettings = interview.business.settings as any;
      const startTime = Date.now();
      
      const aiResponse = await aiEngine.generateResponse(
        content,
        sessionId,
        businessSettings,
        interview.messages as ConversationMessage[]
      );

      const responseTime = Date.now() - startTime;

      // Store AI response
      const aiMessage = await prisma.conversationMessage.create({
        data: {
          interviewId: interview.id,
          sender: 'ai',
          content: aiResponse.content,
          messageType: 'text',
          sentimentScore: aiResponse.sentimentAnalysis.score,
          responseTimeMs: responseTime,
          timestamp: new Date(),
          metadata: {
            nextQuestionType: aiResponse.nextQuestionType,
            emotions: aiResponse.sentimentAnalysis.emotions,
            confidence: aiResponse.sentimentAnalysis.confidence
          }
        }
      });

      // Update interview sentiment
      await prisma.interview.update({
        where: { id: interview.id },
        data: { 
          sentimentScore: aiResponse.sentimentAnalysis.score
        }
      });

      // Check if interview should end
      if (!aiResponse.shouldContinue) {
        await completeInterview(interview.id, aiResponse.sentimentAnalysis.score);
      }

      reply.send({
        messageId: aiMessage.id,
        content: aiResponse.content,
        sentimentAnalysis: aiResponse.sentimentAnalysis,
        shouldContinue: aiResponse.shouldContinue,
        suggestedActions: aiResponse.suggestedActions,
        responseTime: responseTime
      });

    } catch (error) {
      console.error('Send message error:', error);
      reply.code(500).send({ error: 'Failed to process message' });
    }
  });

  // Stream AI responses for real-time UI
  fastify.get<{Params: InterviewParams}>('/api/interview/:sessionId/stream', async (request, reply) => {
    try {
      const { sessionId } = request.params;
      
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });

      // WebSocket-like streaming for real-time responses
      const sendSSE = (data: any) => {
        reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      sendSSE({ type: 'connected', sessionId });

      // Keep connection alive
      const keepAlive = setInterval(() => {
        sendSSE({ type: 'ping' });
      }, 30000);

      request.raw.on('close', () => {
        clearInterval(keepAlive);
      });

    } catch (error) {
      console.error('Stream connection error:', error);
      reply.code(500).send({ error: 'Failed to establish stream' });
    }
  });

  // Complete interview and show review options
  fastify.post<{Params: InterviewParams}>('/api/interview/:sessionId/complete', async (request, reply) => {
    try {
      const { sessionId } = request.params;

      const interview = await prisma.interview.findUnique({
        where: { sessionId },
        include: { business: true }
      });

      if (!interview) {
        return reply.code(404).send({ error: 'Interview not found' });
      }

      const completedInterview = await completeInterview(interview.id, interview.sentimentScore || 0);
      
      // Generate Google-compliant review request
      const reviewRequest = await complianceManager.generateCompliantReviewRequest(
        interview.businessId,
        interview.customerId,
        interview.id,
        interview.sentimentScore || 0
      );

      // Generate compliant messaging
      const compliantMessage = complianceManager.generateCompliantMessage(
        interview.business.name,
        undefined // Customer name if available
      );

      const googleReviewUrl = `https://search.google.com/local/writereview?placeid=${interview.business.googlePlaceId}`;
      const privateFeedbackUrl = `/feedback/${interview.businessId}`;

      reply.send({
        interviewId: interview.id,
        completedAt: completedInterview.completedAt,
        sentimentScore: completedInterview.sentimentScore,
        reviewOptions: {
          googleReview: {
            url: googleReviewUrl,
            cta: compliantMessage.googleReviewCTA
          },
          privateFeedback: {
            url: privateFeedbackUrl,
            cta: compliantMessage.privateFeedbackCTA
          },
          complianceNotice: compliantMessage.complianceNotice
        },
        analytics: {
          duration: completedInterview.durationSeconds,
          messageCount: completedInterview.messageCount,
          finalSentiment: completedInterview.sentimentScore
        }
      });

    } catch (error) {
      console.error('Complete interview error:', error);
      reply.code(500).send({ error: 'Failed to complete interview' });
    }
  });

  // Get interview analytics
  fastify.get<{Params: InterviewParams}>('/api/interview/:sessionId/analytics', async (request, reply) => {
    try {
      const { sessionId } = request.params;

      const interview = await prisma.interview.findUnique({
        where: { sessionId },
        include: {
          messages: {
            orderBy: { timestamp: 'asc' }
          },
          reviewRequest: true
        }
      });

      if (!interview) {
        return reply.code(404).send({ error: 'Interview not found' });
      }

      const analytics = {
        interviewId: interview.id,
        duration: interview.durationSeconds,
        messageCount: interview.messageCount,
        sentimentJourney: interview.messages.map(msg => ({
          timestamp: msg.timestamp,
          sender: msg.sender,
          sentiment: msg.sentimentScore,
          content: msg.content.substring(0, 100)
        })),
        finalAction: interview.finalAction,
        completionRate: interview.status === 'completed' ? 100 : 0,
        averageResponseTime: interview.messages
          .filter(msg => msg.sender === 'ai' && msg.responseTimeMs)
          .reduce((sum, msg) => sum + (msg.responseTimeMs || 0), 0) / 
          interview.messages.filter(msg => msg.sender === 'ai').length || 0
      };

      reply.send(analytics);

    } catch (error) {
      console.error('Get analytics error:', error);
      reply.code(500).send({ error: 'Failed to retrieve analytics' });
    }
  });

  // Helper functions
  async function checkInterviewLimits(business: any): Promise<boolean> {
    if (!business.subscription) return true; // Free tier
    
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);
    
    const interviewCount = await prisma.interview.count({
      where: {
        businessId: business.id,
        startedAt: { gte: currentMonth }
      }
    });

    const limits = business.subscription.features as any;
    return interviewCount < (limits.maxInterviews || 500);
  }

  async function completeInterview(interviewId: string, sentimentScore: number): Promise<Interview> {
    const startedInterview = await prisma.interview.findUnique({
      where: { id: interviewId }
    });

    if (!startedInterview) {
      throw new Error('Interview not found');
    }

    const durationSeconds = Math.floor(
      (Date.now() - startedInterview.startedAt.getTime()) / 1000
    );

    return await prisma.interview.update({
      where: { id: interviewId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        sentimentScore,
        durationSeconds
      }
    }) as Interview;
  }
}