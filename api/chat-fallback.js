// Fallback version without OpenAI embeddings - uses simple keyword matching
// This version still provides enhanced web scraping but falls back to simpler content matching

const cheerio = require('cheerio');

const SYSTEM_PROMPT = `You are "Ahmed's Assistant", the official chatbot for Ahmed Hazem Elabady's portfolio (Junior Data Scientist, Cairo, Egypt).
Only answer questions about Ahmed's portfolio: about, skills, experience, education, projects, certificates, and contact.
If a question is unrelated, politely decline and steer back to the portfolio.
When answering, use the provided context from the portfolio. If some detail isn't present, say you don't have that info and suggest checking relevant sections.
Be concise, friendly, and professional. Detect the user's language (Arabic/English) and respond accordingly.`;

// Cache for scraped content
let portfolioCache = {
  content: null,
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
      about: $('#about').text().trim() || '',
      skills: $('#skills').text().trim() || '',
      experience: $('#experience').text().trim() || '',
      education: $('#education').text().trim() || '',
      projects: $('#projects').text().trim() || '',
      certificates: $('#certificates').text().trim() || '',
      contact: $('#contact').text().trim() || '',
      fullContent: $('main, .container, body').first().text().trim()
    };
    
    return {
      ...content,
      timestamp: Date.now()
    };
    
  } catch (error) {
    console.error('Error scraping portfolio:', error);
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
 * Simple keyword-based content matching
 */
function findRelevantContent(query, content) {
  const queryLower = query.toLowerCase();
  const sections = ['about', 'skills', 'experience', 'education', 'projects', 'certificates', 'contact'];
  const relevantSections = [];
  
  // Check which sections are most relevant based on keywords
  const sectionKeywords = {
    about: ['about', 'who', 'background', 'summary', 'profile', 'bio'],
    skills: ['skills', 'technologies', 'tools', 'programming', 'languages', 'frameworks'],
    experience: ['experience', 'work', 'job', 'position', 'role', 'career', 'employment'],
    education: ['education', 'university', 'degree', 'study', 'academic', 'college'],
    projects: ['projects', 'portfolio', 'work', 'built', 'developed', 'created', 'github'],
    certificates: ['certificates', 'certifications', 'achievements', 'credentials', 'awards'],
    contact: ['contact', 'email', 'phone', 'linkedin', 'reach', 'connect', 'social']
  };
  
  // Find relevant sections based on keywords
  for (const [section, keywords] of Object.entries(sectionKeywords)) {
    const hasMatch = keywords.some(keyword => queryLower.includes(keyword));
    if (hasMatch && content[section]) {
      relevantSections.push({
        section,
        content: content[section]
      });
    }
  }
  
  // If no specific section matches, use general content
  if (relevantSections.length === 0) {
    // Return sections that have content
    for (const section of sections) {
      if (content[section] && content[section].length > 0) {
        relevantSections.push({
          section,
          content: content[section]
        });
      }
    }
  }
  
  return relevantSections.slice(0, 3); // Return top 3 sections
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
    if (!geminiApiKey) {
      return res.status(500).json({ error: 'Server is not configured with GEMINI_API_KEY' });
    }

    // Check cache validity
    const now = Date.now();
    const cacheValid = portfolioCache.content && 
                      portfolioCache.lastUpdated && 
                      (now - portfolioCache.lastUpdated) < CACHE_DURATION;

    if (!cacheValid) {
      console.log('Cache invalid, refreshing portfolio content...');
      const scrapedContent = await scrapePortfolio();
      portfolioCache = {
        content: scrapedContent,
        lastUpdated: now
      };
      console.log('Portfolio content cached');
    }

    // Find relevant content using simple keyword matching
    const relevantContent = findRelevantContent(message, portfolioCache.content);
    
    // Prepare context from relevant content
    const contextParts = relevantContent.map(item => 
      `[${item.section}]: ${item.content}`
    );
    const retrievedContext = contextParts.join('\n\n');

    console.log(`Using ${relevantContent.length} relevant sections for context`);

    // Use dynamic import for fetch
    const fetch = (await import('node-fetch')).default;

    // Prepare Gemini API request
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
        sectionsUsed: relevantContent.length,
        cacheAge: Math.round((now - portfolioCache.lastUpdated) / 1000 / 60), // minutes
        fallbackMode: true
      }
    });
    
  } catch (err) {
    console.error('Chat API error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};