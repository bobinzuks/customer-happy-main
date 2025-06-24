# Using Requesty.ai with GSurveyAI

## Overview
Requesty.ai provides unified access to multiple AI models through a single API key, often at better prices than direct API access.

## Setup Instructions

### 1. Get Your Requesty API Key
- Login to https://www.requesty.ai/
- Navigate to API Keys section
- Copy your API key

### 2. Configure Railway Environment Variables

Add these to your Railway project:

```bash
# Requesty Configuration
OPENAI_API_KEY=your_requesty_api_key_here
OPENAI_API_BASE=https://api.requesty.ai/v1

# Choose your preferred model (check Requesty for available models)
AI_MODEL=gpt-4o-mini  # or claude-3-sonnet, llama-2-70b, etc.

# Other required variables
JWT_SECRET=your-secret-here
FRONTEND_URL=https://gsurveyai.pages.dev
```

### 3. Available Models on Requesty

Check your Requesty dashboard for current models and pricing. Common options:

**OpenAI Models:**
- `gpt-4o-mini` - Cheapest, good for interviews
- `gpt-4o` - More expensive, better quality
- `gpt-3.5-turbo` - Fast and affordable

**Anthropic Models:**
- `claude-3-haiku` - Fast and cheap
- `claude-3-sonnet` - Balanced
- `claude-3-opus` - Highest quality

**Open Source Models:**
- `llama-3-8b` - Often cheapest
- `mixtral-8x7b` - Good quality/price ratio
- `gemma-7b` - Google's efficient model

### 4. Cost Optimization Tips

1. **Start with cheaper models**: Try `gpt-4o-mini` or `claude-3-haiku`
2. **Monitor usage**: Check Requesty dashboard for usage stats
3. **Set limits**: Configure monthly spending limits in Requesty
4. **Use caching**: Our app caches responses to reduce API calls

### 5. Testing Your Setup

After configuring Railway:

1. Restart your Railway app
2. Check logs for successful initialization
3. Test an interview at https://gsurveyai.pages.dev
4. Monitor Requesty dashboard for API calls

### 6. Troubleshooting

**If interviews fail:**
- Check Railway logs for API errors
- Verify API key is correct
- Ensure you have credits in Requesty
- Try a different model

**Error messages:**
- "Invalid API key" - Check OPENAI_API_KEY variable
- "Model not found" - Change AI_MODEL to supported model
- "Rate limited" - Add credits or upgrade Requesty plan

## Recommended Configuration for Lowest Cost

```bash
OPENAI_API_KEY=your_requesty_key
OPENAI_API_BASE=https://api.requesty.ai/v1
AI_MODEL=gpt-4o-mini  # or llama-3-8b for even cheaper
```

This should give you:
- ~$0.0002 per interview (with gpt-4o-mini)
- Even cheaper with open source models
- Automatic fallbacks if a model is unavailable