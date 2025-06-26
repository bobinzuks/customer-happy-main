// Bulletproof GSurveyAI Server for Railway
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const port = process.env.PORT || 3000;

// Enhanced CORS headers for all scenarios
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, HEAD',
  'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range',
  'Access-Control-Max-Age': '1728000', // 20 days
  'Vary': 'Origin'
};

// Utility function to parse JSON body with timeout
function parseBody(req, timeout = 10000) {
  return new Promise((resolve, reject) => {
    let body = '';
    let timeoutId;
    
    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      req.removeAllListeners('data');
      req.removeAllListeners('end');
      req.removeAllListeners('error');
    };
    
    timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error('Request timeout'));
    }, timeout);
    
    req.on('error', (err) => {
      cleanup();
      reject(err);
    });
    
    req.on('data', (chunk) => {
      body += chunk.toString();
      // Prevent oversized requests
      if (body.length > 1e6) { // 1MB limit
        cleanup();
        reject(new Error('Request too large'));
      }
    });
    
    req.on('end', () => {
      cleanup();
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        resolve({}); // Return empty object for invalid JSON
      }
    });
  });
}

// Enhanced response helper
function sendResponse(res, statusCode, data, headers = {}) {
  const allHeaders = { ...corsHeaders, 'Content-Type': 'application/json', ...headers };
  res.writeHead(statusCode, allHeaders);
  res.end(typeof data === 'string' ? data : JSON.stringify(data));
}

// Serve static files
function serveStatic(req, res, filePath) {
  const fullPath = path.join(__dirname, 'public', filePath);
  
  fs.readFile(fullPath, (err, data) => {
    if (err) {
      sendResponse(res, 404, { error: 'File not found' });
      return;
    }
    
    const ext = path.extname(filePath);
    let contentType = 'text/html';
    
    const mimeTypes = {
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2'
    };
    
    contentType = mimeTypes[ext] || contentType;
    
    res.writeHead(200, { ...corsHeaders, 'Content-Type': contentType });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method.toUpperCase();
  
  console.log(`${new Date().toISOString()} - ${method} ${pathname} - Origin: ${req.headers.origin || 'none'} - User-Agent: ${req.headers['user-agent']?.substring(0, 50) || 'none'}`);
  
  try {
    // Handle ALL OPTIONS requests first (most important for CORS)
    if (method === 'OPTIONS') {
      console.log(`CORS Preflight: ${pathname}`);
      sendResponse(res, 204, '');
      return;
    }
    
    // API Routes with enhanced error handling
    if (pathname === '/api/health') {
      if (method !== 'GET') {
        sendResponse(res, 405, { error: 'Method not allowed', allowed: ['GET'] });
        return;
      }
      sendResponse(res, 200, { 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        server: 'bulletproof-v1.0',
        method: method,
        path: pathname
      });
      return;
    }
    
    if (pathname === '/api/interview/start') {
      if (method !== 'POST') {
        sendResponse(res, 405, { error: 'Method not allowed', allowed: ['POST'], received: method });
        return;
      }
      
      try {
        const requestData = await parseBody(req);
        console.log('Interview start request:', requestData);
        
        const response = {
          sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          interviewId: `interview_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          businessName: requestData.businessId ? `Business: ${requestData.businessId}` : 'Demo Business',
          businessSettings: {
            primaryColor: '#007AFF',
            industry: 'Service',
            language: requestData.languageCode || 'en',
            device: requestData.deviceType || 'web'
          },
          welcomeMessage: 'Hi! Thanks for taking a moment to share your experience. How was everything overall?',
          timestamp: new Date().toISOString()
        };
        
        console.log('Interview started successfully:', response.sessionId);
        sendResponse(res, 200, response);
        return;
        
      } catch (error) {
        console.error('Interview start error:', error);
        sendResponse(res, 400, { error: 'Failed to parse request', details: error.message });
        return;
      }
    }
    
    if (pathname.startsWith('/api/interview/') && pathname.endsWith('/message')) {
      if (method !== 'POST') {
        sendResponse(res, 405, { error: 'Method not allowed', allowed: ['POST'] });
        return;
      }
      
      try {
        const requestData = await parseBody(req);
        const sessionId = pathname.split('/')[3];
        
        const responses = [
          "That's really helpful feedback! Could you tell me more about what stood out to you?",
          "I appreciate you sharing that. What aspect was most important to you?",
          "Thank you for the details. How did that experience make you feel?",
          "That's valuable insight. Is there anything specific you'd like to see improved?",
          "I understand. Would you mind sharing what led to that impression?"
        ];
        
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        
        const response = {
          id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          sender: 'ai',
          content: randomResponse,
          timestamp: new Date().toISOString(),
          sentiment: 'Neutral',
          sessionId: sessionId
        };
        
        console.log('Message sent for session:', sessionId);
        sendResponse(res, 200, response);
        return;
        
      } catch (error) {
        console.error('Message error:', error);
        sendResponse(res, 400, { error: 'Failed to process message', details: error.message });
        return;
      }
    }
    
    if (pathname.startsWith('/api/interview/') && pathname.endsWith('/complete')) {
      if (method !== 'POST') {
        sendResponse(res, 405, { error: 'Method not allowed', allowed: ['POST'] });
        return;
      }
      
      const sessionId = pathname.split('/')[3];
      const response = {
        success: true,
        interviewId: sessionId,
        googleReviewUrl: 'https://g.page/demo-business/review',
        message: 'Thank you for your valuable feedback!',
        timestamp: new Date().toISOString()
      };
      
      console.log('Interview completed for session:', sessionId);
      sendResponse(res, 200, response);
      return;
    }
    
    // Handle unknown API routes
    if (pathname.startsWith('/api/')) {
      console.log(`Unknown API route: ${method} ${pathname}`);
      sendResponse(res, 404, { 
        error: 'API endpoint not found', 
        path: pathname,
        method: method,
        available: [
          'GET /api/health',
          'POST /api/interview/start',
          'POST /api/interview/:sessionId/message',
          'POST /api/interview/:sessionId/complete'
        ]
      });
      return;
    }
    
    // Serve static files
    if (pathname === '/') {
      serveStatic(req, res, 'index.html');
    } else {
      serveStatic(req, res, pathname.substring(1));
    }
    
  } catch (error) {
    console.error('Server error:', error);
    sendResponse(res, 500, { error: 'Internal server error', details: error.message });
  }
});

// Enhanced error handling
server.on('error', (error) => {
  console.error('Server error:', error);
});

server.on('clientError', (error, socket) => {
  console.error('Client error:', error);
  if (socket.writable) {
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`🚀 GSurveyAI Bulletproof Server running on port ${port}`);
  console.log(`📊 Health check: http://localhost:${port}/api/health`);
  console.log(`🎯 Interview API: http://localhost:${port}/api/interview/start`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});