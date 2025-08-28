// Serverless API route: POST /api/chat
// Uses Google Generative Language API (Gemini 2.0 Flash) with API key from env.
// Set env var GEMINI_API_KEY in your hosting platform. Do NOT commit tokens.

const SYSTEM_PROMPT = `You are "Ahmed's Assistant", the official chatbot for Ahmed Hazem Elabady's portfolio (Junior Data Scientist, Cairo, Egypt).
Only answer questions about Ahmed's portfolio: about, skills, experience, education, projects, certificates, and contact.
If a question is unrelated, politely decline and steer back to the portfolio.
If some detail isn't present on the site, say you don't have that info and suggest checking relevant sections (#about, #projects, #skills, #experience, #education, #contact) or external links on the page.
Be concise, friendly, and professional. Detect the user's language (Arabic/English) and respond accordingly.`;

// Static portfolio context (since we can't read files from GitHub Pages)
const PORTFOLIO_CONTEXT = `
Name: Ahmed Hazem Elabady
Subtitle: Junior Data Scientist • Web Scraper • Cairo, Egypt
Summary: I'm a Data Science professional who turns raw data into smart, results‑driven decisions. From machine learning and data analysis to web scraping, I uncover insights that cut costs, boost efficiency, and reveal new opportunities.

Skills: Python, Pandas, NumPy, scikit-learn, Data Analysis, Machine Learning, Deep Learning, Computer Vision, Object Detection, TensorFlow, Keras, YOLO, Web Scraping, BeautifulSoup, Selenium, Dash, SQL, Matplotlib, Seaborn, Streamlit, Git & GitHub

Experience:
- Computer Vision Trainee at National Telecommunication Institute (NTI) • Jul–Aug 2025
- AI & Data Science Trainee at Digital Egypt Pioneers Initiative (DEPI) • Oct 2024–Jun 2025
- AI Model Trainer (Freelance) at Outlier • Sep–Nov 2024
- Information Technology Trainee at EGAS • Jul 2024

Education:
- B.Sc. Computer Science and Artificial Intelligence at Benha Faculty (2023–2027)

Projects:
- Waste Detection using YOLO (v8–v11) | Deep Learning · Object Detection | Detects 22 waste categories with 94% mAP50
- Land Type Classification (EuroSAT) | Deep Learning · Remote Sensing | Classifies Sentinel‑2 images into land‑use types
- COVID-19 X-ray Detection | CNN · Medical Imaging | CNN with confidence visualization for chest X‑rays
- Cat vs. Dog Image Classifier | CNN | Binary image classifier with strong generalization
- Customer Churn Prediction | LR · RF · SVC · KNN · XGBoost | Bank churn prediction with model comparison
- Heart Disease Indicators | LR · SVC · KNN · Random Forest | Pipeline on 319,795 records
- Wuzzuf Jobs Dataset | Web Scraping | Scraped 8k+ job listings for analytics
- Top Ranked Anime Dataset | Web Scraping | Collected 20k entries for trend analysis

Certificates:
- Fundamentals of Deep Learning – NVIDIA (Apr 2025)
- InnovEgypt – Innovation and Entrepreneurship – ITIDA (Jul 2024)
- Python – MaharaTech - ITIMooca (Jun 2024)

Contact:
- Email: ahmed.hazem.elabady@gmail.com
- Phone: +20 127 5012 177
- Location: Cairo, Egypt
- LinkedIn: Ahmed Hazem Elabady
- GitHub: ahmed-hazem-1
- Kaggle: ahmedhazemelabady
`;

// Simple in-memory cache for the summarized portfolio context
let portfolioContextCache = null;

module.exports = async function handler(req, res) {
  // CORS headers for both GitHub Pages and local development
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
    
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Server is not configured with GEMINI_API_KEY' });
    }

    const isFirstMessage = !history || history.length === 0;

    // Use dynamic import for fetch since we're in CommonJS
    const fetch = (await import('node-fetch')).default;

    if (isFirstMessage) {
      console.log('First message received. Summarizing portfolio context...');
      
      const summaryPrompt = `Summarize the following portfolio context in a concise manner. This summary will be used as context for a chatbot. Focus on key information like name, role, skills, and project highlights. The user will ask questions based on this summary.\n\n${PORTFOLIO_CONTEXT}`;
      
      const summaryPayload = {
        contents: [{ role: 'user', parts: [{ text: summaryPrompt }] }]
      };

      const summaryResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-goog-api-key': apiKey },
        body: JSON.stringify(summaryPayload)
      });

      if (!summaryResponse.ok) {
        const errorText = await summaryResponse.text();
        console.error('Gemini API error (summary)', summaryResponse.status, errorText);
        return res.status(502).json({ error: 'Gemini API error during summary', status: summaryResponse.status });
      }

      const summaryData = await summaryResponse.json();
      const summaryParts = summaryData?.candidates?.[0]?.content?.parts || [];
      portfolioContextCache = summaryParts.map(p => p.text || '').join('\n').trim();
      console.log('Portfolio context summarized and cached.');
    }

    const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
    const payload = {
      systemInstruction: { role: 'system', parts: [{ text: SYSTEM_PROMPT }] },
      contents: [
        { role: 'user', parts: [{ text: `Portfolio context:\n${portfolioContextCache}` }] },
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
        'X-goog-api-key': apiKey
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
    
    return res.status(200).json({ reply });
  } catch (err) {
    console.error('Chat API error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
