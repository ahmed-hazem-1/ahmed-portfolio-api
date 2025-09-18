# Portfolio API

Enhanced Serverless API for Ahmed Hazem's Portfolio Chatbot with RAG (Retrieval-Augmented Generation) capabilities.

## Features

- **Dynamic Web Scraping**: Automatically scrapes content from your portfolio website
- **RAG Implementation**: Uses vector embeddings and similarity search for contextually relevant responses
- **Intelligent Caching**: Caches scraped content and embeddings for optimal performance
- **Gemini API Integration**: Powered by Google's Gemini 1.5 Flash for natural language generation
- **Multi-language Support**: Detects and responds in Arabic or English

## Deployment to Vercel

1. Create a new repository with this API code
2. Connect to Vercel
3. Add environment variables:
   - `GEMINI_API_KEY`: Your Google Gemini API key
   - `OPENAI_API_KEY`: Your OpenAI API key (for embeddings)
4. Deploy

## Environment Variables

- `GEMINI_API_KEY`: Your Google Gemini API key from [Google AI Studio](https://ai.google.dev/)
- `OPENAI_API_KEY`: Your OpenAI API key for text embeddings

## API Endpoint

- `POST /api/chat`
- Body: `{ "message": "your question", "history": [...] }`
- Response: `{ "reply": "assistant response", "debug": {...} }`

## How It Works

1. **First Request**: Scrapes your portfolio website and creates vector embeddings
2. **Query Processing**: Finds the most relevant content chunks using similarity search
3. **Response Generation**: Gemini generates contextually accurate responses using RAG
4. **Caching**: Results are cached for 1 hour to optimize performance

## Portfolio URL

The bot automatically scrapes content from: `https://ahmed-hazem-1.github.io/Ahmed-Hazem-Portfolio/`

## Technical Details

- Uses OpenAI's `text-embedding-3-small` model for vector embeddings
- Implements cosine similarity for relevance scoring
- Text chunking with configurable chunk size and overlap
- In-memory caching with TTL (Time To Live) mechanism
