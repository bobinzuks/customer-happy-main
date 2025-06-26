// Ultra Simple GSurveyAI Server for Railway
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const port = process.env.PORT || 3000;

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400'
};

// Serve static files
function serveStatic(req, res, filePath) {
  const fullPath = path.join(__dirname, 'public', filePath);
  
  fs.readFile(fullPath, (err, data) => {
    if (err) {
      res.writeHead(404, corsHeaders);
      res.end('Not Found');
      return;
    }
    
    const ext = path.extname(filePath);
    let contentType = 'text/html';
    
    if (ext === '.js') contentType = 'application/javascript';
    else if (ext === '.css') contentType = 'text/css';
    else if (ext === '.json') contentType = 'application/json';
    
    res.writeHead(200, { ...corsHeaders, 'Content-Type': contentType });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  
  console.log(`${req.method} ${pathname} - Origin: ${req.headers.origin}`);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200, corsHeaders);
    res.end();
    return;
  }
  
  // API Routes
  if (pathname === '/api/health' && req.method === 'GET') {
    res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy', timestamp: new Date().toISOString() }));
    return;
  }
  
  if (pathname === '/api/interview/start' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const response = {
        sessionId: `session_${Date.now()}`,
        interviewId: `interview_${Date.now()}`,
        businessName: 'Demo Business',
        businessSettings: {
          primaryColor: '#007AFF',
          industry: 'Service'
        },
        welcomeMessage: 'Hi! Thanks for taking a moment to share your experience. How was everything overall?'
      };
      
      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
    });
    return;
  }
  
  if (pathname.startsWith('/api/interview/') && pathname.endsWith('/message') && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const responses = [
        "That's really helpful feedback! Could you tell me more about what stood out to you?",
        "I appreciate you sharing that. What aspect was most important to you?",
        "Thank you for the details. How did that experience make you feel?",
        "That's valuable insight. Is there anything specific you'd like to see improved?",
        "I understand. Would you mind sharing what led to that impression?"
      ];
      
      const randomResponse = responses[Math.floor(Math.random() * responses.length)];
      
      const response = {
        id: `msg_${Date.now()}`,
        sender: 'ai',
        content: randomResponse,
        timestamp: new Date().toISOString(),
        sentiment: 'Neutral'
      };
      
      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
    });
    return;
  }
  
  if (pathname.startsWith('/api/interview/') && pathname.endsWith('/complete') && req.method === 'POST') {
    const response = {
      success: true,
      interviewId: pathname.split('/')[3],
      googleReviewUrl: 'https://g.page/demo-business/review',
      message: 'Thank you for your valuable feedback!'
    };
    
    res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
    return;
  }
  
  // Handle unknown API routes
  if (pathname.startsWith('/api/')) {
    console.log(`Unknown API route: ${req.method} ${pathname}`);
    res.writeHead(404, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'API endpoint not found' }));
    return;
  }
  
  // Serve static files
  if (pathname === '/') {
    serveStatic(req, res, 'index.html');
  } else {
    serveStatic(req, res, pathname.substring(1));
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`GSurveyAI server running on port ${port}`);
});