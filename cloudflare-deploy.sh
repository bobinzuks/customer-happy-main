#!/bin/bash

# GSurveyAI - Cloudflare Deployment Script
echo "🚀 Starting GSurveyAI Cloudflare Deployment..."

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "📦 Installing Wrangler CLI..."
    npm install -g wrangler
fi

# Login to Cloudflare (will open browser)
echo "🔐 Logging into Cloudflare..."
wrangler login

# Create D1 database
echo "🗄️ Creating D1 database..."
wrangler d1 create gsurveyai-db

# Create KV namespace for caching
echo "💾 Creating KV namespace..."
wrangler kv:namespace create CACHE
wrangler kv:namespace create CACHE --preview

# Set environment secrets
echo "🔑 Setting up secrets..."
echo "Please enter your OpenAI API key:"
wrangler secret put OPENAI_API_KEY

echo "Please enter your Groq API key:"
wrangler secret put GROQ_API_KEY

echo "Please enter your Stripe secret key:"
wrangler secret put STRIPE_SECRET_KEY

echo "Please enter your JWT secret (or press enter for auto-generated):"
wrangler secret put JWT_SECRET

# Deploy the application
echo "🚀 Deploying to Cloudflare Workers..."
npm run build
wrangler deploy

# Add custom domain
echo "🌐 Adding custom domain..."
wrangler custom-domains add gsurveyai.com
wrangler custom-domains add www.gsurveyai.com

echo "✅ Deployment complete!"
echo "🌍 Your app will be available at:"
echo "   - https://gsurveyai.com"
echo "   - https://www.gsurveyai.com"
echo ""
echo "⚠️  Note: DNS propagation may take 24-48 hours"
echo "📊 Monitor deployment at: https://dash.cloudflare.com"