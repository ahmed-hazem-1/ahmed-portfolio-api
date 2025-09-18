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
  lastUpdated: null,
  isWarmingUp: false
};

// Cache duration: 1 hour
const CACHE_DURATION = 60 * 60 * 1000;

/**
 * Warm up the cache by pre-loading portfolio data
 */
async function warmUpCache(geminiApiKey) {
  if (portfolioCache.isWarmingUp) {
    console.log('Cache warm-up already in progress...');
    return;
  }

  portfolioCache.isWarmingUp = true;
  console.log('🔥 Starting cache warm-up...');

  try {
    const now = Date.now();
    
    // Scrape fresh content
    console.log('📊 Scraping portfolio content...');
    const scrapedContent = await scrapePortfolio();
    
    // Split into chunks
    const chunks = splitIntoChunks(scrapedContent);
    console.log(`📝 Created ${chunks.length} content chunks`);
    
    // Generate embeddings
    let embeddings = [];
    try {
      console.log('🧠 Generating embeddings with Gemini...');
      embeddings = await generateEmbeddings(chunks, geminiApiKey);
      console.log('✅ Embeddings generated successfully');
    } catch (embeddingError) {
      console.warn('⚠️ Failed to generate embeddings, will use keyword matching:', embeddingError.message);
      embeddings = chunks.map(() => new Array(768).fill(0));
    }
    
    // Update cache
    portfolioCache = {
      content: scrapedContent,
      chunks: chunks,
      embeddings: embeddings,
      lastUpdated: now,
      isWarmingUp: false
    };
    
    console.log(`🎯 Cache warm-up completed! Portfolio ready with ${chunks.length} chunks`);
    
  } catch (error) {
    console.error('❌ Error during cache warm-up:', error);
    portfolioCache.isWarmingUp = false;
    
    // Set fallback content
    const fallbackContent = {
      structured: {
        about: "Ahmed Hazem Elabady - Junior Data Scientist from Cairo, Egypt",
        skills: "Python, Machine Learning, Data Analysis, Web Scraping, Computer Vision",
        projects: "Waste Detection using YOLO, Land Type Classification, COVID-19 X-ray Detection",
        experience: "Computer Vision Trainee at NTI, AI & Data Science Trainee at DEPI"
      },
      fullContent: "Ahmed Hazem Elabady portfolio content",
      timestamp: Date.now()
    };
    
    const fallbackChunks = splitIntoChunks(fallbackContent);
    portfolioCache = {
      content: fallbackContent,
      chunks: fallbackChunks,
      embeddings: fallbackChunks.map(() => new Array(768).fill(0)),
      lastUpdated: Date.now(),
      isWarmingUp: false
    };
    
    console.log('🔄 Using fallback static content');
  }
}

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
function splitIntoChunks(content, chunkSize = 800, overlap = 100) {
  const chunks = [];
  
  // Process structured content first (these are more important)
  const prioritySections = ['about', 'skills', 'projects', 'experience'];
  const otherSections = ['education', 'certificates', 'contact'];
  
  // Add priority sections first
  for (const section of prioritySections) {
    const text = content.structured[section];
    if (text && text.length > 50) { // Only process if meaningful content
      const sectionChunks = splitText(text, chunkSize, overlap);
      sectionChunks.forEach(chunk => {
        chunks.push({
          content: chunk,
          section: section,
          type: 'priority'
        });
      });
    }
  }
  
  // Add other sections
  for (const section of otherSections) {
    const text = content.structured[section];
    if (text && text.length > 50) {
      const sectionChunks = splitText(text, chunkSize, overlap);
      sectionChunks.forEach(chunk => {
        chunks.push({
          content: chunk,
          section: section,
          type: 'secondary'
        });
      });
    }
  }
  
  // Limit total chunks to prevent memory issues
  const maxChunks = 30;
  if (chunks.length > maxChunks) {
    console.log(`Limiting chunks from ${chunks.length} to ${maxChunks} for memory optimization`);
    return chunks.slice(0, maxChunks);
  }
  
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
 * Generate embeddings using Google's text-embedding-004 model
 */
async function generateEmbeddings(chunks, apiKey) {
  const fetch = (await import('node-fetch')).default;
  
  try {
    const embeddings = [];
    
    // Process chunks one by one to avoid memory issues
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      try {
        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-goog-api-key': apiKey
          },
          body: JSON.stringify({
            model: 'models/text-embedding-004',
            content: {
              parts: [{ text: chunk.content }]
            }
          })
        });
        
        if (!response.ok) {
          console.warn(`Embedding API error for chunk ${i}: ${response.status}`);
          // Use dummy embedding for this chunk
          embeddings.push(new Array(768).fill(0));
          continue;
        }
        
        const data = await response.json();
        const embedding = data.embedding?.values || [];
        
        if (embedding.length > 0) {
          embeddings.push(embedding);
        } else {
          // Fallback: create dummy embedding for this chunk
          embeddings.push(new Array(768).fill(0));
        }
        
      } catch (chunkError) {
        console.warn(`Error processing chunk ${i}:`, chunkError.message);
        embeddings.push(new Array(768).fill(0));
      }
      
      // Small delay to respect rate limits and prevent memory buildup
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      // Log progress every 10 chunks
      if ((i + 1) % 10 === 0) {
        console.log(`Generated embeddings for ${i + 1}/${chunks.length} chunks`);
      }
    }
    
    console.log(`Successfully generated ${embeddings.length} embeddings`);
    return embeddings;
    
  } catch (error) {
    console.error('Error generating embeddings:', error);
    // Return dummy embeddings as fallback
    console.log(`Falling back to dummy embeddings for ${chunks.length} chunks`);
    return chunks.map(() => new Array(768).fill(0));
  }
}

/**
 * Simple keyword-based content matching as fallback
 */
function findRelevantContentSimple(query, chunks, topK = 3) {
  const queryLower = query.toLowerCase();
  const relevantChunks = [];
  
  // Score chunks based on keyword matches
  chunks.forEach((chunk, index) => {
    const contentLower = chunk.content.toLowerCase();
    let score = 0;
    
    // Split query into words and count matches
    const queryWords = queryLower.split(/\s+/).filter(word => word.length > 2);
    queryWords.forEach(word => {
      const matches = (contentLower.match(new RegExp(word, 'g')) || []).length;
      score += matches;
    });
    
    // Boost score for priority sections
    if (chunk.type === 'priority') {
      score *= 1.5;
    }
    
    if (score > 0) {
      relevantChunks.push({
        index,
        similarity: score / queryWords.length, // Normalize score
        chunk
      });
    }
  });
  
  // Sort by score and return top K
  relevantChunks.sort((a, b) => b.similarity - a.similarity);
  return relevantChunks.slice(0, topK);
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) {
    return 0;
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

/**
 * Find relevant chunks based on query similarity
 */
async function findRelevantChunks(query, chunks, embeddings, geminiApiKey, topK = 3) {
  const fetch = (await import('node-fetch')).default;
  
  // Check if we have valid embeddings
  const hasValidEmbeddings = embeddings && embeddings.length > 0 && 
                            embeddings[0] && embeddings[0].length > 0 &&
                            !embeddings[0].every(val => val === 0);
  
  if (!hasValidEmbeddings) {
    console.log('No valid embeddings found, using simple keyword matching');
    return findRelevantContentSimple(query, chunks, topK);
  }
  
  try {
    // Generate embedding for the query using Gemini
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': geminiApiKey
      },
      body: JSON.stringify({
        model: 'models/text-embedding-004',
        content: {
          parts: [{ text: query }]
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`Gemini Embedding API error: ${response.status}`);
    }
    
    const data = await response.json();
    const queryEmbedding = data.embedding?.values || [];
    
    if (queryEmbedding.length === 0) {
      throw new Error('No embedding returned for query');
    }
    
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
    console.error('Error finding relevant chunks with embeddings:', error);
    console.log('Falling back to keyword matching');
    return findRelevantContentSimple(query, chunks, topK);
  }
}

module.exports = async function handler(req, res) {
  // CORS headers
  const allowedOrigins = [
    'https://ahmed-hazem-1.github.io',
    'http://127.0.0.1:5501',
    'http://localhost:5501',
    'http://127.0.0.1:5500',
    'http://localhost:5500',
    'http://localhost:3000'
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://ahmed-hazem-1.github.io');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Handle warmup endpoint
  if (req.method === 'GET' && req.url?.includes('/warmup')) {
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
    }

    // Start warm-up in background (don't wait for completion)
    if (!portfolioCache.content && !portfolioCache.isWarmingUp) {
      warmUpCache(geminiApiKey).catch(err => console.error('Warmup error:', err));
    }

    return res.status(200).json({ 
      message: 'Cache warm-up initiated',
      status: portfolioCache.isWarmingUp ? 'warming-up' : (portfolioCache.content ? 'ready' : 'starting'),
      chunksReady: portfolioCache.chunks?.length || 0
    });
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
    
    if (!geminiApiKey) {
      return res.status(500).json({ error: 'Server is not configured with GEMINI_API_KEY' });
    }

    // Start warm-up if cache is empty (for first request)
    if (!portfolioCache.content && !portfolioCache.isWarmingUp) {
      console.log('First request detected, starting warm-up...');
      warmUpCache(geminiApiKey).catch(err => console.error('Background warmup error:', err));
    }

    // Wait for warm-up to complete if it's in progress
    if (portfolioCache.isWarmingUp) {
      console.log('Waiting for cache warm-up to complete...');
      let retries = 0;
      while (portfolioCache.isWarmingUp && retries < 30) { // Max 30 seconds wait
        await new Promise(resolve => setTimeout(resolve, 1000));
        retries++;
      }
    }

    // Check cache validity
    const now = Date.now();
    const cacheValid = portfolioCache.content && 
                      portfolioCache.lastUpdated && 
                      (now - portfolioCache.lastUpdated) < CACHE_DURATION;

    if (!cacheValid) {
      console.log('Cache invalid, refreshing portfolio content...');
      
      try {
        // Scrape fresh content
        const scrapedContent = await scrapePortfolio();
        
        // Split into chunks (limited to prevent memory issues)
        const chunks = splitIntoChunks(scrapedContent);
        console.log(`Created ${chunks.length} content chunks`);
        
        // Generate embeddings (with fallback to keyword matching)
        let embeddings = [];
        try {
          console.log('Generating embeddings with Gemini...');
          embeddings = await generateEmbeddings(chunks, geminiApiKey);
          console.log('Embeddings generated successfully');
        } catch (embeddingError) {
          console.warn('Failed to generate embeddings, will use keyword matching:', embeddingError.message);
          embeddings = chunks.map(() => new Array(768).fill(0)); // Dummy embeddings
        }
        
        // Update cache
        portfolioCache = {
          content: scrapedContent,
          chunks: chunks,
          embeddings: embeddings,
          lastUpdated: now
        };
        
        console.log(`Portfolio content cached with ${chunks.length} chunks`);
        
      } catch (error) {
        console.error('Error refreshing portfolio cache:', error);
        // Use fallback static content if scraping fails completely
        const fallbackContent = {
          structured: {
            about: "Ahmed Hazem Elabady - Junior Data Scientist from Cairo, Egypt",
            skills: "Python, Machine Learning, Data Analysis, Web Scraping, Computer Vision",
            projects: "Waste Detection using YOLO, Land Type Classification, COVID-19 X-ray Detection",
            experience: "Computer Vision Trainee at NTI, AI & Data Science Trainee at DEPI"
          },
          fullContent: "Ahmed Hazem Elabady portfolio content",
          timestamp: now
        };
        
        const fallbackChunks = splitIntoChunks(fallbackContent);
        portfolioCache = {
          content: fallbackContent,
          chunks: fallbackChunks,
          embeddings: fallbackChunks.map(() => new Array(768).fill(0)),
          lastUpdated: now
        };
        
        console.log('Using fallback static content');
      }
    }

    // Find relevant content chunks for the user's query
    const relevantChunks = await findRelevantChunks(
      message, 
      portfolioCache.chunks, 
      portfolioCache.embeddings, 
      geminiApiKey,
      3 // Get top 3 most relevant chunks
    );

    // Prepare context from relevant chunks
    const contextParts = relevantChunks.map(item => 
      `[${item.chunk.section}]: ${item.chunk.content}`
    );
    const retrievedContext = contextParts.join('\n\n');

    // Determine if we're using real embeddings or fallback
    const hasValidEmbeddings = portfolioCache.embeddings && 
                              portfolioCache.embeddings.length > 0 && 
                              portfolioCache.embeddings[0] && 
                              portfolioCache.embeddings[0].length > 0 &&
                              !portfolioCache.embeddings[0].every(val => val === 0);

    console.log(`Using ${relevantChunks.length} relevant chunks for context (${hasValidEmbeddings ? 'semantic' : 'keyword'} matching)`);

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
        cacheAge: Math.round((now - portfolioCache.lastUpdated) / 1000 / 60), // minutes
        mode: hasValidEmbeddings ? 'semantic-embeddings' : 'keyword-matching',
        totalChunks: portfolioCache.chunks?.length || 0
      }
    });
    
  } catch (err) {
    console.error('Chat API error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};
