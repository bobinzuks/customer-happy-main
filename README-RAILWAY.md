# Deploy GSurveyAI Backend to Railway

## One-Click Deploy

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/deploy?template=https://github.com/bobinzuks/customer-happy-main)

## Manual Deploy Steps

1. **Create Railway Account**
   - Go to [railway.app](https://railway.app)
   - Sign up with GitHub

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose: `bobinzuks/customer-happy-main`

3. **Add PostgreSQL Database**
   - Click "New" → "Database" → "Add PostgreSQL"
   - Railway will automatically set DATABASE_URL

4. **Add Redis**
   - Click "New" → "Database" → "Add Redis"
   - Railway will automatically set REDIS_URL

5. **Configure Environment Variables**
   Click "Variables" and add:
   ```
   # AI Services (Required)
   OPENAI_API_KEY=your_openai_key
   GROQ_API_KEY=your_groq_key
   
   # Auth (Required)
   JWT_SECRET=generate_random_secret_here
   
   # Frontend URL
   FRONTEND_URL=https://gsurveyai.com
   
   # Optional Services
   STRIPE_SECRET_KEY=your_stripe_key
   ```

6. **Deploy**
   - Railway will auto-deploy from GitHub
   - Get your backend URL: `https://your-app.railway.app`

## Post-Deployment

1. **Update Frontend API URL**
   - Update your frontend to point to Railway backend URL
   - Redeploy frontend on Cloudflare Pages

2. **Database Migrations**
   ```bash
   railway run npm run db:push
   railway run npm run db:seed
   ```

3. **Custom Domain (Optional)**
   - Add custom domain: `api.gsurveyai.com`
   - Configure in Railway settings

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| DATABASE_URL | Auto | PostgreSQL connection (auto-set) |
| REDIS_URL | Auto | Redis connection (auto-set) |
| OPENAI_API_KEY | Yes | OpenAI API key |
| GROQ_API_KEY | Yes | Groq API key |
| JWT_SECRET | Yes | JWT signing secret |
| FRONTEND_URL | Yes | Your frontend URL |
| STRIPE_SECRET_KEY | No | Stripe payment key |
| PORT | Auto | Server port (auto-set) |

## Monitoring

- View logs: Railway dashboard → Deployments → View Logs
- Monitor usage: Railway dashboard → Usage
- Set up alerts: Railway dashboard → Settings → Notifications