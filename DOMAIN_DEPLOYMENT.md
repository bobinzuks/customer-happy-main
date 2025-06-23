# GSurveyAI Domain & Deployment Guide

## ✅ DOMAIN: gsurveyai.com

### Namecheap Registration Steps:
1. Login to Namecheap account
2. Search "gsurveyai.com" 
3. Add to cart ($14.98/year)
4. Enable free WHOIS privacy ✅
5. Complete purchase

### Cloudflare Setup (After Domain Registration):
1. **Add Domain to Cloudflare:**
   - Go to dash.cloudflare.com
   - Click "Add Site"
   - Enter: gsurveyai.com
   - Choose Free plan

2. **Update Nameservers at Namecheap:**
   - Cloudflare will provide 2 nameservers
   - Go to Namecheap → Domain List → Manage
   - Change nameservers to Cloudflare's

3. **DNS Configuration:**
   ```
   Type: A
   Name: gsurveyai.com
   Content: [Cloudflare Workers IP]
   
   Type: CNAME  
   Name: www
   Content: gsurveyai.com
   ```

4. **SSL/TLS Settings:**
   - Set encryption to "Full (Strict)"
   - Enable "Always Use HTTPS"
   - Wait 15-24 hours for full activation

### Project Deployment:
```bash
# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Deploy
wrangler deploy

# Add custom domain
wrangler custom-domains add gsurveyai.com
```

### Social Media Registration Checklist:
- [ ] Instagram: @gsurveyai
- [ ] Twitter/X: @gsurveyai
- [ ] LinkedIn: linkedin.com/company/gsurveyai
- [ ] GitHub: github.com/gsurveyai
- [ ] YouTube: youtube.com/@gsurveyai
- [ ] Facebook: facebook.com/gsurveyai
- [ ] TikTok: @gsurveyai

### Post-Deployment:
- [ ] Test domain resolution
- [ ] Verify SSL certificate
- [ ] Update GitHub repository with new domain
- [ ] Update all marketing materials
- [ ] Set up Google Analytics for gsurveyai.com