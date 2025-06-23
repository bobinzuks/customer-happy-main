import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../config/database';
import { AnalyticsSummary } from '../types';

interface DashboardQuery {
  business?: string;
  range?: string;
  location?: string;
}

export async function dashboardRoutes(fastify: FastifyInstance) {
  
  // Get KPI data
  fastify.get<{Querystring: DashboardQuery}>('/api/dashboard/kpis', async (request, reply) => {
    try {
      const { business = 'all', range = 'week' } = request.query;
      const { startDate, endDate } = getDateRange(range);

      const [interviews, reviews, sentiment, responseTime] = await Promise.all([
        getInterviewStats(business, startDate, endDate),
        getReviewStats(business, startDate, endDate),
        getSentimentStats(business, startDate, endDate),
        getResponseTimeStats(business, startDate, endDate)
      ]);

      reply.send({
        totalInterviews: interviews.total,
        completedInterviews: interviews.completed,
        averageRating: reviews.averageRating,
        reviewRate: reviews.rate,
        averageSentiment: sentiment.average,
        responseTime: responseTime.average,
        trends: {
          interviews: interviews.trend,
          rating: reviews.trend,
          sentiment: sentiment.trend,
          responseTime: responseTime.trend
        }
      });

    } catch (error) {
      console.error('KPI data error:', error);
      reply.code(500).send({ error: 'Failed to fetch KPI data' });
    }
  });

  // Get chart data
  fastify.get<{Querystring: DashboardQuery}>('/api/dashboard/charts', async (request, reply) => {
    try {
      const { business = 'all', range = 'week' } = request.query;
      const { startDate, endDate } = getDateRange(range);

      const [sentimentTrend, volumeTrend] = await Promise.all([
        getSentimentTrendData(business, startDate, endDate),
        getVolumeTrendData(business, startDate, endDate)
      ]);

      reply.send({
        sentimentTrend,
        volumeTrend
      });

    } catch (error) {
      console.error('Chart data error:', error);
      reply.code(500).send({ error: 'Failed to fetch chart data' });
    }
  });

  // Get activity feed
  fastify.get<{Querystring: DashboardQuery}>('/api/dashboard/activity', async (request, reply) => {
    try {
      const { business = 'all', range = 'week' } = request.query;
      const { startDate, endDate } = getDateRange(range);

      const activities = await getRecentActivity(business, startDate, endDate);

      reply.send(activities);

    } catch (error) {
      console.error('Activity data error:', error);
      reply.code(500).send({ error: 'Failed to fetch activity data' });
    }
  });

  // Export dashboard data
  fastify.get<{Querystring: DashboardQuery & { format?: string }}>('/api/dashboard/export', async (request, reply) => {
    try {
      const { business = 'all', range = 'week', format = 'csv' } = request.query;
      const { startDate, endDate } = getDateRange(range);

      const data = await getExportData(business, startDate, endDate);

      if (format === 'csv') {
        const csv = convertToCSV(data);
        reply
          .header('Content-Type', 'text/csv')
          .header('Content-Disposition', `attachment; filename="dashboard-export-${range}.csv"`)
          .send(csv);
      } else {
        reply
          .header('Content-Type', 'application/json')
          .header('Content-Disposition', `attachment; filename="dashboard-export-${range}.json"`)
          .send(data);
      }

    } catch (error) {
      console.error('Export error:', error);
      reply.code(500).send({ error: 'Failed to export data' });
    }
  });

  // Real-time analytics summary
  fastify.get<{Querystring: DashboardQuery}>('/api/dashboard/realtime', async (request, reply) => {
    try {
      const { business = 'all' } = request.query;
      
      // Get data from last 5 minutes for real-time updates
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const now = new Date();

      const realtimeData = await getRealtimeData(business, fiveMinutesAgo, now);

      reply.send(realtimeData);

    } catch (error) {
      console.error('Real-time data error:', error);
      reply.code(500).send({ error: 'Failed to fetch real-time data' });
    }
  });

  // Helper functions
  function getDateRange(range: string): { startDate: Date; endDate: Date } {
    const endDate = new Date();
    let startDate: Date;

    switch (range) {
      case 'today':
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'quarter':
        startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    }

    return { startDate, endDate };
  }

  async function getInterviewStats(businessId: string, startDate: Date, endDate: Date) {
    const whereClause = {
      startedAt: { gte: startDate, lte: endDate },
      ...(businessId !== 'all' && { businessId })
    };

    const [total, completed, previousPeriod] = await Promise.all([
      prisma.interview.count({ where: whereClause }),
      prisma.interview.count({ 
        where: { ...whereClause, status: 'completed' }
      }),
      prisma.interview.count({
        where: {
          ...whereClause,
          startedAt: {
            gte: new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime())),
            lte: startDate
          }
        }
      })
    ]);

    const trend = total > 0 ? ((total - previousPeriod) / (previousPeriod || 1)) * 100 : 0;

    return { total, completed, trend };
  }

  async function getReviewStats(businessId: string, startDate: Date, endDate: Date) {
    const whereClause = {
      sentAt: { gte: startDate, lte: endDate },
      ...(businessId !== 'all' && { businessId })
    };

    const [totalRequests, googleReviews] = await Promise.all([
      prisma.reviewRequest.count({ where: whereClause }),
      prisma.reviewRequest.count({
        where: { ...whereClause, type: 'google_review', status: 'completed' }
      })
    ]);

    // Mock average rating - in real implementation, this would come from Google API
    const averageRating = 4.6;
    const rate = totalRequests > 0 ? (googleReviews / totalRequests) * 100 : 0;
    const trend = 2.3; // Mock trend

    return { averageRating, rate, trend };
  }

  async function getSentimentStats(businessId: string, startDate: Date, endDate: Date) {
    const whereClause = {
      startedAt: { gte: startDate, lte: endDate },
      ...(businessId !== 'all' && { businessId }),
      sentimentScore: { not: null }
    };

    const result = await prisma.interview.aggregate({
      where: whereClause,
      _avg: { sentimentScore: true },
      _count: { sentimentScore: true }
    });

    return {
      average: result._avg.sentimentScore || 0,
      count: result._count.sentimentScore,
      trend: 5.2 // Mock trend
    };
  }

  async function getResponseTimeStats(businessId: string, startDate: Date, endDate: Date) {
    const whereClause = {
      timestamp: { gte: startDate, lte: endDate },
      sender: 'ai',
      responseTimeMs: { not: null },
      ...(businessId !== 'all' && { 
        interview: { businessId }
      })
    };

    const result = await prisma.conversationMessage.aggregate({
      where: whereClause,
      _avg: { responseTimeMs: true }
    });

    const averageMs = result._avg.responseTimeMs || 0;
    const averageSeconds = averageMs / 1000;

    return {
      average: averageSeconds,
      trend: -8.5 // Mock trend (improvement)
    };
  }

  async function getSentimentTrendData(businessId: string, startDate: Date, endDate: Date) {
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const labels: string[] = [];
    const data: number[] = [];

    for (let i = 0; i < days; i++) {
      const dayStart = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      
      const result = await prisma.interview.aggregate({
        where: {
          startedAt: { gte: dayStart, lt: dayEnd },
          ...(businessId !== 'all' && { businessId }),
          sentimentScore: { not: null }
        },
        _avg: { sentimentScore: true }
      });

      labels.push(dayStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      data.push(result._avg.sentimentScore || 0);
    }

    return { labels, data };
  }

  async function getVolumeTrendData(businessId: string, startDate: Date, endDate: Date) {
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const labels: string[] = [];
    const completed: number[] = [];
    const abandoned: number[] = [];

    for (let i = 0; i < days; i++) {
      const dayStart = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      
      const [completedCount, abandonedCount] = await Promise.all([
        prisma.interview.count({
          where: {
            startedAt: { gte: dayStart, lt: dayEnd },
            status: 'completed',
            ...(businessId !== 'all' && { businessId })
          }
        }),
        prisma.interview.count({
          where: {
            startedAt: { gte: dayStart, lt: dayEnd },
            status: 'abandoned',
            ...(businessId !== 'all' && { businessId })
          }
        })
      ]);

      labels.push(dayStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      completed.push(completedCount);
      abandoned.push(abandonedCount);
    }

    return { labels, completed, abandoned };
  }

  async function getRecentActivity(businessId: string, startDate: Date, endDate: Date) {
    // Get recent interviews and reviews
    const [recentInterviews, recentReviews] = await Promise.all([
      prisma.interview.findMany({
        where: {
          startedAt: { gte: startDate, lte: endDate },
          status: 'completed',
          ...(businessId !== 'all' && { businessId })
        },
        include: {
          customer: true,
          reviewRequest: true
        },
        orderBy: { completedAt: 'desc' },
        take: 20
      }),
      prisma.reviewRequest.findMany({
        where: {
          sentAt: { gte: startDate, lte: endDate },
          status: 'completed',
          ...(businessId !== 'all' && { businessId })
        },
        include: {
          customer: true,
          interview: true
        },
        orderBy: { completedAt: 'desc' },
        take: 10
      })
    ]);

    const activities = [];

    // Add interview activities
    recentInterviews.forEach(interview => {
      activities.push({
        type: interview.sentimentScore && interview.sentimentScore > 0 ? 'positive' : 'negative',
        icon: interview.sentimentScore && interview.sentimentScore > 0 ? '💬' : '😞',
        title: 'Interview completed',
        timestamp: interview.completedAt,
        preview: `${interview.sentimentScore && interview.sentimentScore > 0 ? 'Positive' : 'Negative'} sentiment - ${interview.finalAction || 'No action taken'}`,
        urgent: interview.sentimentScore && interview.sentimentScore < -0.5
      });
    });

    // Add review activities
    recentReviews.forEach(review => {
      const rating = Math.floor(Math.random() * 3) + 3; // Mock rating 3-5
      activities.push({
        type: rating >= 4 ? 'positive' : 'warning',
        icon: rating >= 4 ? '⭐' : '⚠️',
        title: `${rating}-star review received`,
        timestamp: review.completedAt,
        preview: review.customer?.name ? `From ${review.customer.name}` : 'Anonymous review',
        urgent: rating < 3
      });
    });

    // Sort by timestamp and return latest 10
    return activities
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);
  }

  async function getExportData(businessId: string, startDate: Date, endDate: Date) {
    const interviews = await prisma.interview.findMany({
      where: {
        startedAt: { gte: startDate, lte: endDate },
        ...(businessId !== 'all' && { businessId })
      },
      include: {
        customer: true,
        messages: true,
        reviewRequest: true,
        business: {
          select: { name: true }
        }
      },
      orderBy: { startedAt: 'desc' }
    });

    return interviews.map(interview => ({
      interviewId: interview.id,
      businessName: interview.business.name,
      customerName: interview.customer?.name || 'Anonymous',
      customerEmail: interview.customer?.email || '',
      startedAt: interview.startedAt,
      completedAt: interview.completedAt,
      status: interview.status,
      sentimentScore: interview.sentimentScore,
      messageCount: interview.messageCount,
      durationSeconds: interview.durationSeconds,
      finalAction: interview.finalAction,
      deviceType: interview.deviceType,
      languageCode: interview.languageCode,
      reviewCompleted: interview.reviewRequest?.status === 'completed'
    }));
  }

  async function getRealtimeData(businessId: string, startDate: Date, endDate: Date) {
    const [activeInterviews, recentCompletions, avgResponseTime] = await Promise.all([
      prisma.interview.count({
        where: {
          status: 'active',
          ...(businessId !== 'all' && { businessId })
        }
      }),
      prisma.interview.count({
        where: {
          completedAt: { gte: startDate, lte: endDate },
          ...(businessId !== 'all' && { businessId })
        }
      }),
      prisma.conversationMessage.aggregate({
        where: {
          timestamp: { gte: startDate, lte: endDate },
          sender: 'ai',
          responseTimeMs: { not: null },
          ...(businessId !== 'all' && { 
            interview: { businessId }
          })
        },
        _avg: { responseTimeMs: true }
      })
    ]);

    return {
      activeInterviews,
      recentCompletions,
      averageResponseTime: (avgResponseTime._avg.responseTimeMs || 0) / 1000,
      timestamp: new Date().toISOString()
    };
  }

  function convertToCSV(data: any[]): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          if (value === null || value === undefined) return '';
          if (typeof value === 'string' && value.includes(',')) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      )
    ];

    return csvRows.join('\n');
  }
}