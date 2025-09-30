# Portfolio API

Enhanced Serverless API for Ahmed Hazem's Portfolio Chatbot with RAG (Retrieval-Augmented Generation) capabilities using Google Gemini.

## Features

- **Dynamic Web Scraping**: Automatically scrapes content from your portfolio website
- **RAG Implementation**: Uses Gemini's text embeddings and similarity search for contextually relevant responses
- **Intelligent Caching**: Caches scraped content and embeddings for optimal performance
- **Unified Gemini Integration**: Uses Gemini for both chat generation and text embeddings
- **Multi-language Support**: Detects and responds in Arabic or English

## Deployment to Netlify

1. Create a new repository with this API code
2. Connect to Netlify
3. Add environment variable: `GEMINI_API_KEY`
4. Deploy

## Environment Variables

- `GEMINI_API_KEY`: Your Google Gemini API key from [Google AI Studio](https://ai.google.dev/)

## API Endpoint

- `POST /api/chat`
- Body: `{ "message": "your question", "history": [...] }`
- Response: `{ "reply": "assistant response", "debug": {...} }`

## How It Works

1. **First Request**: Scrapes your portfolio website and creates vector embeddings using Gemini
2. **Query Processing**: Finds the most relevant content chunks using Gemini's embedding similarity search
3. **Response Generation**: Gemini generates contextually accurate responses using RAG
4. **Caching**: Results are cached for 1 hour to optimize performance

## Portfolio URL

The bot automatically scrapes content from: `https://ahmed-hazem-1.github.io/Ahmed-Hazem-Portfolio/`

## Technical Details

- Uses Google's `text-embedding-004` model for vector embeddings
- Implements cosine similarity for relevance scoring
- Text chunking with configurable chunk size and overlap
- In-memory caching with TTL (Time To Live) mechanism
- Unified API using only Gemini (no OpenAI dependency)
