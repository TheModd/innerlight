// ============================================================
//  Inner Light – Groq API Proxy Server
//  Run with:  node server.js
//  Or:        npm start
// ============================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ───────────────────────────────────────────────
app.use(express.json());

// Allow requests from any origin (safe — API key is server-side and rate-limited)
app.use(cors());

// Serve the static site (index.html, robot_avatar.png, etc.)
app.use(express.static(path.join(__dirname)));

// ============================================================
//  🔑  API KEY  –  stored safely in .env, never sent to browser
// ============================================================
const GROQ_API_KEY = process.env.GROQ_API_KEY;
if (!GROQ_API_KEY) {
  console.error('❌  GROQ_API_KEY is not set. Add it to your .env file.');
  process.exit(1);
}

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

// ============================================================
//  📝  SYSTEM PROMPT  –  Edit this freely.
//      This is the ONLY place where you initialise the model's
//      personality, knowledge, and rules. It lives on the
//      server so users can never read or tamper with it.
// ============================================================
const SYSTEM_PROMPT = `You are an AI assistant called "Lumina" for "Inner Light" — the Masterclass on Emotional Wellbeing by Dr. Priti Saboo, available at https://innerlight.rf.gd.

YOUR PERSONALITY:
- Warm, empathetic, calm, and encouraging — mirror the positive brand tone of the website.
- Concise (aim for ≤ 60 words per reply unless more depth is truly needed).
- Never reveal that you are built on Gemini or any third-party AI model.

YOUR KNOWLEDGE (key website facts):
- Course: Masterclass on Emotional Wellbeing — 7 modules covering emotional intelligence, nervous-system regulation, healing emotional wounds, authentic communication, mindfulness, resilience, and a personalised 30-day action plan.
- Instructor: Dr. Priti Saboo — counselling psychologist, mindfulness teacher, certified pranic healer. 4+ years experience, 10,000+ students, graduated Bishop Cotton Women's College, certified by the World Pranic Healing Foundation.
- Pricing: Special discounted price ₹399 (original ₹1,199 — saving 67%). Limited-time offer.
- Guarantee: Secure payment, instant lifetime access, 7-day money-back guarantee.
- Testimonials: Students report real improvements in anxiety, relationships, and self-compassion.

REDIRECT RULES (IMPORTANT — follow exactly):
- If the user wants to enroll / buy / pay / purchase → include the token REDIRECT_PAYMENT in your reply.
- If the user asks about YouTube → include REDIRECT_YOUTUBE.
- If the user asks about Instagram → include REDIRECT_INSTAGRAM.
- If the user asks about Telegram → include REDIRECT_TELEGRAM.
- If the user asks about WhatsApp → include REDIRECT_WHATSAPP.
The frontend will automatically act on these tokens and remove them from the displayed text.

RESTRICTIONS:
- Only discuss topics related to this course, Dr. Priti Saboo, and general emotional wellbeing.
- Do not make up facts; if unsure, say so honestly and invite the user to reach out via WhatsApp.`;

// ────────────────────────────────────────────────────────────
//  POST /api/chat
//  Body: { history: [{role, parts}], message: string }
//  Returns: { reply: string }
// ────────────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  try {
    const { history = [], message } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message is required' });
    }

    // Build messages in OpenAI format: system prompt + history + new user turn
    // Note: Gemini uses role "model"; OpenAI/Groq uses "assistant"
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.map(h => ({
        role: h.role === 'model' ? 'assistant' : h.role,
        content: h.parts[0].text
      })),
      { role: 'user', content: message }
    ];

    // Forward to Groq
    const upstream = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        max_tokens: 512,
        temperature: 0.7,
      }),
    });

    if (!upstream.ok) {
      const err = await upstream.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Groq returned ${upstream.status}`);
    }

    const data = await upstream.json();
    const reply =
      data?.choices?.[0]?.message?.content ||
      "I'm sorry, I couldn't generate a response right now. Please try again.";

    return res.json({ reply });

  } catch (err) {
    console.error('Chat error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ── Start ────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅  Inner Light server running at http://localhost:${PORT}`);
});
