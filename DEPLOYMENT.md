# Deployment Instructions for Enhanced Portfolio Chatbot

## Overview
Your chatbot now includes advanced RAG (Retrieval-Augmented Generation) capabilities with dynamic web scraping of your portfolio website.

## API Keys Required

### 1. Google Gemini API Key
1. Visit [Google AI Studio](https://ai.google.dev/)
2. Sign in with your Google account
3. Create a new API key
4. Copy the key for deployment

### 2. OpenAI API Key (for embeddings)
1. Visit [OpenAI Platform](https://platform.openai.com/)
2. Sign in or create an account
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key for deployment

## Netlify Deployment Steps

1. **Push to GitHub**: Ensure your code is in a GitHub repository

2. **Connect to Netlify**:
   - Go to [netlify.com](https://netlify.com)
   - Import your GitHub repository
   - Select the repository containing your API code

3. **Environment Variables**:
   In Netlify dashboard, add these environment variables:
   ```
   GEMINI_API_KEY=your_gemini_api_key_here
   OPENAI_API_KEY=your_openai_api_key_here
   ```

4. **Deploy**: Click deploy and wait for the build to complete

## File Structure
```
api/
├── chat.js (Enhanced version with full RAG)
├── chat-fallback.js (Fallback without OpenAI)
└── chat-enhanced.js (Backup of enhanced version)
```

## Usage Options

### Option 1: Full RAG Implementation (Recommended)
- Uses `chat.js` (current implementation)
- Requires both GEMINI_API_KEY and OPENAI_API_KEY
- Provides best accuracy with vector similarity search

### Option 2: Fallback Implementation
- Rename `chat-fallback.js` to `chat.js` if you don't want to use OpenAI
- Only requires GEMINI_API_KEY
- Uses keyword-based content matching instead of vector embeddings

## Features Implemented

✅ **Dynamic Web Scraping**: Automatically scrapes your portfolio at https://ahmed-hazem-1.github.io/Ahmed-Hazem-Portfolio/
✅ **Text Chunking**: Splits content into manageable pieces for better retrieval
✅ **Vector Embeddings**: Creates semantic embeddings using OpenAI's text-embedding-3-small
✅ **Similarity Search**: Finds most relevant content using cosine similarity
✅ **Intelligent Caching**: Caches content and embeddings for 1 hour
✅ **Fallback System**: Graceful degradation if APIs fail
✅ **CORS Support**: Works with your GitHub Pages frontend

## Testing Your Deployment

1. Get your Netlify deployment URL (e.g., `https://your-app.netlify.app`)
2. Test the API endpoint:
   ```bash
   curl -X POST https://your-app.netlify.app/api/chat \
     -H "Content-Type: application/json" \
     -d '{"message": "What are Ahmed'\''s main skills?"}'
   ```

## Cost Considerations

- **Gemini API**: Has a generous free tier
- **OpenAI Embeddings**: ~$0.00002 per 1K tokens (very affordable)
- **Netlify**: Free tier should be sufficient for personal use

## Portfolio Integration

Update your portfolio's chatbot frontend to use the new Netlify API URL instead of the local endpoint.

## Monitoring

Check Netlify's function logs to monitor:
- Cache hit/miss rates
- API usage
- Error rates
- Response times