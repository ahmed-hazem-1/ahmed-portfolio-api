// Enhanced Serverless API route: POST /api/chat
// Uses Google Generative Language API (Gemini 1.5 Flash) with dynamic web scraping and RAG
// Implements Retrieval-Augmented Generation for better portfolio-specific responses

const cheerio = require('cheerio');

const SYSTEM_PROMPT = `You are "Ahmed's Assistant", the official chatbot for Ahmed Hazem Elabady's portfolio (Junior Data Scientist, Cairo, Egypt).
Only answer questions about Ahmed's portfolio: about, skills, experience, education, projects, certificates, and contact.
If a question is unrelated, politely decline and steer back to the portfolio.
When answering, use the provided context from the portfolio. If some detail isn't present, say you don't have that info and suggest checking relevant sections.
Be concise, friendly, and professional. Detect the user's language (Arabic/English) and respond accordingly.`;

// Cache for scraped content and embeddings
let portfolioCache = {
  content: null,
  chunks: null,
  embeddings: null,
  lastUpdated: null
};

// Cache duration: 1 hour
const CACHE_DURATION = 60 * 60 * 1000;

/**
 * Scrape content from Ahmed's portfolio website
 */
async function scrapePortfolio() {
  const fetch = (await import('node-fetch')).default;
  const baseUrl = 'https://ahmed-hazem-1.github.io/Ahmed-Hazem-Portfolio/';
  
  try {
    console.log('Scraping portfolio content...');
    const response = await fetch(baseUrl);
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Extract structured content
    const content = {
      about: '',
      skills: '',
      experience: '',
      education: '',
      projects: '',
      certificates: '',
      contact: ''
    };
    
    // Extract About section
    const aboutSection = $('#about');
    if (aboutSection.length) {
      content.about = aboutSection.text().trim();
    }
    
    // Extract Skills section
    const skillsSection = $('#skills');
    if (skillsSection.length) {
      content.skills = skillsSection.text().trim();
    }
    
    // Extract Experience section
    const experienceSection = $('#experience');
    if (experienceSection.length) {
      content.experience = experienceSection.text().trim();
    }
    
    // Extract Education section
    const educationSection = $('#education');
    if (educationSection.length) {
      content.education = educationSection.text().trim();
    }
    
    // Extract Projects section
    const projectsSection = $('#projects');
    if (projectsSection.length) {
      content.projects = projectsSection.text().trim();
    }
    
    // Extract Certificates section
    const certificatesSection = $('#certificates');
    if (certificatesSection.length) {
      content.certificates = certificatesSection.text().trim();
    }
    
    // Extract Contact section
    const contactSection = $('#contact');
    if (contactSection.length) {
      content.contact = contactSection.text().trim();
    }
    
    // Also extract general content as fallback
    const mainContent = $('main, .container, body').first().text().trim();
    
    return {
      structured: content,
      fullContent: mainContent,
      timestamp: Date.now()
    };
    
  } catch (error) {
    console.error('Error scraping portfolio:', error);
    // Fallback to static content
    return {
      structured: {
        about: "Ahmed Hazem Elabady - Junior Data Scientist from Cairo, Egypt",
        skills: "Python, Machine Learning, Data Analysis, Web Scraping, Computer Vision",
        experience: "Computer Vision Trainee at NTI, AI & Data Science Trainee at DEPI",
        education: "B.Sc. Computer Science and Artificial Intelligence at Benha Faculty",
        projects: "Waste Detection using YOLO, Land Type Classification, COVID-19 X-ray Detection",
        certificates: "NVIDIA Deep Learning, ITIDA Innovation",
        contact: "ahmed.hazem.elabady@gmail.com, +20 127 5012 177"
      },
      fullContent: "Ahmed Hazem Elabady portfolio content",
      timestamp: Date.now()
    };
  }
}

/**
 * Split text into chunks for better retrieval
 */
function splitIntoChunks(content, chunkSize = 500, overlap = 50) {
  const chunks = [];
  
  // Process structured content
  for (const [section, text] of Object.entries(content.structured)) {
    if (text && text.length > 0) {
      const sectionChunks = splitText(text, chunkSize, overlap);
      sectionChunks.forEach(chunk => {
        chunks.push({
          content: chunk,
          section: section,
          type: 'structured'
        });
      });
    }
  }
  
  // Process full content as additional chunks
  const fullChunks = splitText(content.fullContent, chunkSize, overlap);
  fullChunks.forEach(chunk => {
    chunks.push({
      content: chunk,
      section: 'general',
      type: 'full'
    });
  });
  
  return chunks;
}

function splitText(text, chunkSize, overlap) {
  const chunks = [];
  let start = 0;
  
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end);
    
    if (chunk.trim().length > 0) {
      chunks.push(chunk.trim());
    }
    
    start = end - overlap;
    if (start >= text.length) break;
  }
  
  return chunks;
}

/**
 * Generate embeddings using OpenAI's text-embedding-3-small model
 */
async function generateEmbeddings(chunks, apiKey) {
  const fetch = (await import('node-fetch')).default;
  
  try {
    const texts = chunks.map(chunk => chunk.content);
    
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: texts,
        model: 'text-embedding-3-small'
      })
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.data.map(item => item.embedding);
    
  } catch (error) {
    console.error('Error generating embeddings:', error);
    // Return dummy embeddings as fallback
    return chunks.map(() => new Array(1536).fill(0));
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Find relevant chunks based on query similarity
 */
async function findRelevantChunks(query, chunks, embeddings, openaiApiKey, topK = 3) {
  const fetch = (await import('node-fetch')).default;
  
  try {
    // Generate embedding for the query
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: query,
        model: 'text-embedding-3-small'
      })
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }
    
    const data = await response.json();
    const queryEmbedding = data.data[0].embedding;
    
    // Calculate similarities and get top chunks
    const similarities = embeddings.map((embedding, index) => ({
      index,
      similarity: cosineSimilarity(queryEmbedding, embedding),
      chunk: chunks[index]
    }));
    
    // Sort by similarity and return top K
    similarities.sort((a, b) => b.similarity - a.similarity);
    return similarities.slice(0, topK);
    
  } catch (error) {
    console.error('Error finding relevant chunks:', error);
    // Fallback: return first few chunks
    return chunks.slice(0, topK).map((chunk, index) => ({
      index,
      similarity: 0.5,
      chunk
    }));
  }
}

module.exports = async function handler(req, res) {
  // CORS headers
  const allowedOrigins = [
    'https://ahmed-hazem-1.github.io',
    'http://127.0.0.1:5501',
    'http://localhost:5501',
    'http://127.0.0.1:5500',
    'http://localhost:5500'
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://ahmed-hazem-1.github.io');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { message, history } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Missing "message" string' });
    }
    
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const openaiApiKey = process.env.OPENAI_API_KEY;
    
    if (!geminiApiKey) {
      return res.status(500).json({ error: 'Server is not configured with GEMINI_API_KEY' });
    }
    
    if (!openaiApiKey) {
      return res.status(500).json({ error: 'Server is not configured with OPENAI_API_KEY' });
    }

    // Check cache validity
    const now = Date.now();
    const cacheValid = portfolioCache.content && 
                      portfolioCache.lastUpdated && 
                      (now - portfolioCache.lastUpdated) < CACHE_DURATION;

    if (!cacheValid) {
      console.log('Cache invalid, refreshing portfolio content...');
      
      // Scrape fresh content
      const scrapedContent = await scrapePortfolio();
      
      // Split into chunks
      const chunks = splitIntoChunks(scrapedContent);
      
      // Generate embeddings
      const embeddings = await generateEmbeddings(chunks, openaiApiKey);
      
      // Update cache
      portfolioCache = {
        content: scrapedContent,
        chunks: chunks,
        embeddings: embeddings,
        lastUpdated: now
      };
      
      console.log(`Portfolio content cached with ${chunks.length} chunks`);
    }

    // Find relevant content chunks for the user's query
    const relevantChunks = await findRelevantChunks(
      message, 
      portfolioCache.chunks, 
      portfolioCache.embeddings, 
      openaiApiKey,
      3 // Get top 3 most relevant chunks
    );

    // Prepare context from relevant chunks
    const contextParts = relevantChunks.map(item => 
      `[${item.chunk.section}]: ${item.chunk.content}`
    );
    const retrievedContext = contextParts.join('\n\n');

    console.log(`Using ${relevantChunks.length} relevant chunks for context`);

    // Use dynamic import for fetch
    const fetch = (await import('node-fetch')).default;

    // Prepare Gemini API request with RAG context
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
    const payload = {
      systemInstruction: { role: 'system', parts: [{ text: SYSTEM_PROMPT }] },
      contents: [
        { role: 'user', parts: [{ text: `Relevant portfolio context:\n${retrievedContext}` }] },
        // Include previous chat history if available
        ...(history || []).map(entry => ({
          role: entry.role === 'user' ? 'user' : 'model',
          parts: [{ text: entry.parts[0].text }]
        })),
        { role: 'user', parts: [{ text: `User question: ${message}` }] }
      ]
    };
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': geminiApiKey
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error', response.status, errorText);
      return res.status(502).json({ error: 'Gemini API error', status: response.status });
    }
    
    const data = await response.json();
    const candidates = data?.candidates || [];
    const parts = candidates[0]?.content?.parts || [];
    const reply = parts.map(p => p.text || '').join('\n').trim();
    
    return res.status(200).json({ 
      reply,
      debug: {
        chunksUsed: relevantChunks.length,
        cacheAge: Math.round((now - portfolioCache.lastUpdated) / 1000 / 60) // minutes
      }
    });
    
  } catch (err) {
    console.error('Chat API error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};