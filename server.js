const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin_password_2026';

// Helper to parse cookies
const getCookie = (req, name) => {
  const rc = req.headers.cookie;
  if (!rc) return null;
  const cookies = rc.split(';');
  for (let i = 0; i < cookies.length; i++) {
    const parts = cookies[i].split('=');
    const key = parts.shift().trim();
    if (key === name) {
      return decodeURIComponent(parts.join('='));
    }
  }
  return null;
};

// ─── Authentication Endpoints ───

app.post('/api/admin/login', async (req, res) => {
  try {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
      const token = crypto.randomUUID();
      await db.createSession(token);
      res.setHeader('Set-Cookie', `admin_token=${token}; Path=/; Max-Age=86400; HttpOnly; SameSite=Strict`);
      return res.json({ success: true });
    } else {
      return res.status(401).json({ error: 'Incorrect password' });
    }
  } catch (e) {
    console.error('Login error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/admin/logout', async (req, res) => {
  try {
    const token = getCookie(req, 'admin_token');
    await db.deleteSession(token);
    res.setHeader('Set-Cookie', 'admin_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict');
    res.json({ success: true });
  } catch (e) {
    console.error('Logout error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/admin/check-auth', async (req, res) => {
  try {
    const token = getCookie(req, 'admin_token');
    const valid = await db.checkSession(token);
    return res.json({ authenticated: valid });
  } catch (e) {
    return res.json({ authenticated: false });
  }
});

// Protect dashboard.html from unauthenticated static access
app.get('/dashboard.html', async (req, res) => {
  try {
    const token = getCookie(req, 'admin_token');
    const valid = await db.checkSession(token);
    if (valid) {
      res.sendFile(path.join(__dirname, 'dashboard.html'));
    } else {
      res.redirect('/login.html');
    }
  } catch (e) {
    res.redirect('/login.html');
  }
});

// Serve static files from the current directory
app.use(express.static(__dirname));

// ─── API Routes ───

// Endpoint to submit annotations
app.post('/api/submit', async (req, res) => {
  try {
    const { session_id, annotator_id, ...data } = req.body;

    if (!session_id || !annotator_id) {
      return res.status(400).json({ error: 'Missing session_id or annotator_id' });
    }

    const dataStr = JSON.stringify(data);
    await db.insertSubmission(session_id, annotator_id, dataStr);
    res.json({ success: true });
  } catch (e) {
    console.error('Error saving submission:', e.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// Endpoint to fetch results for the dashboard (admin-only)
app.get('/api/results', async (req, res) => {
  try {
    const token = getCookie(req, 'admin_token');
    const valid = await db.checkSession(token);
    if (!valid) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const rows = await db.getAllSubmissions();
    const parsedRows = rows.map(row => ({
      annotator_id: row.annotator_id,
      completed_at: row.completed_at,
      data: JSON.parse(row.data)
    }));

    res.json(parsedRows);
  } catch (e) {
    console.error('Results error:', e);
    res.status(500).json({ error: 'Database error' });
  }
});

// Endpoint to get/set cached AI responses (stored in DB for serverless)
app.get('/api/responses', async (req, res) => {
  try {
    const data = await db.getCache('ai_responses');
    res.json(data); // null if not found
  } catch (e) {
    console.error('Cache read error:', e);
    res.json(null);
  }
});

app.post('/api/responses', async (req, res) => {
  try {
    const responses = req.body;
    await db.setCache('ai_responses', responses);
    res.json({ success: true, message: 'Cache updated' });
  } catch (e) {
    console.error('Cache write error:', e);
    res.status(500).json({ error: 'Cache error' });
  }
});

// ─── AI Proxy Endpoints ───
const RADIOLOGIST_PROMPT = "You are a radiologist assistant. Look at this X-ray image and identify the fracture. Explain only the type and region of the fracture.";

app.post('/api/generate', async (req, res) => {
  const { model, base64Image } = req.body;
  if (!model || !base64Image) {
    return res.status(400).json({ error: 'Missing model or base64Image' });
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey = process.env.OPENROUTER_API_KEY;
  const hfToken = process.env.HF_TOKEN;

  try {
    if (model === 'Gemini') {
      if (!geminiKey) throw new Error("GEMINI_API_KEY not configured on server.");
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${geminiKey}`;
      const body = {
        contents: [{
          parts: [
            { text: RADIOLOGIST_PROMPT },
            { inlineData: { mimeType: "image/jpeg", data: base64Image } }
          ]
        }]
      };
      const fetchRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!fetchRes.ok) throw new Error(`Gemini API ${fetchRes.status}: ${fetchRes.statusText}`);
      const json = await fetchRes.json();
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text || "[No response from Gemini]";
      return res.json({ result: text });

    } else if (model === 'MedGemma') {
      if (!hfToken) throw new Error("HF_TOKEN not configured on server.");
      const HF_MODEL = "google/medgemma-4b-it";
      const HF_URL = `https://api-inference.huggingface.co/models/${HF_MODEL}/v1/chat/completions`;
      const body = {
        model: HF_MODEL,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: RADIOLOGIST_PROMPT },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
          ]
        }],
        max_tokens: 1024
      };
      const fetchRes = await fetch(HF_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${hfToken}`
        },
        body: JSON.stringify(body)
      });
      if (!fetchRes.ok) throw new Error(`HF MedGemma API ${fetchRes.status}`);
      const json = await fetchRes.json();
      const text = json.choices?.[0]?.message?.content || "[Empty MedGemma response]";
      return res.json({ result: `[MedGemma via HF] ${text}` });

    } else if (model === 'Llama') {
      if (!groqKey) throw new Error("OPENROUTER_API_KEY not configured on server.");
      const url = "https://openrouter.ai/api/v1/chat/completions";
      const body = {
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: RADIOLOGIST_PROMPT },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
          ]
        }],
        max_tokens: 1024
      };
      const fetchRes = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${groqKey}`
        },
        body: JSON.stringify(body)
      });
      if (!fetchRes.ok) {
        const errText = await fetchRes.text();
        throw new Error(`OpenRouter API ${fetchRes.status}: ${errText.substring(0, 100)}`);
      }
      const json = await fetchRes.json();
      const text = json.choices?.[0]?.message?.content || "[Empty Llama response]";
      return res.json({ result: text });
    }

    return res.status(400).json({ error: 'Unknown model' });

  } catch (e) {
    console.error(`Proxy Error (${model}):`, e.message);
    return res.status(500).json({ error: e.message });
  }
});

// ─── Start server (local dev only; Vercel uses the exported app) ───
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Dashboard available at http://localhost:${PORT}/dashboard.html`);
  });
}

// Export for Vercel serverless
module.exports = app;
