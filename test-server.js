// Simple Express server for testing the chatbot locally
const express = require('express');
const cors = require('cors');
const path = require('path');

// Import your chat handler
const chatHandler = require('./api/chat.js');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Serve the test UI
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'test-ui.html'));
});

// Warmup endpoint to trigger cache preloading
app.get('/warmup', async (req, res) => {
    try {
        const mockReq = {
            method: 'GET',
            url: '/warmup',
            headers: req.headers
        };
        
        const mockRes = {
            statusCode: 200,
            headers: {},
            setHeader: (key, value) => {
                mockRes.headers[key] = value;
            },
            status: (code) => {
                mockRes.statusCode = code;
                return mockRes;
            },
            json: (data) => {
                res.status(mockRes.statusCode).set(mockRes.headers).json(data);
            },
            end: () => {
                res.status(mockRes.statusCode).set(mockRes.headers).end();
            }
        };
        
        await chatHandler(mockReq, mockRes);
    } catch (error) {
        console.error('Warmup error:', error);
        res.status(500).json({ error: 'Warmup failed' });
    }
});

// Chat API endpoint
app.post('/api/chat', async (req, res) => {
    try {
        // Create a mock request/response object that matches Vercel's format
        const mockReq = {
            method: 'POST',
            body: req.body,
            headers: req.headers
        };
        
        const mockRes = {
            statusCode: 200,
            headers: {},
            setHeader: (key, value) => {
                mockRes.headers[key] = value;
            },
            status: (code) => {
                mockRes.statusCode = code;
                return mockRes;
            },
            json: (data) => {
                res.status(mockRes.statusCode).set(mockRes.headers).json(data);
            },
            end: () => {
                res.status(mockRes.statusCode).set(mockRes.headers).end();
            }
        };
        
        await chatHandler(mockReq, mockRes);
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        environment: {
            GEMINI_API_KEY: process.env.GEMINI_API_KEY ? '✓ Set' : '✗ Missing'
        }
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Test server running on http://localhost:${PORT}`);
    console.log(`📱 Open http://localhost:${PORT} to test the chatbot UI`);
    console.log(`🔍 Health check: http://localhost:${PORT}/health`);
    console.log(`🔥 Warmup endpoint: http://localhost:${PORT}/warmup`);
    console.log('');
    console.log('Environment Status:');
    console.log(`  GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? '✓ Set' : '✗ Missing'}`);
    
    if (!process.env.GEMINI_API_KEY) {
        console.log('\n⚠️  Warning: GEMINI_API_KEY not set. Set it with:');
        console.log('   set GEMINI_API_KEY=your_key_here');
    } else {
        console.log('\n✅ Ready to go! Using Gemini for both chat and embeddings.');
        
        // Auto-trigger warmup after server starts
        setTimeout(async () => {
            console.log('\n🔥 Auto-starting cache warm-up...');
            try {
                const fetch = (await import('node-fetch')).default;
                const response = await fetch(`http://localhost:${PORT}/warmup`);
                const data = await response.json();
                console.log('📊 Warmup response:', data.message);
            } catch (err) {
                console.error('❌ Auto-warmup failed:', err.message);
            }
        }, 2000); // Wait 2 seconds for server to fully start
    }
});