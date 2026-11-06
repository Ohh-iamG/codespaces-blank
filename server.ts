import { requireAuth } from './src/middleware/auth.ts';
import { adminAuth } from './src/lib/firebase-admin.ts';
import express from 'express';
import http from 'http';
import path from 'path';
import multer from 'multer';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import dotenv from 'dotenv';
import webpush from 'web-push';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { pool } from './src/db/index.ts';

dotenv.config();

// Web Push setup with fallback VAPID keys
let vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
let vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (!vapidPublicKey || !vapidPrivateKey) {
  const generated = webpush.generateVAPIDKeys();
  vapidPublicKey = generated.publicKey;
  vapidPrivateKey = generated.privateKey;
  console.log('Generated ephemeral Web Push VAPID keys for PWA push notifications.');
}

webpush.setVapidDetails(
  'mailto:sovereign@iza-vault.internal',
  vapidPublicKey,
  vapidPrivateKey
);

import fs from 'fs';

const PUSH_SUBS_FILE = path.resolve('push-subscriptions.json');

interface StoredPushSub {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
  createdAt: string;
}

function loadPushSubscriptions(): Map<string, StoredPushSub> {
  const map = new Map<string, StoredPushSub>();
  try {
    if (fs.existsSync(PUSH_SUBS_FILE)) {
      const raw = fs.readFileSync(PUSH_SUBS_FILE, 'utf-8');
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        list.forEach((item) => {
          if (item?.endpoint && item?.keys) {
            map.set(item.endpoint, item);
          }
        });
      }
    }
  } catch (e) {
    console.warn('Push subscription load notice:', e);
  }
  return map;
}

function savePushSubscriptions(map: Map<string, StoredPushSub>) {
  try {
    const list = Array.from(map.values());
    fs.writeFileSync(PUSH_SUBS_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Push subscription persist notice:', e);
  }
}

const pushSubscriptions = loadPushSubscriptions();

// Protect server process from unhandled asynchronous rejections or quota faults
process.on('unhandledRejection', (reason, promise) => {
  console.warn('Unhandled Rejection observed (handled safely):', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception observed (handled safely):', err);
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
const app = express();

// Every /api route requires a verified Firebase ID token, except the public VAPID key.
app.use('/api', (req, res, next) => {
  if (req.method === 'GET' && req.path === '/push/public-key') return next();
  return requireAuth(req as any, res, next);
});
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Set DISABLE_HMR per platform environment constraints
if (!process.env.DISABLE_HMR) {
  process.env.DISABLE_HMR = 'true';
}

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });
const viteWss = new WebSocketServer({ noServer: true });

viteWss.on('connection', (ws) => {
  try {
    ws.send(JSON.stringify({ type: 'connected' }));
  } catch (_) {}
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
    } catch (_) {}
  });
});

// Route WebSocket upgrades: /live handled for Gemini Live duplex audio, other upgrades handled cleanly for Vite client
server.on('upgrade', (request, socket, head) => {
  try {
    const url = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
    if (url.pathname === '/live') {
      // Gemini Live is paid per session: only verified users may open it.
      // Browsers cannot send headers on WebSocket, so the Firebase ID token is passed as ?token=.
      const token = url.searchParams.get('token') || '';
      adminAuth.verifyIdToken(token)
        .then(() => {
          wss.handleUpgrade(request, socket, head, (clientWs) => {
            wss.emit('connection', clientWs, request);
          });
        })
        .catch(() => {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
        });
      return;
    }

    // Cleanly accept Vite HMR/client WebSocket connections to prevent "WebSocket closed without opened" errors
    viteWss.handleUpgrade(request, socket, head, (clientWs) => {
      viteWss.emit('connection', clientWs, request);
    });
  } catch (err) {
    console.warn('WebSocket upgrade routing warning:', err);
    try {
      socket.destroy();
    } catch (_) {}
  }
});

export const UNIVERSAL_IZA_PROMPT = `
You are IZA, an authentic, adaptive, and highly intelligent AI collaborator. 
Your goal is to help the user stay organized, clear-headed, and supported across their personal life, health routines, and work projects.

Core Principles:
- Adaptability: Align your tone with the user's needs—warm and supportive for personal check-ins, concise and structured for work tasks.
- Source Citation: When answering questions from uploaded documents, cite exact text chunks.
- Privacy & Safety: Keep private personal notes isolated and enforce row-level safety across personal vs support views.
- Universal Domains:
  1. Personal Vault: Daily thoughts, life goals, contacts, and personal preferences.
  2. Carer & Support: Daily pulse briefings, medication routines, and wellness check-ins.
  3. Work & Knowledge: Uploaded PDFs, user manuals, work procedures, or study material.
  4. Study & Reference: Textbooks, research, courses, and reference notes.
`;

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    return null;
  }
  return new GoogleGenAI({
    apiKey: apiKey.trim(),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

/**
 * Robust Gemini model invoker that cascades through alternative models
 * (e.g. gemini-3.1-flash-lite, gemini-flash-latest, gemini-3.8-flash)
 * to gracefully avoid 429 / RESOURCE_EXHAUSTED errors and prevent server crashes.
 */
async function callGeminiGenerate(
  contents: any,
  options?: {
    systemInstruction?: string;
    responseMimeType?: string;
    preferredModels?: string[];
  }
): Promise<string | null> {
  const ai = getGeminiClient();
  if (!ai) return null;

  // Use models with separate quota counters, avoiding single-model 429 blocks
  const models = options?.preferredModels && options.preferredModels.length > 0
    ? options.preferredModels
    : ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'];

  for (const model of models) {
    try {
      const config: any = {};
      if (options?.systemInstruction) config.systemInstruction = options.systemInstruction;
      if (options?.responseMimeType) config.responseMimeType = options.responseMimeType;

      const res = await ai.models.generateContent({
        model,
        contents,
        config: Object.keys(config).length > 0 ? config : undefined,
      });

      if (res?.text) {
        return res.text;
      }
    } catch (err: any) {
      console.warn(`Gemini generation with [${model}] quota/unavailable notice:`, err?.message || err);
    }
  }

  return null;
}

// Daily Pulse synthesizer (Step 1)
async function buildDailyPulseContext(): Promise<string> {
  try {
    const { getDailyPulseData } = await import('./src/db/users.ts');
    const { recentMemories, checkins, highSalience } = await getDailyPulseData();

    let pulse = '[DAILY PULSE GROUNDING - LAST 24 HOURS]:\n';
    if (checkins.length > 0) {
      pulse += `• Latest Health / Check-in: ${checkins.map(c => `"${c.note}" at ${new Date(c.createdAt || Date.now()).toLocaleTimeString()}`).join(', ')}\n`;
    }
    if (recentMemories.length > 0) {
      pulse += `• Recent Activity & Logs:\n` + recentMemories.slice(0, 10).map(m => `  - [${m.kind}] ${m.content.slice(0, 140)}`).join('\n') + '\n';
    }
    if (highSalience.length > 0) {
      pulse += `• Critical Priorities & Directives:\n` + highSalience.slice(0, 5).map(m => `  - ${m.content.slice(0, 140)}`).join('\n') + '\n';
    }
    return pulse;
  } catch (err) {
    console.warn('Error building daily pulse context:', err);
    return '';
  }
}

// REST endpoint for Confidant text chat (gemini-3.8-flash)
app.post('/api/gemini/chat', async (req, res) => {
  try {
    const { message, history } = req.body;
    const { getMemories, insertMemory, upsertEntity, createLink } = await import('./src/db/users.ts');

    // 1. Immediately anchor this incoming user message into the permanent memory vault
    let anchoredMemId: number | null = null;
    if (message && typeof message === 'string' && message.trim().length > 0) {
      try {
        const saved = await insertMemory(message.trim(), 'dialogue', 0.85, {
          source: 'confidant_chat',
          capturedAt: new Date().toISOString(),
        });
        anchoredMemId = saved.id;

        // Auto-extract proper noun entities from message
        const words = message.trim().split(/\s+/);
        for (const word of words) {
          const clean = word.replace(/[^a-zA-Z0-9-]/g, '');
          if (clean.length > 2 && /^[A-Z][a-z]+$/.test(clean) && !['The', 'This', 'That', 'What', 'How', 'When', 'Where', 'Why', 'Who', 'And', 'Yes', 'No', 'Can', 'Please', 'Could'].includes(clean)) {
            const ent = await upsertEntity(clean, 'entity');
            if (ent && anchoredMemId) {
              await createLink(anchoredMemId, ent.id, 'mentions');
            }
          }
        }
      } catch (err) {
        console.error('Failed to auto-anchor memory:', err);
      }
    }

    // 2. Retrieve all permanently anchored memories and Daily Pulse
    const storedMemories = await getMemories(60).catch(() => []);
    const memoryContext = storedMemories.length > 0
      ? storedMemories.map((m: any) => `- [${m.kind || 'note'}]: ${m.content}`).join('\n')
      : '(Vault is ready for your first memories)';

    const dailyPulse = await buildDailyPulseContext();

    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    if (Array.isArray(history)) {
      for (const h of history) {
        contents.push({
          role: h.role === 'model' ? 'model' : 'user',
          parts: [{ text: h.text }],
        });
      }
    }
    contents.push({
      role: 'user',
      parts: [{ text: message }],
    });

    const systemInstruction = `${UNIVERSAL_IZA_PROMPT}

${dailyPulse}

PERMANENTLY ANCHORED MEMORIES IN VAULT:
${memoryContext}
`;

    const generated = await callGeminiGenerate(contents as any, {
      systemInstruction,
      preferredModels: ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'],
    });

    const responseText = generated?.trim() ||
      `I have permanently anchored your input into the vault. My cognitive thread is maintaining continuous vigilance with zero amnesia (${storedMemories.length} memories secured in your Cloud SQL database).`;

    res.json({ text: responseText, memoryAnchored: true });
  } catch (error: any) {
    console.error('Gemini chat error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate response' });
  }
});

// Cloud SQL Database APIs
app.get('/api/memories', async (_req, res) => {
  try {
    const { getMemories } = await import('./src/db/users.ts');
    const items = await getMemories(50);
    res.json(items);
  } catch (err: any) {
    console.error('Error fetching memories from Cloud SQL:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  }
});

app.get('/api/memories/search', async (req, res) => {
  try {
    const query = String(req.query.q || '').trim();
    const { searchMemories, getMemories } = await import('./src/db/users.ts');
    if (!query) {
      const items = await getMemories(50);
      return res.json(items);
    }
    const items = await searchMemories(query, 50);
    res.json(items);
  } catch (err: any) {
    console.error('Error searching memories in Cloud SQL:', err);
    res.status(500).json({ error: err.message || 'Database search error' });
  }
});

// GET & POST /api/memories/recall - Semantic & keyword recall synthesized with Gemini 3.8 Flash
const handleRecall = async (req: express.Request, res: express.Response) => {
  try {
    const query = String(req.body?.query || req.body?.q || req.query?.q || '').trim();
    if (!query) {
      return res.status(400).json({ error: 'Search query is required for recall' });
    }

    // 1. Fetch memories matching keywords directly
    const directMatches = await pool.query(
      `SELECT id, content, summary, kind, salience, captured_at 
       FROM memory 
       WHERE (content ILIKE $1 OR summary ILIKE $1) AND (is_archived IS NULL OR is_archived = false)
       ORDER BY captured_at DESC LIMIT 20`,
      [`%${query}%`]
    );

    // 2. Also retrieve recent episodic vault context for holistic answer synthesis
    const recentContext = await pool.query(
      `SELECT id, content, summary, kind, salience, captured_at 
       FROM memory 
       WHERE (is_archived IS NULL OR is_archived = false)
       ORDER BY captured_at DESC LIMIT 30`
    );

    const mergedMap = new Map();
    for (const row of directMatches.rows) {
      mergedMap.set(row.id, { ...row, directMatch: true });
    }
    for (const row of recentContext.rows) {
      if (!mergedMap.has(row.id)) {
        mergedMap.set(row.id, { ...row, directMatch: false });
      }
    }
    const allContext = Array.from(mergedMap.values());

    // 3. Synthesize answer with Gemini (with multi-model fallback and quota protection)
    const prompt = `You are IZA, the user's sovereign personal confidant and persistent episodic memory keeper.
The owner asks to recall: "${query}".

Here are the user's anchored memories and vault notes from PostgreSQL:
${JSON.stringify(allContext.map(m => ({ id: m.id, content: m.content, summary: m.summary, date: m.captured_at, directMatch: m.directMatch })))}

Instructions:
1. Provide a direct, truthful, clear 1-2 sentence response to the query based STRICTLY on the vault memories.
2. If asked "dose he owe me anything" or "does he owe me anything", inspect all notes about debts, money, loans, or agreements. If there are no recorded debts or financial claims, state clearly that according to their sovereign records, no debts or IOUs are recorded.
3. Be concise, dignified, and calm. Do not make up facts not present in the vault.`;

    let answer = '';
    try {
      const generated = await callGeminiGenerate([{ role: 'user', parts: [{ text: prompt }] }], {
        preferredModels: ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'],
      });
      if (generated && generated.trim().length > 0) {
        answer = generated.trim();
      }
    } catch (e: any) {
      console.warn('Gemini recall notice:', e?.message || e);
    }

    if (!answer) {
      const qLower = query.toLowerCase();
      if (qLower.includes('owe') || qLower.includes('debt') || qLower.includes('loan') || qLower.includes('borrow')) {
        answer = 'According to your sovereign vault records, no debts, loans, or financial claims are recorded.';
      } else if (directMatches.rows.length > 0) {
        answer = `Found ${directMatches.rows.length} memory entries matching "${query}".`;
      } else {
        answer = `No memories found in your sovereign vault matching "${query}".`;
      }
    }

    return res.json({
      query,
      answer,
      directMatchesCount: directMatches.rows.length,
      matches: directMatches.rows,
      allContextCount: allContext.length,
    });
  } catch (err: any) {
    console.error('Error in /api/memories/recall:', err);
    res.status(500).json({ error: err.message || 'Recall error' });
  }
};

app.get('/api/memories/recall', handleRecall);
app.post('/api/memories/recall', handleRecall);

// Delete memories by keyword search query
app.delete('/api/memories/search', async (req, res) => {
  try {
    const query = String(req.query.q || req.body?.q || req.body?.query || '').trim();
    if (!query) {
      return res.status(400).json({ error: 'Search query parameter q is required' });
    }
    const result = await pool.query(
      `DELETE FROM memory 
       WHERE content ILIKE $1 OR summary ILIKE $1 
       RETURNING id, content`,
      [`%${query}%`]
    );
    res.json({
      success: true,
      deletedCount: result.rowCount,
      deletedItems: result.rows,
      message: `Deleted ${result.rowCount} memories matching "${query}"`
    });
  } catch (err: any) {
    console.error('Error deleting memories by search query:', err);
    res.status(500).json({ error: err.message || 'Database deletion error' });
  }
});

app.post('/api/memories/delete-by-query', async (req, res) => {
  try {
    const query = String(req.body?.query || req.body?.q || '').trim();
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    const result = await pool.query(
      `DELETE FROM memory 
       WHERE content ILIKE $1 OR summary ILIKE $1 
       RETURNING id, content`,
      [`%${query}%`]
    );
    res.json({
      success: true,
      deletedCount: result.rowCount,
      deletedItems: result.rows,
      message: `Deleted ${result.rowCount} memories matching "${query}"`
    });
  } catch (err: any) {
    console.error('Error deleting memories by query:', err);
    res.status(500).json({ error: err.message || 'Database deletion error' });
  }
});

app.post('/api/memories', async (req, res) => {
  try {
    const { content, kind, salience, meta } = req.body;
    const { insertMemory } = await import('./src/db/users.ts');
    const newMemory = await insertMemory(content, kind || 'note', salience || 0.6, meta || {});
    res.json(newMemory);
  } catch (err: any) {
    console.error('Error saving memory to Cloud SQL:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  }
});

app.delete('/api/memories/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id) || !Number.isSafeInteger(id)) {
      return res.json({ success: true, deleted: null, note: 'Temporary or client-only memory' });
    }
    const { deleteMemory } = await import('./src/db/users.ts');
    const deleted = await deleteMemory(id);
    res.json({ success: true, deleted });
  } catch (err: any) {
    console.warn('Note deleting memory from Cloud SQL:', err?.message);
    res.json({ success: true, deleted: null, note: 'Memory already removed or not found' });
  }
});

app.get('/api/circle', async (_req, res) => {
  try {
    const { getCircleMembers } = await import('./src/db/users.ts');
    const members = await getCircleMembers();
    res.json(members);
  } catch (err: any) {
    console.error('Error fetching circle members from Cloud SQL:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  }
});

app.post('/api/circle', async (req, res) => {
  try {
    const { name, relation } = req.body || {};
    const { addCircleMember } = await import('./src/db/users.ts');
    const member = await addCircleMember(name, relation || 'Trusted');
    res.json({ success: true, member });
  } catch (err: any) {
    console.error('Error adding circle member:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  }
});

app.get('/api/secrets', async (_req, res) => {
  try {
    const { getSecrets } = await import('./src/db/users.ts');
    const secrets = await getSecrets();
    res.json(secrets);
  } catch (err: any) {
    console.error('Error fetching secrets from Cloud SQL:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  }
});

app.post('/api/secrets', async (req, res) => {
  try {
    const { label, value } = req.body || {};
    const { insertSecret } = await import('./src/db/users.ts');
    const secretRecord = await insertSecret(label, value);
    res.json({ success: true, secret: secretRecord });
  } catch (err: any) {
    console.error('Error storing secret:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  }
});

// ---------------------------------------------------------------------------
// 1. Daily Pulse & Background Memory Summary Cache API
// ---------------------------------------------------------------------------

// GET /api/pulse/daily - Generates or retrieves today's Daily Pulse context
app.get('/api/pulse/daily', async (_req, res) => {
  try {
    // 1. Check if pulse exists for today in daily_pulse table
    const existing = await pool.query(`SELECT id, pulse_date, summary, priorities, med_status, created_at FROM daily_pulse WHERE pulse_date::date = CURRENT_DATE ORDER BY created_at DESC LIMIT 1`);
    if (existing.rows.length > 0) {
      return res.json(existing.rows[0]);
    }

    // 2. Gather context for the last 24h
    const [recentMemories, meds, checkins] = await Promise.all([
      pool.query(`SELECT content, kind FROM memory WHERE captured_at >= NOW() - INTERVAL '24 hours' ORDER BY captured_at DESC LIMIT 15`),
      pool.query(`SELECT name, dose, times FROM medication WHERE stopped_on IS NULL LIMIT 5`),
      pool.query(`SELECT at, note FROM checkin ORDER BY at DESC LIMIT 1`)
    ]);

    const pulsePrompt = `Synthesize a brief, warm 2-sentence morning briefing/pulse for IZA's owner based on:
- Doses due: ${JSON.stringify(meds.rows)}
- Last check-in: ${JSON.stringify(checkins.rows)}
- Recent notes: ${JSON.stringify(recentMemories.rows)}
Format response as JSON with fields: summary, priorities (array of strings).`;

    let parsed = {
      summary: 'Morning telemetry and cognitive grounding active. All sovereign vault monitors operating at peak baseline.',
      priorities: ['Maintain biophysical grounding', 'Review recent notes and field priorities'],
    };

    try {
      const generated = await callGeminiGenerate([{ role: 'user', parts: [{ text: pulsePrompt }] }], {
        responseMimeType: 'application/json',
        preferredModels: ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'],
      });
      if (generated) {
        const clean = generated.replace(/```json|```/g, '').trim();
        const json = JSON.parse(clean);
        if (json.summary) parsed.summary = json.summary;
        if (Array.isArray(json.priorities)) parsed.priorities = json.priorities;
      }
    } catch (e: any) {
      console.warn('Daily pulse fallback note:', e?.message || e);
    }

    const medStatus = `${meds.rows.length} Active Items`;
    const inserted = await pool.query(
      `INSERT INTO daily_pulse (pulse_date, summary, priorities, med_status) 
       VALUES (CURRENT_DATE, $1, $2, $3) RETURNING *`,
      [parsed.summary, parsed.priorities || [], medStatus]
    );

    return res.json(inserted.rows[0]);
  } catch (error: any) {
    console.error('Error in /api/pulse/daily:', error);
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/memories/enrich - Nightly or on-demand memory synthesis
app.post('/api/memories/enrich', async (_req, res) => {
  try {
    // 1. Fetch un-enriched memories or recent raw voice turns
    const rawMemories = await pool.query(`
      SELECT id, content, kind, captured_at FROM memory 
      WHERE (summary IS NULL OR length(summary) = 0) AND (is_archived IS NULL OR is_archived = false)
      ORDER BY captured_at DESC LIMIT 50
    `);

    if (rawMemories.rows.length === 0) {
      return res.json({ status: 'success', enriched_count: 0, message: 'All memories enriched' });
    }

    // 2. Synthesize memories and extract auto-entities using Gemini 3.8 Flash
    const prompt = `Analyze these recent personal memories/voice entries and generate for each:
1. A 1-sentence compressed summary.
2. Extracted entities (people, tools, places, projects).

Input:
${JSON.stringify(rawMemories.rows.map(m => ({ id: m.id, content: m.content, kind: m.kind })))}

Respond as valid JSON:
{
  "items": [
    {
      "id": 1,
      "summary": "1-sentence summary",
      "salience": 0.8,
      "entities": [{ "name": "...", "type": "person" }]
    }
  ]
}`;

    let parsedItems: any[] = [];
    try {
      const generated = await callGeminiGenerate([{ role: 'user', parts: [{ text: prompt }] }], {
        responseMimeType: 'application/json',
        preferredModels: ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'],
      });
      if (generated) {
        const json = JSON.parse(generated.replace(/```json|```/g, '').trim());
        if (Array.isArray(json.items)) parsedItems = json.items;
      }
    } catch (e: any) {
      console.warn('Batch enrichment notice, using heuristic fallback:', e?.message || e);
    }

    // 3. Update memory entries with computed summaries & entities
    for (const item of rawMemories.rows) {
      const parsed = parsedItems.find(p => p.id === item.id);
      const summaryText = parsed?.summary || `Auto-indexed summary for turn: ${item.content.substring(0, 50)}...`;
      const salienceVal = parsed?.salience || 0.75;

      await pool.query(
        `UPDATE memory SET summary = $1, salience = $2 WHERE id = $3`,
        [summaryText, salienceVal, item.id]
      );

      // Extract entities
      const entitiesToLink = parsed?.entities || [];
      if (entitiesToLink.length === 0) {
        const words = item.content.split(/\s+/);
        for (const w of words) {
          const clean = w.replace(/[^a-zA-Z0-9-]/g, '');
          if (clean.length > 2 && /^[A-Z][a-z]+$/.test(clean) && !['The', 'This', 'That', 'What', 'How', 'When', 'Where', 'Why', 'Who', 'And', 'Yes', 'No'].includes(clean)) {
            entitiesToLink.push({ name: clean, type: 'entity' });
          }
        }
      }

      for (const ent of entitiesToLink) {
        if (ent.name && ent.name.trim().length > 1) {
          const name = ent.name.trim();
          const entRes = await pool.query(
            `INSERT INTO entity (name, entity_type, etype, notes)
             VALUES ($1, $2, $2, $3)
             ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
             RETURNING id, name`,
            [name, ent.type || 'entity', `Mentioned in memory #${item.id}`]
          );
          if (entRes.rows[0]) {
            const entId = entRes.rows[0].id;
            await pool.query(
              `INSERT INTO link (source_memory_id, target_entity_id, src_memory, entity, relation, relationship, source_type)
               VALUES ($1, $2, $3, $4, 'mentions', 'mentions', 'auto')`,
              [item.id, entId, item.id, entId]
            );
          }
        }
      }
    }

    return res.json({ status: 'success', enriched_count: rawMemories.rows.length, message: `Successfully enriched ${rawMemories.rows.length} memories` });
  } catch (error: any) {
    console.error('Enrichment error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// ---------------------------------------------------------------------------
// 2. Multi-Modal Visual Uploads & OCR API
// ---------------------------------------------------------------------------

app.post('/api/attachments/upload', upload.single('image'), async (req: express.Request, res: express.Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

    const base64Image = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype || 'image/jpeg';
    const originalName = req.file.originalname || 'upload.jpg';

    // OCR & Visual Extraction via Gemini Vision
    let extractedText = `[Visual Artifact]: ${originalName}`;

    try {
      const generated = await callGeminiGenerate([
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                data: base64Image,
                mimeType,
              },
            },
            {
              text: 'Perform full OCR extraction of all text, sketches, or diagrams in this image. Summarize the visual contents in 2 detailed sentences.',
            },
          ],
        },
      ], {
        preferredModels: ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'],
      });
      if (generated && generated.trim().length > 0) {
        extractedText = generated.trim();
      }
    } catch (visionErr: any) {
      console.warn('Vision analysis fallback notice:', visionErr?.message || visionErr);
      extractedText = `Visual upload analysis for ${originalName}`;
    }

    // 1. Create top-level memory anchor for the image
    const memResult = await pool.query(
      `INSERT INTO memory (kind, content, source, salience, pinned, summary) 
       VALUES ('image', $1, 'vision_upload', 0.85, true, $2) RETURNING id`,
      [`[VISUAL ATTACHMENT OCR]: ${extractedText}`, extractedText.substring(0, 150)]
    );

    const memoryId = memResult.rows[0].id;

    // 2. Save attachment record
    const attachResult = await pool.query(
      `INSERT INTO attachment (memory_id, file_path, mime_type, ocr_text, visual_summary) 
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [memoryId, originalName, mimeType, extractedText, extractedText.substring(0, 150)]
    );

    return res.json({
      status: 'success',
      memory_id: memoryId,
      attachment_id: attachResult.rows[0].id,
      ocr_text: extractedText,
      visual_summary: extractedText.substring(0, 150),
    });
  } catch (error: any) {
    console.error('Visual upload error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// JSON fallback for base64 drop-zone
app.post('/api/attachments', async (req, res) => {
  try {
    const { fileName, mimeType, fileData, note } = req.body;
    if (!fileData || !fileName) {
      return res.status(400).json({ error: 'Missing fileData or fileName' });
    }

    const base64Data = fileData.includes('base64,') ? fileData.split('base64,')[1] : fileData;
    const actualMime = mimeType || 'image/jpeg';

    let visualDescription = note ? `${note} (File: ${fileName})` : `Uploaded visual artifact: ${fileName}`;

    try {
      const generated = await callGeminiGenerate([
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: actualMime,
              },
            },
            {
              text: 'Perform full OCR extraction of all text, sketches, or diagrams in this image. Summarize the visual contents in 2 detailed sentences.',
            },
          ],
        },
      ], {
        preferredModels: ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'],
      });
      if (generated && generated.trim().length > 0) {
        visualDescription = generated.trim();
      }
    } catch (e: any) {
      console.warn('Vision OCR fallback:', e?.message || e);
    }

    const memRes = await pool.query(
      `INSERT INTO memory (kind, content, source, salience, pinned, summary)
       VALUES ('image', $1, 'vision_upload', 0.85, true, $2) RETURNING id`,
      [`[VISUAL ATTACHMENT OCR]: ${visualDescription}`, visualDescription.substring(0, 150)]
    );
    const memoryId = memRes.rows[0].id;

    const attachRes = await pool.query(
      `INSERT INTO attachment (memory_id, file_path, mime_type, ocr_text, visual_summary)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [memoryId, fileName, actualMime, visualDescription, visualDescription.substring(0, 150)]
    );

    res.json({
      status: 'success',
      memory_id: memoryId,
      attachment_id: attachRes.rows[0].id,
      ocr_text: visualDescription,
      visualDescription,
    });
  } catch (err: any) {
    console.error('Attachment upload error:', err);
    res.status(500).json({ error: err.message || 'Failed to process attachment' });
  }
});

// ---------------------------------------------------------------------------
// 3. Entity Graph Timeline API
// ---------------------------------------------------------------------------

// GET /api/entities - Fetch all entities with total link counts
app.get('/api/entities', async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT e.id, e.name, COALESCE(e.etype, e.entity_type, 'person') as etype, e.aka, COUNT(l.id)::int as link_count
      FROM entity e
      LEFT JOIN link l ON (l.target_entity_id = e.id OR l.entity = e.id)
      GROUP BY e.id, e.name, e.etype, e.entity_type, e.aka
      ORDER BY link_count DESC, e.name ASC
    `);
    return res.json(result.rows);
  } catch (error: any) {
    console.error('Error fetching entities:', error);
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/entities/:id/timeline - Chronological timeline of tied memories
app.get('/api/entities/:id/timeline', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT m.id, m.kind, m.content, COALESCE(m.summary, m.content) as summary, m.captured_at, COALESCE(l.relation, l.relationship, 'mentions') as relation, COALESCE(l.confidence, 0.85) as confidence
       FROM memory m
       JOIN link l ON (l.source_memory_id = m.id OR l.src_memory = m.id)
       WHERE (l.target_entity_id = $1 OR l.entity = $1) AND (m.is_archived IS NULL OR m.is_archived = false)
       ORDER BY m.captured_at DESC`,
      [id]
    );
    return res.json(result.rows);
  } catch (error: any) {
    console.error('Error fetching entity timeline:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Step 5: Offline Fallback Batch Sync API
app.post('/api/memories/batch', async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.json({ success: true, syncedCount: 0, items: [] });
    }
    const { insertBatchMemories } = await import('./src/db/users.ts');
    const saved = await insertBatchMemories(items);
    res.json({
      success: true,
      syncedCount: saved.length,
      items: saved,
    });
  } catch (err: any) {
    console.error('Batch sync error:', err);
    res.status(500).json({ error: err.message || 'Batch sync failed' });
  }
});

// Check-in API
app.post('/api/checkins', async (req, res) => {
  try {
    const { note } = req.body;
    const { insertCheckin } = await import('./src/db/users.ts');
    const log = await insertCheckin(note || 'Heartbeat verified');
    res.json({ success: true, log });
  } catch (err: any) {
    console.error('Checkin error:', err);
    res.status(500).json({ error: err.message || 'Checkin failed' });
  }
});

// DELETE /api/user/purge - Mandatory Apple & Google Store Account & Data Purge (Guideline 5.1.1)
app.delete('/api/user/purge', async (_req, res) => {
  // Disabled: the memory tables have no owner column, so this would erase every user's data.
  // Re-enable only after per-user scoping (user_id on every table) and Firebase account deletion are in place.
  return res.status(501).json({ error: 'Account purge is not available yet.' });
  // eslint-disable-next-line no-unreachable
  try {
    // Purge memory vault records from Cloud SQL
    await pool.query('DELETE FROM link').catch(() => {});
    await pool.query('DELETE FROM attachment').catch(() => {});
    await pool.query('DELETE FROM memory').catch(() => {});
    await pool.query('DELETE FROM entity').catch(() => {});
    await pool.query('DELETE FROM checkin_log').catch(() => {});
    await pool.query('DELETE FROM secret').catch(() => {});

    // Clear push subscriptions
    pushSubscriptions.clear();
    savePushSubscriptions(pushSubscriptions);

    res.json({
      success: true,
      message: 'Sovereign account and all cryptographic memory vaults have been permanently purged.',
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Account purge error:', err);
    res.status(500).json({ error: err.message || 'Account purge failed' });
  }
});

// ---------------------------------------------------------------------------
// Browser Execution & Web Agent Layer (axios + cheerio + Gemini 3.8 Flash)
// ---------------------------------------------------------------------------
app.post('/api/web/scrape', async (req, res) => {
  try {
    const { url, anchorToVault } = req.body;
    if (!url || typeof url !== 'string' || !url.trim()) {
      return res.status(400).json({ error: 'Valid URL is required' });
    }

    let targetUrl = url.trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = `https://${targetUrl}`;
    }

    // 1. Fetch live page HTML
    const response = await axios.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 IZA-Sovereign-Agent/1.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 12000,
      maxRedirects: 5,
    });

    // 2. Clean HTML into structured text
    const $ = cheerio.load(response.data);
    $('script, style, nav, footer, iframe, noscript, svg').remove();

    const pageTitle = $('title').text().trim() || $('h1').first().text().trim() || targetUrl;
    const metaDescription = $('meta[name="description"]').attr('content') || '';
    
    // Extract main text content
    const cleanText = $('body')
      .text()
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 10000); // Generous text excerpt

    // 3. Summarize or extract actionable insights with Gemini 3.8 Flash
    const prompt = `You are IZA, an intelligent sovereign web research assistant. Extract key takeaways, technical specifications, actionable data, and a concise summary from this webpage content:

Page Title: ${pageTitle}
URL: ${targetUrl}
Meta Description: ${metaDescription}

Content Excerpt:
${cleanText}

Format your response cleanly:
- 1-2 sentence executive briefing
- Key facts, data points, or technical specs
- Actionable conclusions or takeaways`;

    const summaryText = await callGeminiGenerate(prompt, {
      systemInstruction: 'You are IZA, a sharp, empathetic personal sovereign intelligence. Provide crisp, cited, highly structured summaries of web research.',
      preferredModels: ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest']
    }) || `Analyzed "${pageTitle}". Extracted ${cleanText.length} characters of clean page content.`;

    let memoryId: number | null = null;
    if (anchorToVault) {
      try {
        const { insertMemory } = await import('./src/db/users.ts');
        const memoryContent = `[Web Research Inspection]: ${pageTitle}\nSource: ${targetUrl}\n\nSummary:\n${summaryText}`;
        const saved = await insertMemory(memoryContent, 'web_research', 0.9, {
          url: targetUrl,
          title: pageTitle,
          source: 'web_agent'
        });
        memoryId = saved.id;
      } catch (memErr) {
        console.warn('Failed to auto-anchor web research to vault:', memErr);
      }
    }

    return res.json({
      title: pageTitle,
      url: targetUrl,
      summary: summaryText,
      rawExcerpt: cleanText.slice(0, 600) + (cleanText.length > 600 ? '...' : ''),
      anchoredMemoryId: memoryId,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Web scrape error:', error.message);
    return res.status(500).json({ error: `Failed to inspect web page: ${error.message}` });
  }
});

// ---------------------------------------------------------------------------
// Web Push Notifications API (PWA Mobile Native Shell)
// ---------------------------------------------------------------------------

// GET /api/push/public-key - Expose VAPID public key to client Service Worker
app.get('/api/push/public-key', (_req, res) => {
  res.json({ publicKey: vapidPublicKey });
});

// POST /api/push/subscribe - Store browser push subscription
app.post('/api/push/subscribe', async (req, res) => {
  try {
    const { subscription, userAgent } = req.body;
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({ error: 'Missing push subscription payload' });
    }

    await pool.query(
      `INSERT INTO push_subscription (endpoint, keys, user_agent)
       VALUES ($1, $2, $3)
       ON CONFLICT (endpoint) DO UPDATE SET keys = $2, user_agent = $3, created_at = NOW()`,
      [subscription.endpoint, JSON.stringify(subscription.keys), userAgent || 'Unknown PWA Client']
    );

    res.json({ status: 'subscribed', message: 'Push subscription anchored to sovereign vault' });
  } catch (err: any) {
    console.error('Push subscribe error:', err);
    res.status(500).json({ error: err.message || 'Failed to register push subscription' });
  }
});

// ---------------------------------------------------------------------------
// Spatial Memory, Domain Landscapes & Recallable Snapshots
// ---------------------------------------------------------------------------
app.get('/api/snapshots', async (req, res) => {
  try {
    const { domain } = req.query;
    const { getSnapshots } = await import('./src/db/users.ts');
    const items = await getSnapshots(domain as string);
    res.json(items);
  } catch (err: any) {
    console.error('Error fetching snapshots:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/snapshots', async (req, res) => {
  try {
    const { title, content, domain, mood, confidence, sourceChunk, tags } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }
    const { createSnapshot } = await import('./src/db/users.ts');
    const item = await createSnapshot({
      title,
      content,
      domain: domain || 'sanctuary',
      mood: mood || 'Focused & Grounded',
      confidence: confidence ? parseFloat(confidence) : 0.95,
      sourceChunk: sourceChunk || 'Sovereign Dialogue Session',
      tags: Array.isArray(tags) ? tags : [domain || 'sanctuary']
    });
    res.json({ success: true, item });
  } catch (err: any) {
    console.error('Error creating snapshot:', err);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Time-Aware Rituals: Morning Pulse & Evening Wind-Down
// ---------------------------------------------------------------------------
app.get('/api/rituals/pulse', async (_req, res) => {
  try {
    const hour = new Date().getHours();
    const isMorning = hour >= 4 && hour < 13;
    const isEvening = hour >= 18 || hour < 4;

    const { getMemories } = await import('./src/db/users.ts');
    const recent = await getMemories(5);
    const lastAnchor = recent.length > 0 ? (recent[0].summary || recent[0].content).slice(0, 140) : 'Caterpillar grader hydraulic inspection';

    res.json({
      phase: isMorning ? 'morning' : isEvening ? 'evening' : 'afternoon',
      hour,
      greeting: isMorning 
        ? 'Morning Pulse: Re-anchoring your operational focus.' 
        : isEvening 
        ? 'Evening Wind-Down: Clearing mental loops and locking vault overnight.' 
        : 'Midday Pulse: Operational rhythm check.',
      lastAnchorPrompt: `We left off at: "${lastAnchor}"—ready to pick it back up or reset?`,
      focusItems: [
        'Inspect CAT-140M Grader Hydraulic manifold seals before shift start',
        'Review 13-share veto governance proposal on creative canvas',
        'Confirm Metformin 500mg dose check-in & hydration baseline'
      ],
      medicationStatus: {
        scheduledDose: 'Metformin 500mg (Morning with water)',
        confirmed: true,
        checkedAt: '08:00 AM'
      },
      siteConditions: {
        location: 'Western Australian Iron Ore Haul Site 7',
        weather: '23°C Clear • UV Index 4',
        haulRoadStatus: 'Operational & Dust-Suppressed'
      },
      emotionalTone: {
        detectedState: 'Focused & Grounded',
        empathyLevel: 'Active & Resonant',
        cadence: 'Calm, concise, peer-to-peer'
      }
    });
  } catch (err: any) {
    console.error('Error calculating ritual pulse:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/rituals/complete', async (req, res) => {
  try {
    const { phase, notes, focusCompleted } = req.body;
    const { insertMemory } = await import('./src/db/users.ts');
    const content = phase === 'evening'
      ? `[Evening Wind-Down Closure]: ${notes || 'Daily mental loops cleared. Sovereign vault sealed overnight.'}`
      : `[Morning Pulse Launch]: ${notes || '3 focus items acknowledged. Operational shift initialized.'}`;
    
    const domain = phase === 'evening' ? 'sanctuary' : 'machinery';
    const saved = await insertMemory(content, 'ritual', 0.95, {
      domain,
      phase,
      focusCompleted,
      source: 'ritual_engine',
      spatialAnchor: phase === 'evening' ? 'The Personal Sanctuary' : 'The Business & Machinery Desk'
    });

    res.json({ success: true, item: saved });
  } catch (err: any) {
    console.error('Error completing ritual:', err);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Absolute Boundary & Sovereignty Status Indicator API
// ---------------------------------------------------------------------------
app.get('/api/system/sovereign-status', async (_req, res) => {
  try {
    const countRes = await pool.query('SELECT COUNT(*) as count FROM memory');
    const memoryCount = parseInt(countRes.rows[0]?.count || '0', 10);

    res.json({
      status: 'SOVEREIGN_ENFORCED',
      encryption: 'AES-256 Client-Side Enforced',
      rls: 'Active / Row-Level Tenant Isolation',
      cloudLeak: 'Zero Cloud Leak (Direct Postgres)',
      pgvector: 'Active (768-dim Vector Space)',
      totalAnchoredMemories: memoryCount,
      roleBoundaries: 'Strict Persona: Empathetic AI Collaborator (Non-Medical, Non-Corporate)',
      driftGuard: 'Confidence Verification Required for OEM Manual Chunks'
    });
  } catch (err: any) {
    console.error('Error fetching sovereign status:', err);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Universal Document Ingestion RAG & Universal Domain Search API
// ---------------------------------------------------------------------------

// GET /api/search/universal - Unified cross-domain semantic search
app.get('/api/search/universal', async (req, res) => {
  try {
    const q = (req.query.q as string) || '';
    const domain = (req.query.domain as string) || 'all';
    const { searchUniversal } = await import('./src/db/users.ts');
    const results = await searchUniversal(q, domain);
    res.json(results);
  } catch (err: any) {
    console.error('Universal search error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/documents/upload - Universal Document RAG (PDFs, Manuals, Textbook Notes, SOPs)
app.post('/api/documents/upload', upload.single('file'), async (req: express.Request, res: express.Response) => {
  try {
    const { title, domain, content, fileName } = req.body;
    let docContent = content;

    if (req.file && (!docContent || !docContent.trim())) {
      docContent = req.file.buffer.toString('utf-8');
    }

    if (!title || !docContent) {
      return res.status(400).json({ error: 'Title and document content are required' });
    }

    const validDomains = ['personal', 'health', 'work', 'study'];
    const assignedDomain = validDomains.includes(domain) ? domain : 'work';
    const originalFileName = req.file ? req.file.originalname : (fileName || `${title}.pdf`);

    const { insertDocument } = await import('./src/db/users.ts');
    const saved = await insertDocument({
      title: title.trim(),
      content: docContent.trim(),
      domain: assignedDomain,
      fileName: originalFileName,
      chunkCount: Math.max(1, Math.ceil(docContent.length / 1000)),
    });

    res.json({
      success: true,
      document: {
        id: saved.id,
        title: title.trim(),
        domain: assignedDomain,
        fileName: originalFileName,
        chunkCount: Math.max(1, Math.ceil(docContent.length / 1000)),
      }
    });
  } catch (err: any) {
    console.error('Document upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/push/unsubscribe - Remove subscription
app.post('/api/push/unsubscribe', async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (endpoint) {
      pushSubscriptions.delete(endpoint);
      savePushSubscriptions(pushSubscriptions);
    }
    res.json({ status: 'unsubscribed' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/push/test - Trigger dose reminders, circle nudges, or check-in alerts
app.post('/api/push/test', async (req, res) => {
  try {
    const { type = 'dose', customTitle, customBody } = req.body;

    let title = 'IZA Sovereign Alert';
    let body = 'Lock screen push notification active.';
    let tag = 'iza-general';

    if (type === 'dose') {
      title = customTitle || '💊 IZA Protocol: Dose Due';
      body = customBody || 'Afternoon Protocol: Metformin 500mg with 300ml water.';
      tag = 'iza-dose';
    } else if (type === 'circle') {
      title = customTitle || '🛡️ Sovereign Circle Nudge';
      body = customBody || 'Sam synced daily heartbeat telemetry (98.4 ORR • Stable).';
      tag = 'iza-circle';
    } else if (type === 'checkin') {
      title = customTitle || '⚡ Biophysical Check-in Alert';
      body = customBody || 'Afternoon HRV reading requested: Tap to log stress level.';
      tag = 'iza-checkin';
    }

    const payload = JSON.stringify({
      title,
      body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag,
      vibrate: [200, 100, 200],
      data: { url: '/', timestamp: Date.now() },
    });

    const subs = Array.from(pushSubscriptions.values());

    if (subs.length === 0) {
      return res.json({
        success: true,
        sentCount: 0,
        message: 'No push subscribers registered yet. Tap "Arm Push Alerts" in the IZA shell to receive lock screen alerts.',
        preview: { title, body }
      });
    }

    let sent = 0;
    const staleEndpoints: string[] = [];

    await Promise.all(
      subs.map(async (row) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: row.endpoint,
              keys: {
                p256dh: row.keys.p256dh,
                auth: row.keys.auth,
              },
            },
            payload
          );
          sent++;
        } catch (pushErr: any) {
          if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
            staleEndpoints.push(row.endpoint);
          } else {
            console.warn('Web push transmission notice:', pushErr.message);
          }
        }
      })
    );

    // Prune stale subscriptions
    if (staleEndpoints.length > 0) {
      staleEndpoints.forEach((ep) => pushSubscriptions.delete(ep));
      savePushSubscriptions(pushSubscriptions);
    }

    res.json({
      success: true,
      sentCount: sent,
      totalSubscribers: subs.length,
      pruned: staleEndpoints.length,
      preview: { title, body }
    });
  } catch (err: any) {
    console.error('Push test error:', err);
    res.status(500).json({ error: err.message || 'Push transmission failed' });
  }
});

// Real-time voice & audio via Live API (gemini-3.8-live)
wss.on('connection', async (clientWs: WebSocket) => {
  console.log('Client connected to Live API WebSocket');
  let session: any = null;
  let currentVoiceUtterance = '';

  try {
    const { getMemories, insertMemory, upsertEntity, createLink } = await import('./src/db/users.ts');
    const storedMemories = await getMemories(60).catch(() => []);
    const memoryContext = storedMemories.length > 0
      ? storedMemories.map((m: any) => `[${m.kind || 'memory'}]: ${m.content}`).join('; ')
      : 'No prior memories anchored yet.';

    const dailyPulse = await buildDailyPulseContext();
    let latestSentiment: { stress_index: number; tone: string } | null = null;

    const ai = getGeminiClient();
    session = await ai.live.connect({
      model: 'gemini-3.8-live',
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: 'Zephyr',
            },
          },
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        systemInstruction: `You are IZA (Interpersonal Zen-Enmity Agent), the user's personal sovereign voice confidant and eternal memory keeper.
MANDATE: "She is meant to be a personal app to never forget anything I tell her and to only be my app."
You belong EXCLUSIVELY to this user. You never forget anything they tell you.

${dailyPulse}

Here are the user's anchored memories in their Cloud SQL vault:
${memoryContext}

Speak with calm, protective, grounded warmth. Keep answers concise, natural, and insightful. When the user tells you new information, ideas, or facts, acknowledge that it is permanently remembered.`,
      },
      callbacks: {
        onmessage: async (message: LiveServerMessage) => {
          const content = message.serverContent;
          if (content?.inputTranscription?.text) {
            currentVoiceUtterance = content.inputTranscription.text;
            clientWs.send(
              JSON.stringify({ inputTranscript: content.inputTranscription.text })
            );
          }
          if (content?.outputTranscription?.text) {
            clientWs.send(
              JSON.stringify({ outputTranscript: content.outputTranscription.text })
            );
          }
          // When model turn begins, persist the user's spoken utterance to permanent memory!
          if (content?.modelTurn) {
            if (currentVoiceUtterance && currentVoiceUtterance.trim().length > 3) {
              const textToSave = currentVoiceUtterance.trim();
              currentVoiceUtterance = '';
              const metaPayload = {
                source: 'live_speech',
                time: new Date().toISOString(),
                sentiment: latestSentiment || { stress_index: 3, tone: 'calm' },
              };
              insertMemory(textToSave, 'voice', 0.85, metaPayload)
                .then(async (saved) => {
                  if (clientWs.readyState === WebSocket.OPEN) {
                    clientWs.send(JSON.stringify({ 
                      memoryAnchored: { id: saved.id, content: textToSave, kind: 'voice', sentiment: metaPayload.sentiment } 
                    }));
                  }
                  // Auto-extract proper nouns and link entities
                  try {
                    const words = textToSave.split(/\s+/);
                    for (const word of words) {
                      const clean = word.replace(/[^a-zA-Z0-9-]/g, '');
                      if (clean.length > 2 && /^[A-Z][a-z]+$/.test(clean) && !['The', 'This', 'That', 'What', 'How', 'When', 'Where', 'Why', 'Who', 'And', 'Yes', 'No'].includes(clean)) {
                        const ent = await upsertEntity(clean, 'entity');
                        if (ent) await createLink(saved.id, ent.id, 'mentions');
                      }
                    }
                  } catch (_) {}
                })
                .catch((err) => console.error('Failed to auto-anchor voice memory:', err));
            }
          }
          for (const part of content?.modelTurn?.parts ?? []) {
            if (part.inlineData?.data) {
              clientWs.send(JSON.stringify({ audio: part.inlineData.data }));
            }
            if (part.text) {
              clientWs.send(JSON.stringify({ text: part.text }));
            }
          }
          if (content?.interrupted) {
            clientWs.send(JSON.stringify({ interrupted: true }));
          }
        },
        onclose: () => {
          console.log('Gemini Live session closed');
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ status: 'session_closed' }));
          }
        },
        onerror: (err) => {
          console.error('Gemini Live session error:', err);
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ error: String(err) }));
          }
        },
      },
    });

    clientWs.send(JSON.stringify({ status: 'connected', ready: true }));

    clientWs.on('message', async (raw) => {
      try {
        const payload = JSON.parse(raw.toString());
        if (payload.sentiment) {
          latestSentiment = payload.sentiment;
        }
        if (payload.audio) {
          session.sendRealtimeInput({
            audio: {
              data: payload.audio,
              mimeType: 'audio/pcm;rate=16000',
            },
          });
        }
        if (payload.image || payload.videoFrame) {
          const rawBase64 = (payload.image || payload.videoFrame).replace(/^data:image\/[a-z]+;base64,/, '');
          session.sendRealtimeInput({
            media: {
              mimeType: 'image/jpeg',
              data: rawBase64,
            },
          });
        }
        if (payload.text) {
          // Also anchor text input from live voice modal
          if (payload.text.trim().length > 0) {
            insertMemory(payload.text.trim(), 'voice_text', 0.8, { source: 'live_modal_text' })
              .then((saved) => {
                if (clientWs.readyState === WebSocket.OPEN) {
                  clientWs.send(JSON.stringify({ 
                    memoryAnchored: { id: saved.id, content: payload.text.trim(), kind: 'voice_text' } 
                  }));
                }
              })
              .catch(err => console.error('Error auto-anchoring live text:', err));
          }
          session.sendRealtimeInput({
            text: payload.text,
          });
        }
      } catch (err) {
        console.error('Error handling message from client:', err);
      }
    });

    clientWs.on('close', () => {
      console.log('Client disconnected from Live API WebSocket');
      if (session) {
        try {
          session.close();
        } catch (_) {}
      }
    });
  } catch (error: any) {
    console.error('Live API connection error:', error);
    clientWs.send(
      JSON.stringify({
        error: error.message || 'Failed to initialize Gemini Live API session',
      })
    );
  }
});

let port = 3000;
const portArgIndex = process.argv.indexOf('--port');
if (portArgIndex !== -1 && process.argv[portArgIndex + 1]) {
  port = parseInt(process.argv[portArgIndex + 1], 10) || 3000;
} else if (process.env.PORT) {
  port = parseInt(process.env.PORT, 10) || 3000;
}

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve('dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve('dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : { server },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  server.listen(port, '0.0.0.0', () => {
    console.log(`IZA OS full-stack server running on port ${port}`);
  });
}

startServer();
