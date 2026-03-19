const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'capacitor://localhost',
  'ionic://localhost',
];
const allowedOrigins = (process.env.ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS.join(','))
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const allowedModels = (process.env.ALLOWED_GEMINI_MODELS || 'gemini-2.0-flash,gemini-1.5-flash')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60000);
const RATE_LIMIT_MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 30);
const BODY_LIMIT = process.env.BODY_LIMIT || '64kb';

const ipBucket = new Map();

function getClientIp(req) {
  const xff = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return xff || req.socket?.remoteAddress || 'unknown';
}

function isOriginAllowed(origin) {
  if (!origin) return true; // מובייל/שרת לשרת לעתים ללא origin
  return allowedOrigins.includes(origin);
}

function applySecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  if (IS_PROD) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
}

function rateLimit(req, res, next) {
  const ip = getClientIp(req);
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const hits = (ipBucket.get(ip) || []).filter(ts => ts > windowStart);
  if (hits.length >= RATE_LIMIT_MAX_REQUESTS) {
    return res.status(429).json({ error: 'Too many requests, please try again later.' });
  }
  hits.push(now);
  ipBucket.set(ip, hits);
  next();
}

setInterval(() => {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  for (const [ip, hits] of ipBucket.entries()) {
    const fresh = hits.filter(ts => ts > windowStart);
    if (fresh.length === 0) ipBucket.delete(ip);
    else ipBucket.set(ip, fresh);
  }
}, Math.max(30000, RATE_LIMIT_WINDOW_MS)).unref();

app.disable('x-powered-by');

app.use((req, res, next) => {
  applySecurityHeaders(res);

  const origin = req.headers.origin;
  if (!isOriginAllowed(origin)) {
    return res.status(403).json({ error: 'Origin is not allowed' });
  }

  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  next();
});

app.use('/api/', rateLimit);
app.use(express.json({ limit: BODY_LIMIT }));
app.use(express.static(path.join(__dirname)));

app.post('/api/gemini', async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on server' });
    }

    const { query, systemPrompt, model } = req.body || {};
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Missing query' });
    }

    const cleanQuery = query.trim();
    if (cleanQuery.length < 2 || cleanQuery.length > 1500) {
      return res.status(400).json({ error: 'Invalid query length' });
    }

    const cleanSystemPrompt = typeof systemPrompt === 'string' ? systemPrompt.slice(0, 8000) : '';

    const requestedModel = typeof model === 'string' ? model.trim() : '';
    const targetModel = requestedModel || allowedModels[0] || 'gemini-2.0-flash';
    if (!allowedModels.includes(targetModel) || !/^[a-zA-Z0-9._-]+$/.test(targetModel)) {
      return res.status(400).json({ error: 'Model is not allowed' });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`;

    const body = {
      system_instruction: { parts: [{ text: cleanSystemPrompt }] },
      contents: [{ parts: [{ text: cleanQuery }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 600 }
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return res.status(resp.status).json({
        error: data?.error?.message || `Gemini request failed (${resp.status})`
      });
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return res.json({ text });
  } catch (err) {
    const msg = IS_PROD ? 'Unexpected server error' : (err?.message || 'Unexpected server error');
    return res.status(500).json({ error: msg });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
