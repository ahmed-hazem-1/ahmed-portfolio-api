# Portfolio API

Serverless API for Ahmed Hazem's Portfolio Chatbot.

## Deployment to Vercel

1. Create a new repository with just this API code
2. Connect to Vercel
3. Add environment variable: `GEMINI_API_KEY`
4. Deploy

## Environment Variables

- `GEMINI_API_KEY`: Your Google Gemini API key

## API Endpoint

- `POST /api/chat`
- Body: `{ "message": "your question" }`
- Response: `{ "reply": "assistant response" }`
