Here is a complete, production-ready `README.md` for your GitHub repository, structured specifically around the new **IZA LIFE** design system, security architecture, and multi-domain capabilities.

---

```markdown
# 🌿 IZA LIFE — Sovereign Personal Life Assistant

> **"Anything captured becomes a Moment. IZA connects your life."**

**IZA LIFE** is a calm, personal, and trustworthy AI life assistant and sovereign memory vault. Designed around generous space and emotional clarity rather than a cluttered control room, IZA captures voice turns, photos, documents, thoughts, and conversations, weaving them into interconnected **Moments**, **Life Threads**, and **Decision Logs**.

---

## 🎨 Visual Identity & Mood

* **Aesthetic:** Quiet, personal, and spacious. One primary focus per screen.
* **Palette:**
  * **Background:** Deep Teal-Charcoal (`#0D1B1E`)
  * **Primary Text:** Silver-White (`#E2E8F0`)
  * **Secondary Text:** Muted Slate Grey (`#94A3B8`)
  * **Glowing Accent:** Mint Aqua (`#2DD4BF`) — strictly reserved for the central **`＋`** action button.
* **Typography:** Light-weight display face for greetings, readable plain body face, and letter-spaced uppercase section labels.

---

## 🧭 Navigation & Core Topology

IZA LIFE eliminates dense telemetry bars and complex multi-tab headers in favor of a **5-button permanent bottom control bar**:


```

┌──────────────────────────────────────────────────────────┐
│  [ 🌿 IZA ]   [ 🔍 Recall ]   [ ＋ ]   [ 👥 People ]   [ 👤 Me ] │
└──────────────────────────────────────────────────────────┘

```

### 1. 🌿 IZA (Home)
* **Dynamic Pulse Card:** Automatically adapts to the time of day across four states: `NOW`, `TODAY`, `NEXT`, and `ATTENTION`.
* **Recent Feed:** Displays recent Moments and unfinished threads to easily re-anchor context.

### 2. 🔍 Recall
* **Universal Query:** Single search field: *"Ask your life."*
* **Exploration Channels:** Tap-to-filter pill list across `Moments`, `People`, `Threads`, `Documents`, `Places`, and `Decisions`.

### 3. ＋ (Central Capture Hub)
Tapping the glowing mint aqua **`＋`** button opens a clean sheet with **four capture actions**:
* **🗣️ Talk:** Real-time low-latency voice session (Gemini Live streaming).
* **📷 See:** Visual inspection, image capture, and OCR frame analysis.
* **✍️ Write:** Thought entry, journal notes, and quick dumping.
* **📥 Add:** File ingestion (PDFs, Word docs, textbooks, manuals) into vector RAG memory.

### 4. 👥 People
* **Life Threads:** Tapping a person opens their chronological timeline of shared moments, conversations, and milestones—not a cold contact card.
* **Circle Groups:** Organized under `Family`, `Friends`, `Care`, and `Work`.

### 5. 👤 Me
* **Life Navigation:** `My Life`, `Moments`, `Threads`, `Circles`, `Future`, and `Vault`.
* **Sovereign Controls:** Account privacy, biometric lock, Row-Level Security (RLS) policies, and full data purge options.

---

## 🔒 Security & Data Sovereignty

* **Row-Level Security (RLS):** Database-enforced isolation. Personal notes remain strictly private (`owner_only`), while health routines and dosage check-ins can be exposed safely to designated care circles (`carer_read`).
* **Zero-Knowledge Ciphertext Storage:** Sensitive secrets and credentials are stored using NaCl encryption without vector embeddings.
* **SSRF & Input Guardrails:** Scraped web URLs are validated against private IP blocklists, and search wildcard deletes are safely user-scoped.

---

## 🛠️ Tech Stack & Architecture

* **Frontend:** React 18, Vite, Tailwind CSS, Lucide Icons, Web Audio Worklets (24kHz WebSocket streaming).
* **Native Wrappers:** Capacitor 8 (`iOS` & `Android`) with native biometrics and camera/microphone access.
* **Backend:** Node.js, Express, TypeScript, WebSocket (`ws`).
* **Database / Vector Engine:** PostgreSQL + `pgvector` (768-dimensional embeddings via `text-embedding-004`).
* **AI Core:** Gemini 3.8 Flash, Gemini Live WebSocket API.

---

## 🚀 Quickstart & Local Setup

### 1. Prerequisites
* Node.js v18+ 
* PostgreSQL with `pgvector` extension enabled
* Gemini API Key

### 2. Installation
```bash
# Clone the repository
git clone [https://github.com/your-username/iza-life.git](https://github.com/your-username/iza-life.git)
cd iza-life

# Install dependencies
npm install

# Environment Configuration
cp .env.example .env

```

### 3. Database Migration

```sql
-- Enable vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Apply schema
psql -U your_user -d iza_db -f schema.sql

```

### 4. Running the Application

```bash
# Run backend server & Vite dev bundle concurrently
npm run dev

```

### 5. Building Native Apps (Capacitor)

```bash
# Build Vite web production assets
npm run build

# Sync assets to native mobile shells
npx cap sync

# Open in Xcode or Android Studio
npx cap open ios
npx cap open android

```

---

## 📄 License

Proprietary & Sovereign — Built for **EARTH—I PTY LTD**.

```
