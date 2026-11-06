# IZA OS — Repo-Accurate Architecture Snapshot

> This version reflects what is actually implemented in this workspace, not the more idealized product vision.

---

## 1. What this project really is

This app is a full-stack personal intelligence dashboard built with React, Express, Firebase Auth, PostgreSQL, and Gemini-based AI features.

The product intent is clear: a personal memory vault, confidant chat, daily pulse, knowledge graph, and live voice interaction layer. The codebase implements those concepts in a practical, prototype-friendly way.

---

## 2. Runtime architecture

The app is structured as:

- Frontend: React 19 + TypeScript + Vite
- Backend: Node.js + Express + WebSockets
- Database: PostgreSQL via Drizzle ORM
- Auth: Firebase Auth
- AI: Google Gemini models accessed through the official SDK
- PWA support: service worker / push subscription support
- Mobile shell: Capacitor for Android and iOS

The main runtime entry is [server.ts](server.ts), which boots the API server and WebSocket upgrade routing.

---

## 3. Key implementation facts

### Frontend
The UI is built in [src/App.tsx](src/App.tsx) and includes:

- Daily Pulse briefing header
- Internal Loop / Ambient Loop / Execution-oriented dashboard sections
- memory vault display
- knowledge graph / entity browser
- confidant chat panel
- live voice modal flow
- upload / enrichment controls

### Backend
The server in [server.ts](server.ts) includes:

- Firebase auth enforcement for most /api routes
- Express JSON handling
- WebSocket upgrades for /live
- Gemini generation calls with retry/fallback model logic
- push notification handling
- file upload support with multer
- memory storage and API endpoints

### Database
The schema in [src/db/schema.ts](src/db/schema.ts) defines the actual persisted entities:

- users
- memory
- entity
- link
- attachment
- daily_pulse
- medication
- checkin
- secret
- circle_member
- checkin_log

The data access layer is in [src/db/users.ts](src/db/users.ts).

---

## 4. Actual database model

The project stores a practical memory graph rather than a polished conceptual schema alone.

Important tables include:

- memory: content, summary, kind, salience, source, pinned, embedding, meta, timestamps
- entity: name, entity type, aliases, notes, embedding, metadata
- link: relationships between memory and entity
- attachment: file path, MIME type, OCR text, visual summary, embedding
- secret: encrypted secret payload with salt and nonce
- checkin: daily heartbeat notes
- circle_member: trusted contact metadata

This is the real persisted structure used by the app.

---

## 5. Auth and security model

Most /api routes are gated by Firebase token validation.

The middleware in [src/middleware/auth.ts](src/middleware/auth.ts) is used to verify tokens before access to protected endpoints.

The live voice route is special: it accepts a Firebase ID token via the WebSocket query string parameter ?token=... and verifies it before allowing the /live connection.

This is the real runtime security pattern in the repo.

---

## 6. Gemini usage

The code does not use a single hard-coded model path everywhere. Instead, it uses resilient generation logic in [server.ts](server.ts) that tries multiple models and falls back gracefully when quota or service issues occur.

The main patterns are:

- chat generation via /api/gemini/chat
- memory enrichment via the app’s synthesis flow
- live voice streaming via WebSocket and Gemini live audio interfaces

The live audio client is implemented in [src/lib/live-audio.ts](src/lib/live-audio.ts).

---

## 7. API surface that exists in the repo

These endpoints are actually present or clearly implemented in the codebase:

| Route | Purpose |
|---|---|
| /api/gemini/chat | AI chat assistant interaction |
| /api/memories | list or insert memories |
| /api/memories/search | keyword lookup and delete by query |
| /api/memories/:id | delete a memory |
| /api/memories/enrich | enrich / synthesize memories |
| /api/attachments | store uploaded file metadata |
| /api/entities | list durable entities |
| /api/entities/:id/timeline | timeline for an entity |
| /api/checkins | create check-in log |
| /api/circle | list trusted circle members |
| /api/secrets | secret listing flow |
| /live | WebSocket live audio bridge |

---

## 8. Build and run commands

From [package.json](package.json), the practical commands are:

- npm run dev
- npm run build
- npm run start
- npm run lint
- npm run cap:build
- npm run cap:sync

The project also supports Android/iOS builds via Capacitor.

---

## 9. What is accurate vs aspirational

### Accurate
- This is a multi-feature personal AI assistant dashboard
- It uses Firebase auth, Postgres, and Gemini APIs
- It has memory, entities, check-ins, secrets, and live voice
- It has a three-loop dashboard experience and a daily pulse concept

### Aspirational or idealized
- The “Trinitarian Operating System” language is more of a product mythos than a literal code architecture
- The doc’s exact SQL schema is a conceptual version, not the exact runtime schema used by Drizzle
- Some model references are versioned more precisely than the code’s fallback logic

---

## 10. Bottom line

This repo is a real, working prototype of a personal sovereign memory system with AI assistance, not just a diagram or a mock app.

It matches the project’s intent, but the honest version is:

- real app, real stack, real functionality
- strong product vision
- slightly more polished design language than the exact implementation

This is the repo-accurate interpretation of IZA OS.
