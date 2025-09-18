// Simple test version without embeddings - uses only keyword matching
const cheerio = require('cheerio');

const SYSTEM_PROMPT = `You are "Ahmed's Assistant", the official chatbot for Ahmed Hazem Elabady's portfolio (Junior Data Scientist, Cairo, Egypt).
Only answer questions about Ahmed's portfolio: about, skills, experience, education, projects, certificates, and contact.
If a question is unrelated, politely decline and steer back to the portfolio.
When answering, use the provided context from the portfolio. If some detail isn't present, say you don't have that info and suggest checking relevant sections.
Be concise, friendly, and professional. Detect the user's language (Arabic/English) and respond accordingly.`;

// Cache for scraped content
let portfolioCache = {
  content: null,
  chunks: null,
  lastUpdated: null,
  isWarmingUp: false
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
    console.log('📊 Scraping portfolio content...');
    const response = await fetch(baseUrl);
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Extract structured content
    const content = {
      about: $('#about').text().trim() || '',
      skills: $('#skills').text().trim() || '',
      experience: $('#experience').text().trim() || '',
      education: $('#education').text().trim() || '',
      projects: $('#projects').text().trim() || '',
      certificates: $('#certificates').text().trim() || '',
      contact: $('#contact').text().trim() || '',
      fullContent: $('main, .container, body').first().text().trim()
    };
    
    console.log('✅ Portfolio content scraped successfully');
    return {
      ...content,
      timestamp: Date.now()
    };
    
  } catch (error) {
    console.error('❌ Error scraping portfolio:', error);
    // Fallback to static content
    return {
      about: "Ahmed Hazem Elabady - Junior Data Scientist from Cairo, Egypt",
      skills: "Python, Machine Learning, Data Analysis, Web Scraping, Computer Vision",
      experience: "Computer Vision Trainee at NTI, AI & Data Science Trainee at DEPI",
      education: "B.Sc. Computer Science and Artificial Intelligence at Benha Faculty",
      projects: "Waste Detection using YOLO, Land Type Classification, COVID-19 X-ray Detection",
      certificates: "NVIDIA Deep Learning, ITIDA Innovation",
      contact: "ahmed.hazem.elabady@gmail.com, +20 127 5012 177",
      fullContent: "Ahmed Hazem Elabady portfolio content",
      timestamp: Date.now()
    };
  }
}

/**
 * Create simple chunks without embeddings
 */
function createSimpleChunks(content) {
  const chunks = [];
  const sections = ['about', 'skills', 'experience', 'education', 'projects', 'certificates', 'contact'];
  
  sections.forEach(section => {
    const text = content[section];
    if (text && text.length > 50) {
      chunks.push({
        content: text,
        section: section,
        type: 'structured'
      });
    }
  });
  
  console.log(`📝 Created ${chunks.length} content chunks`);
  return chunks;
}

/**
 * Simple keyword-based content matching
 */
function findRelevantContent(query, chunks, topK = 3) {
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
    
    // Boost score for certain sections
    if (['about', 'skills', 'projects'].includes(chunk.section)) {
      score *= 1.2;
    }
    
    if (score > 0) {
      relevantChunks.push({
        index,
        similarity: score / queryWords.length,
        chunk
      });
    }
  });
  
  // Sort by score and return top K
  relevantChunks.sort((a, b) => b.similarity - a.similarity);
  return relevantChunks.slice(0, topK);
}

/**
 * Warm up the cache by pre-loading portfolio data
 */
async function warmUpCache() {
  if (portfolioCache.isWarmingUp) {
    console.log('🔄 Cache warm-up already in progress...');
    return;
  }

  portfolioCache.isWarmingUp = true;
  console.log('🔥 Starting cache warm-up...');

  try {
    const now = Date.now();
    
    // Scrape content
    const scrapedContent = await scrapePortfolio();
    
    // Create simple chunks
    const chunks = createSimpleChunks(scrapedContent);
    
    // Update cache
    portfolioCache = {
      content: scrapedContent,
      chunks: chunks,
      lastUpdated: now,
      isWarmingUp: false
    };
    
    console.log(`🎯 Cache warm-up completed! Portfolio ready with ${chunks.length} chunks (keyword matching mode)`);
    
  } catch (error) {
    console.error('❌ Error during cache warm-up:', error);
    portfolioCache.isWarmingUp = false;
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
    // Start warm-up in background
    if (!portfolioCache.content && !portfolioCache.isWarmingUp) {
      warmUpCache().catch(err => console.error('Warmup error:', err));
    }

    return res.status(200).json({ 
      message: 'Cache warm-up initiated (keyword matching mode)',
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

    // Start warm-up if cache is empty
    if (!portfolioCache.content && !portfolioCache.isWarmingUp) {
      console.log('🚀 First request detected, starting warm-up...');
      warmUpCache().catch(err => console.error('Background warmup error:', err));
    }

    // Wait for warm-up to complete if it's in progress
    if (portfolioCache.isWarmingUp) {
      console.log('⏳ Waiting for cache warm-up to complete...');
      let retries = 0;
      while (portfolioCache.isWarmingUp && retries < 30) {
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
      console.log('🔄 Cache invalid, refreshing...');
      await warmUpCache();
    }

    // Find relevant content using keyword matching
    const relevantChunks = findRelevantContent(message, portfolioCache.chunks, 3);

    // Prepare context from relevant chunks
    const contextParts = relevantChunks.map(item => 
      `[${item.chunk.section}]: ${item.chunk.content}`
    );
    const retrievedContext = contextParts.join('\n\n');

    console.log(`📋 Using ${relevantChunks.length} relevant chunks for context (keyword matching)`);

    // Use dynamic import for fetch
    const fetch = (await import('node-fetch')).default;

    // Prepare Gemini API request
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
    const payload = {
      systemInstruction: { role: 'system', parts: [{ text: SYSTEM_PROMPT }] },
      contents: [
        { role: 'user', parts: [{ text: `Relevant portfolio context:\n${retrievedContext}` }] },
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
      console.error('❌ Gemini API error', response.status, errorText);
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
        cacheAge: Math.round((now - portfolioCache.lastUpdated) / 1000 / 60),
        mode: 'keyword-matching',
        totalChunks: portfolioCache.chunks?.length || 0
      }
    });
    
  } catch (err) {
    console.error('❌ Chat API error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};