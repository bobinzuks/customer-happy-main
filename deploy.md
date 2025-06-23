# CustomerHappy - Cloudflare Deployment Guide

## Prerequisites
1. Install Wrangler CLI: `npm install -g wrangler`
2. Authenticate: `wrangler login`
3. Purchase domain: `customerhappy.com` (recommended)

## Database Setup
```bash
# Create D1 database
wrangler d1 create customer-happy-db

# Update wrangler.toml with the returned database_id
# Run migrations
wrangler d1 migrations create initial-schema
wrangler d1 migrations apply --remote

# Create KV namespace for caching
wrangler kv:namespace create CACHE
wrangler kv:namespace create CACHE --preview
```

## Environment Variables
```bash
# Set secrets
wrangler secret put OPENAI_API_KEY
wrangler secret put GROQ_API_KEY
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put JWT_SECRET
```

## Deploy to Production
```bash
# Build and deploy
npm run build
wrangler deploy

# Add custom domain (after purchasing)
wrangler custom-domains add customerhappy.com
```

## Post-Deployment
- Set up DNS in Cloudflare dashboard
- Configure SSL/TLS settings
- Set up monitoring and analytics
- Test all endpoints and functionality