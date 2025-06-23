# CustomerHappy - AI-Powered Customer Interview SaaS

A complete, production-ready SaaS platform that uses AI to conduct customer interviews, analyze sentiment, and facilitate Google-compliant review collection. Built with TypeScript, Fastify, Prisma, and modern web technologies.

## 🚀 Features

### Core Platform
- **AI-Powered Interviews**: Sub-500ms response times using Groq LPU and OpenAI
- **Google-Compliant Review System**: FTC and Google policy compliant review collection
- **Mobile-First PWA**: Progressive Web App with offline support and voice input
- **Real-Time Analytics**: Live dashboard with WebSocket updates
- **Multi-Language Support**: 25+ languages with automatic translation
- **Voice Input**: Web Speech API integration for mobile users

### Business Features
- **Subscription Management**: Tiered pricing with usage tracking
- **White-Label Solutions**: Custom branding for enterprise clients
- **Compliance Monitoring**: Automated audit trails and reporting
- **API Access**: RESTful API for integrations
- **Advanced Analytics**: Sentiment analysis, conversion tracking, response time monitoring

### Technical Features
- **Edge Computing**: Global deployment with CDN and edge functions
- **Auto-Scaling**: Kubernetes-ready with horizontal pod autoscaling
- **Security**: SOC 2 compliant with GDPR support
- **Real-Time Updates**: WebSocket connections for live data
- **Offline Support**: Service worker with background sync

## 🏗️ Architecture

### Tech Stack
- **Backend**: TypeScript, Fastify, Prisma ORM
- **Database**: PostgreSQL with TimescaleDB for time-series data
- **Cache**: Redis for session management and caching
- **AI**: Groq LPU, OpenAI GPT-4o-mini for fast inference
- **Frontend**: Vanilla JS PWA with Chart.js for analytics
- **Infrastructure**: Docker, Kubernetes, Nginx

### Project Structure
```
customer-happy/
├── src/
│   ├── api/           # API routes and handlers
│   ├── services/      # Business logic services
│   ├── lib/           # Utility libraries
│   ├── types/         # TypeScript type definitions
│   ├── config/        # Configuration files
│   └── server.ts      # Main server entry point
├── public/            # Static frontend files
│   ├── js/            # JavaScript applications
│   ├── css/           # Stylesheets
│   └── assets/        # Images and icons
├── prisma/            # Database schema and migrations
├── docker/            # Docker configuration
└── k8s/               # Kubernetes manifests
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 13+
- Redis 6+
- OpenAI API key
- Groq API key

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/your-org/customer-happy.git
cd customer-happy
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Set up the database**
```bash
npm run db:generate
npm run db:push
npm run db:seed
```

5. **Start development server**
```bash
npm run dev
```

Visit http://localhost:3000 to see the application.

### Docker Deployment

1. **Build and run with Docker Compose**
```bash
docker-compose up -d
```

2. **Access the application**
- Application: http://localhost:3000
- Dashboard: http://localhost:3000/dashboard
- API Health: http://localhost:3000/health

## 📊 Pricing Tiers

| Feature | Starter ($49/mo) | Professional ($149/mo) | Enterprise ($399/mo) |
|---------|------------------|------------------------|----------------------|
| Locations | 1 | 3 | Unlimited |
| Interviews/month | 500 | 2,000 | Unlimited |
| AI Response Speed | <1s | <500ms | <300ms |
| Languages | 2 | 5 | 25+ |
| Analytics | Basic | Advanced | Enterprise |
| API Access | ❌ | ✅ | ✅ |
| White-label | ❌ | ❌ | ✅ |

## 🔧 Configuration

### Environment Variables

```bash
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/customer_happy"

# AI Services  
OPENAI_API_KEY="sk-..."
GROQ_API_KEY="gsk_..."

# Authentication
JWT_SECRET="your-secret-key"

# Server
PORT=3000
NODE_ENV="production"
```

### Feature Flags

```bash
ENABLE_VOICE_INPUT=true
ENABLE_MULTI_LANGUAGE=true
ENABLE_ANALYTICS=true
ENABLE_COMPLIANCE_MONITORING=true
```

## 🌐 API Reference

### Authentication
```bash
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
```

### Interviews
```bash
POST /api/interview/start
POST /api/interview/:sessionId/message
GET  /api/interview/:sessionId/stream
POST /api/interview/:sessionId/complete
```

### Dashboard
```bash
GET /api/dashboard/kpis
GET /api/dashboard/charts
GET /api/dashboard/activity
GET /api/dashboard/export
```

## 🔒 Security & Compliance

### Google Review Compliance
- **Equal Opportunity**: All customers see review options regardless of sentiment
- **No Gating**: No filtering based on star ratings or feedback
- **Audit Trails**: Complete logging for compliance reporting
- **FTC Compliant**: No conditional incentives or biased solicitation

### Security Features
- JWT authentication with secure token management
- Rate limiting on all endpoints
- Input validation and sanitization
- SQL injection protection via Prisma ORM
- XSS protection with CSP headers
- HTTPS enforcement in production

## 📈 Performance

### Benchmarks
- **AI Response Time**: <300ms (95th percentile)
- **API Latency**: <100ms (95th percentile)
- **Database Queries**: <50ms average
- **PWA Load Time**: <2s on 3G networks

### Scaling
- **Horizontal**: Auto-scaling pods based on CPU/memory
- **Database**: Read replicas and connection pooling
- **Cache**: Redis cluster for high availability
- **CDN**: Global edge caching for static assets

## 🧪 Testing

```bash
# Run all tests
npm run test

# Run with coverage
npm run test:coverage

# Run specific test suite
npm run test -- --testNamePattern="Interview"

# E2E testing
npm run test:e2e
```

## 📦 Deployment

### Production Checklist
- [ ] Set strong JWT_SECRET
- [ ] Configure database connection pooling
- [ ] Set up Redis cluster
- [ ] Enable HTTPS with SSL certificates
- [ ] Configure monitoring and logging
- [ ] Set up backup strategy
- [ ] Configure rate limiting
- [ ] Enable security headers

### Kubernetes Deployment
```bash
# Apply manifests
kubectl apply -f k8s/

# Check status
kubectl get pods -n customer-happy

# View logs
kubectl logs -f deployment/customer-happy-api
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Use TypeScript for all new code
- Follow the existing code style
- Add tests for new features
- Update documentation as needed
- Ensure all tests pass before submitting

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [docs.customerhappy.ai](https://docs.customerhappy.ai)
- **Discord**: [Join our community](https://discord.gg/customerhappy)
- **Email**: support@customerhappy.ai
- **Issues**: [GitHub Issues](https://github.com/your-org/customer-happy/issues)

## 🗺️ Roadmap

### Q1 2024
- [ ] Advanced sentiment analysis with emotion detection
- [ ] Integration with major CRM platforms
- [ ] Multi-tenant architecture improvements
- [ ] Mobile app for business owners

### Q2 2024
- [ ] Video interview capabilities
- [ ] Advanced AI models for industry-specific interviews
- [ ] Marketplace for interview templates
- [ ] Advanced compliance features

### Q3 2024
- [ ] Machine learning for predictive analytics
- [ ] Integration with review platforms beyond Google
- [ ] Advanced white-label customization
- [ ] Enterprise SSO support

---

**Built with ❤️ by the CustomerHappy team**

*Transforming customer feedback into business growth through AI-powered conversations.*