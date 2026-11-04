-- IZA Vault Phase 0 Schema
-- Sovereign Human Identity & Memory Blueprint

CREATE EXTENSION IF NOT EXISTS vector;

-- Users (Firebase Auth synchronization)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    uid TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- The Atom: Memory
-- Raw text is never overwritten. Async embedding.
CREATE TABLE IF NOT EXISTS memory (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'note',
    salience REAL NOT NULL DEFAULT 0.5,
    embedding VECTOR(768),
    meta JSONB DEFAULT '{}'::jsonb,
    occurred_at TIMESTAMPTZ DEFAULT NOW(),
    captured_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS memory_captured_idx ON memory (captured_at DESC);
CREATE INDEX IF NOT EXISTS memory_occurred_idx ON memory (occurred_at DESC);
CREATE INDEX IF NOT EXISTS memory_kind_idx ON memory (kind);

-- Entities: Durable recurring people, places, orgs, objects
CREATE TABLE IF NOT EXISTS entity (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    entity_type TEXT NOT NULL DEFAULT 'person',
    aka TEXT[] DEFAULT '{}',
    notes TEXT DEFAULT '',
    embedding VECTOR(768),
    meta JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Links: Lightweight graph edges (memory -> entity, memory -> memory)
CREATE TABLE IF NOT EXISTS link (
    id SERIAL PRIMARY KEY,
    source_memory_id INT REFERENCES memory(id) ON DELETE CASCADE,
    target_memory_id INT REFERENCES memory(id) ON DELETE CASCADE,
    target_entity_id INT REFERENCES entity(id) ON DELETE CASCADE,
    relationship TEXT NOT NULL DEFAULT 'mentions',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Attachments: Binary/media tied to memories
CREATE TABLE IF NOT EXISTS attachment (
    id SERIAL PRIMARY KEY,
    memory_id INT REFERENCES memory(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Continuity Secrets: PINs, cards, sensitive medical
-- CIPHERTEXT ONLY. Key derived via Argon2id. Never embedded in vector store.
CREATE TABLE IF NOT EXISTS secret (
    id SERIAL PRIMARY KEY,
    label TEXT NOT NULL UNIQUE,
    ciphertext TEXT NOT NULL,
    salt TEXT NOT NULL,
    nonce TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- The Circle: Trusted human support network
CREATE TABLE IF NOT EXISTS circle_member (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    relation TEXT NOT NULL DEFAULT 'Trusted',
    email TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    webhook_url TEXT DEFAULT '',
    is_escalation BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'SYNCED',
    last_contact_at TIMESTAMPTZ DEFAULT NOW()
);

-- Heartbeat check-in logs
CREATE TABLE IF NOT EXISTS checkin_log (
    id SERIAL PRIMARY KEY,
    note TEXT DEFAULT 'all good',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Hybrid Recall function: score = w_sim * similarity + w_recency * recency + w_salience * salience
CREATE OR REPLACE FUNCTION recall(
    query_vector VECTOR(768),
    w_sim FLOAT DEFAULT 0.6,
    w_recency FLOAT DEFAULT 0.25,
    w_salience FLOAT DEFAULT 0.15,
    match_limit INT DEFAULT 10
)
RETURNS TABLE (
    id INT,
    content TEXT,
    kind TEXT,
    salience REAL,
    similarity FLOAT,
    recency FLOAT,
    total_score FLOAT,
    captured_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        m.id,
        m.content,
        m.kind,
        m.salience,
        (1.0 - (m.embedding <=> query_vector)) AS similarity,
        EXP(-EXTRACT(EPOCH FROM (NOW() - COALESCE(m.occurred_at, m.captured_at))) / (180.0 * 86400.0)) AS recency,
        (
            (w_sim * (1.0 - (m.embedding <=> query_vector))) +
            (w_recency * EXP(-EXTRACT(EPOCH FROM (NOW() - COALESCE(m.occurred_at, m.captured_at))) / (180.0 * 86400.0))) +
            (w_salience * m.salience)
        ) AS total_score,
        m.captured_at
    FROM memory m
    WHERE m.embedding IS NOT NULL
    ORDER BY total_score DESC
    LIMIT match_limit;
$$;
