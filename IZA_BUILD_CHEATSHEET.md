# IZA OS — Complete Build Cheat Sheet & Architectural Reference

> **Trinitarian Operating System for Human Sovereignty, Biophysical Telemetry, and Episodic Memory**

---

## 1. System Overview & Trinitarian Architecture

IZA operates across three closed sovereign loops designed to protect cognitive sovereignty, harvest ambient energy, and provide un-rewritable personal continuity:

```
                          ┌─────────────────────────────────────┐
                          │            IZA MASTER UI            │
                          │   Human Sovereignty Control Center  │
                          └──────────────────┬──────────────────┘
                                             │
        ┌────────────────────────────────────┼────────────────────────────────────┐
        ▼                                    ▼                                    ▼
 ┌───────────────┐                    ┌──────────────┐                    ┌───────────────┐
 │   LOOP 1:     │                    │   LOOP 2:    │                    │   LOOP 3:     │
 │ Internal Loop │                    │ Ambient Loop │                    │Execution Loop │
 └───────┬───────┘                    └──────┬───────┘                    └───────┬───────┘
         │                                   │                                    │
  Biophysical Engine                  Interpersonal Zen                   Sovereign Vault &
  • ORR Oxygen Reduction              • Tone profiling                    • 6-table relational
  • TEG Thermoelectric                • Narrative defense                   Postgres + pgvector
  • TENG Kinetic                      • Integrity warning                 • Continuity secrets
  • Live telemetry (BPM,              • Audio telemetry stream            • Trusted circle &
    power, stress)                                                          emergency SOS
```

---

## 2. Infrastructure & Environment Specifications

| Component | Technology | Configuration / Port |
|---|---|---|
| **Frontend Framework** | React 19 + TypeScript + Vite | Port `3000` (Mounted via Express `vite.middlewares`) |
| **Styling** | Tailwind CSS v4 (`@tailwindcss/vite`) | Dark industrial palette (`#020617` / `#0f172a`) |
| **Backend Server** | Node.js + Express + `ws` (WebSockets) | `server.ts` listening on `0.0.0.0:3000` |
| **Relational Database** | PostgreSQL 16 on Google Cloud SQL | Region: `asia-southeast1`, Instance: `ai-studio-a9c88bb8` |
| **Vector Engine** | `pgvector` extension | `vector(768)` embeddings for semantic recall |
| **AI Voice Engine** | Gemini 3.8 Live API (`gemini-3.8-live`) | Low-latency duplex audio (16kHz in / 24kHz out, Voice: `Zephyr`) |
| **AI Confidant Engine** | Gemini 3.8 Flash (`gemini-3.8-flash`) | De-escalation & narrative protection prompt |
| **Authentication** | Firebase Auth (Google Sign-In) | Client-side popup + token verification |

---

## 3. Database Schema & Vector Indexing (Phase 0)

All persistent tables are defined in PostgreSQL with `CREATE EXTENSION IF NOT EXISTS vector;`:

```sql
-- 1. Atomic Memory Table
CREATE TABLE IF NOT EXISTS memory (
  id BIGSERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  kind VARCHAR(32) NOT NULL DEFAULT 'note', -- 'note' | 'convo' | 'voice' | 'link' | 'decision'
  salience REAL NOT NULL DEFAULT 0.5,        -- Priority weight: 0.0 to 1.0
  embedding vector(768),                     -- 768-dimensional semantic embedding
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memory_captured_at ON memory(captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_memory_kind ON memory(kind);

-- 2. Durable Real-World Entities
CREATE TABLE IF NOT EXISTS entity (
  id BIGSERIAL PRIMARY KEY,
  canonical_name VARCHAR(255) NOT NULL UNIQUE,
  entity_type VARCHAR(64) NOT NULL DEFAULT 'person', -- 'person' | 'place' | 'concept' | 'org'
  aliases TEXT[] DEFAULT '{}',
  notes TEXT,
  embedding vector(768),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Knowledge Graph Links
CREATE TABLE IF NOT EXISTS link (
  id BIGSERIAL PRIMARY KEY,
  source_type VARCHAR(32) NOT NULL, -- 'memory' | 'entity'
  source_id BIGINT NOT NULL,
  target_type VARCHAR(32) NOT NULL,
  target_id BIGINT NOT NULL,
  relation VARCHAR(64) NOT NULL,    -- 'mentions' | 'caused' | 'supports' | 'contradicts'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Media & Binary Attachments
CREATE TABLE IF NOT EXISTS attachment (
  id BIGSERIAL PRIMARY KEY,
  memory_id BIGINT REFERENCES memory(id) ON DELETE CASCADE,
  mime_type VARCHAR(128) NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. The Continuity Vault (Strictly Isolated, NEVER Embedded)
CREATE TABLE IF NOT EXISTS secret (
  id BIGSERIAL PRIMARY KEY,
  label VARCHAR(128) NOT NULL,
  ciphertext TEXT NOT NULL,         -- libsodium SecretBox / AES-GCM ciphertext
  nonce VARCHAR(64) NOT NULL,       -- Cryptographic nonce
  salt VARCHAR(64) NOT NULL,        -- Argon2id salt
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Trusted Circle & Safety Heartbeats
CREATE TABLE IF NOT EXISTS circle_member (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  relationship VARCHAR(64) NOT NULL,
  contact_info TEXT,
  max_days_between_contact INT DEFAULT 7,
  last_contact_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS checkin_log (
  id BIGSERIAL PRIMARY KEY,
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT
);

-- 7. Hybrid Recall Function (Semantic + Recency Decay + Salience)
CREATE OR REPLACE FUNCTION recall(
  query_embedding vector(768),
  match_limit INT DEFAULT 10,
  w_sim REAL DEFAULT 0.60,
  w_rec REAL DEFAULT 0.25,
  w_sal REAL DEFAULT 0.15
)
RETURNS TABLE (
  id BIGINT,
  content TEXT,
  kind VARCHAR(32),
  salience REAL,
  score REAL,
  captured_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.content,
    m.kind,
    m.salience,
    (
      w_sim * (1 - (m.embedding <=> query_embedding)) +
      w_rec * EXP(-EXTRACT(EPOCH FROM (NOW() - m.captured_at)) / (86400.0 * 180.0)) +
      w_sal * m.salience
    )::REAL AS score,
    m.captured_at
  FROM memory m
  WHERE m.embedding IS NOT NULL
  ORDER BY score DESC
  LIMIT match_limit;
END;
$$ LANGUAGE plpgsql;
```

---

## 4. CLI Command Dictionary

The interactive terminal input accepts native IZA commands:

| Command | Action | Example |
|---|---|---|
| `iza capture "<text>"` | Stores raw observation/memory into Cloud SQL with timestamp | `iza capture "Dave mentioned post-hole digger for boundary fence"` |
| `iza secret-put "<label>" "<text>"` | Stores locked secret into Continuity Vault | `iza secret-put "Bank PIN" "9482"` |
| `iza circle-add "<name>" "<rel>"` | Registers trusted human ally to circle | `iza circle-add "Sarah Chen" "Spouse"` |
| `iza talk` / `iza confidant` | Opens the Gemini 3.8 Flash de-escalation chat | `iza talk` |
| `iza listen` / `iza voice` | Launches full-duplex Gemini 3.8 Live voice modal | `iza voice` |
| `iza enrich` | Triggers proactive memory synthesis & entity graph extraction | `iza enrich` |
| `iza entities` / `iza graph` | Opens the Knowledge Graph & Entity Timeline Drawer | `iza graph` |
| `iza attach` / `iza photo` | Opens the Multi-Modal Visual Ingestion drop-zone | `iza attach` |
| `iza recall "<query>"` | Filters and recalls memories matching a semantic or keyword search | `iza recall "dose he owe me anything"` |
| `iza delete-search "<q>"` | Deletes all memories matching keyword from Cloud SQL | `iza delete-search "dose he owe me"` |
| `iza forget "<q>"` | Synonym for delete-search | `iza forget "with him."` |
| `iza checkin "<note>"` | Records a daily heartbeat & wellness log | `iza checkin "Feeling grounded and focused"` |
| `iza sync` | Manually flushes local IndexedDB offline cache to Cloud SQL | `iza sync` |
| `iza sos` / `iza emergency` | Triggers SOS emergency broadcast & override | `iza sos` |
| `iza purge` | Neutralizes external narrative threats and clears alerts | `iza purge` |

---

## 5. Gemini 3.8 Live API Audio & WebSocket Protocol

Bidirectional voice streaming operates over WebSocket at `/live`:

```
 [User Microphone] ──> (16kHz PCM 16-bit LE) ──> Base64 ──> WebSocket (/live)
                                                                    │
                                                                    ▼
                                                            Gemini Live API
                                                           (gemini-3.8-live)
                                                                    │
                                                                    ▼
 [Audio Output]   <── Gapless Scheduling <── 24kHz PCM <── WebSocket (/live)
```

### Audio Client & Sentiment Telemetry Specifications
- **Input:** `ScriptProcessorNode` capturing 2048-sample frames (~128ms) at **16,000 Hz**, converted from 32-bit Float to 16-bit Signed Little-Endian Integer (`pcm;rate=16000`).
- **Output:** 24,000 Hz mono PCM decoded from Base64 into `AudioBuffer` and played via `AudioBufferSourceNode` with gapless start scheduling.
- **Transcripts:** Real-time dual streams: `inputTranscript` (user thought) and `outputTranscript` (IZA answer).
- **Voice Sentiment Tagging:** Computes spectral zero-crossing rate and RMS energy in real time, determining `stress_index` (1..10) and inferred `tone` (`"calm"`, `"focused"`, `"strained"`, `"elevated"`).
- **Ambient Hotword ("Hey IZA"):** Uses local browser speech recognition to detect "Hey IZA" hands-free and activate the live audio session.
- **Daily Pulse Grounding:** On every session connection, IZA fetches the last 24 hours of check-ins, recent memories, and high-salience priorities, injecting a dynamic Daily Pulse directly into her system instructions.

---

## 6. Server REST Endpoints (`server.ts`)

| Route | Method | Body / Query | Description |
|---|---|---|---|
| `/api/gemini/chat` | `POST` | `{ message: string, history: Array }` | De-escalation & tactical advice via `gemini-3.8-flash` with Daily Pulse |
| `/api/memories` | `GET` | `?limit=50` | Retrieves latest episodic memories from Cloud SQL |
| `/api/memories` | `POST` | `{ content, kind, salience }` | Inserts new memory record into PostgreSQL |
| `/api/memories/search` | `GET` | `?q=query` | Searches memories by text/summary keyword |
| `/api/memories/search` | `DELETE` | `?q=query` | Deletes all memories matching keyword from Cloud SQL |
| `/api/memories/:id` | `DELETE` | — | Deletes a single memory record safely |
| `/api/memories/enrich` | `POST` | — | Proactively synthesizes un-enriched memories, extracts summaries & entities |
| `/api/attachments` | `POST` | `{ fileName, mimeType, fileData, note }` | Multi-modal visual ingestion (photos, sketches, schematics) |
| `/api/entities` | `GET` | — | Retrieves all durable entities (people, places, projects, tools) |
| `/api/entities/:id/timeline` | `GET` | — | Returns complete chronological timeline of memories linked to an entity |
| `/api/memories/batch` | `POST` | `{ items: Array }` | Flushes offline IndexedDB memories to Cloud SQL |
| `/api/checkins` | `POST` | `{ note: string }` | Records daily heartbeat log |
| `/api/circle` | `GET` | — | Retrieves all trusted circle contacts |
| `/api/secrets` | `GET` | — | Retrieves list of secret labels (ciphertexts protected) |

---

## 7. Key Files & Project Layout

```
├── server.ts                    # Full-stack Node/Express server + WebSocket /live bridge
├── index.html                   # HTML entry point with synchronized metadata & title
├── metadata.json                # AI Studio manifest (permissions: ["microphone"], server Gemini)
├── package.json                 # Dependencies (React 19, @google/genai, drizzle-orm, pg, ws)
├── schema.sql                   # Raw PostgreSQL Phase 0 DDL & recall() function
├── src/
│   ├── App.tsx                  # Master UI dashboard (Internal, Ambient, Execution loops)
│   ├── main.tsx                 # React DOM bootstrap
│   ├── db/
│   │   ├── schema.ts            # Drizzle ORM table definitions
│   │   ├── index.ts             # Connection pool & Drizzle client
│   │   ├── users.ts             # Cloud SQL CRUD helper functions
│   │   └── drizzle.config.ts    # Drizzle Kit configuration
│   ├── lib/
│   │   ├── live-audio.ts        # Gemini 3.8 Live API WebSocket client & PCM audio pipeline
│   │   ├── firebase.ts          # Firebase Auth client (Google Sign-In with popup handling)
│   │   └── firebase-admin.ts    # Firebase Admin token verification
│   ├── components/
│   │   └── LiveVoiceModal.tsx   # Duplex voice conversation modal with visualizer orb
│   └── middleware/
│       └── auth.ts              # Bearer token authentication middleware
```

---

## 8. Maintenance & Runbook Commands

- **Start Dev Server:** `npm run dev` (Runs `tsx server.ts` on port 3000)
- **Compile & Typecheck:** `npm run build`
- **Lint Codebase:** `npm run lint`
- **Check Dev Server Status:** `curl -I http://localhost:3000/`
- **Check Cloud SQL Connection:** `curl -s http://localhost:3000/api/memories`
- **Restart Development Server:** Via AI Studio restart tool or `restart_dev_server`
