// Minimal GSurveyAI Server for Railway
const fastify = require('fastify')({ 
  logger: true,
  trustProxy: true
});

// CORS
fastify.register(require('@fastify/cors'), {
  origin: [
    'https://gsurveyai.pages.dev',
    'https://gsurveyai.com',
    'https://www.gsurveyai.com'
  ],
  credentials: true
});

// Static files
fastify.register(require('@fastify/static'), {
  root: require('path').join(__dirname, 'public'),
  prefix: '/'
});

// Health check
fastify.get('/api/health', async (request, reply) => {
  return { status: 'healthy', timestamp: new Date().toISOString() };
});

// Start interview endpoint
fastify.post('/api/interview/start', async (request, reply) => {
  const { businessId, languageCode, deviceType } = request.body;
  
  return {
    sessionId: `session_${Date.now()}`,
    interviewId: `interview_${Date.now()}`,
    businessName: 'Demo Business',
    businessSettings: {
      primaryColor: '#007AFF',
      industry: 'Service'
    },
    welcomeMessage: 'Hi! Thanks for taking a moment to share your experience. How was everything overall?'
  };
});

// Interview message endpoint
fastify.post('/api/interview/:sessionId/message', async (request, reply) => {
  const { message } = request.body;
  const { sessionId } = request.params;
  
  // Simple AI responses for testing
  const responses = [
    "That's really helpful feedback! Could you tell me more about what stood out to you?",
    "I appreciate you sharing that. What aspect was most important to you?",
    "Thank you for the details. How did that experience make you feel?",
    "That's valuable insight. Is there anything specific you'd like to see improved?",
    "I understand. Would you mind sharing what led to that impression?"
  ];
  
  const randomResponse = responses[Math.floor(Math.random() * responses.length)];
  
  return {
    id: `msg_${Date.now()}`,
    sender: 'ai',
    content: randomResponse,
    timestamp: new Date().toISOString(),
    sentiment: 'Neutral'
  };
});

// Complete interview endpoint
fastify.post('/api/interview/:sessionId/complete', async (request, reply) => {
  return {
    success: true,
    interviewId: request.params.sessionId,
    googleReviewUrl: 'https://g.page/demo-business/review',
    message: 'Thank you for your valuable feedback!'
  };
});

// Start server
const start = async () => {
  try {
    const port = process.env.PORT || 3000;
    const host = process.env.HOST || '0.0.0.0';
    
    await fastify.listen({ port, host });
    console.log(`GSurveyAI server running on port ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();