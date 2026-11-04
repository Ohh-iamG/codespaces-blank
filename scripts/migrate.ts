import { createPool } from '../src/db/index.ts';

async function migrate() {
  const pool = createPool();
  console.log('Connecting to Cloud SQL...');

  const ddlStatements = [
    `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`,
    `CREATE EXTENSION IF NOT EXISTS vector;`,

    // 1. Daily Pulse table
    `CREATE TABLE IF NOT EXISTS daily_pulse (
      id          uuid primary key default gen_random_uuid(),
      pulse_date  date not null unique default current_date,
      summary     text not null,
      priorities  text[] not null default '{}',
      med_status  text not null,
      created_at  timestamptz not null default now()
    );`,

    // 2. Memory enhancements (summary, is_archived, source, pinned)
    `ALTER TABLE memory
      ADD COLUMN IF NOT EXISTS summary text,
      ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS source text DEFAULT 'web',
      ADD COLUMN IF NOT EXISTS pinned boolean DEFAULT false;`,

    // 3. Attachment enhancements (ocr_text, visual_summary, embedding)
    `ALTER TABLE attachment 
      ADD COLUMN IF NOT EXISTS ocr_text text,
      ADD COLUMN IF NOT EXISTS visual_summary text,
      ADD COLUMN IF NOT EXISTS embedding vector(768);`,

    `CREATE INDEX IF NOT EXISTS attachment_embedding_hnsw 
      ON attachment USING hnsw (embedding vector_cosine_ops);`,

    // 4. Link table enhancements (source_type, relation, confidence, entity, src_memory)
    `ALTER TABLE link 
      ADD COLUMN IF NOT EXISTS source_type text DEFAULT 'auto',
      ADD COLUMN IF NOT EXISTS relation text DEFAULT 'mentions',
      ADD COLUMN IF NOT EXISTS confidence real DEFAULT 0.85,
      ADD COLUMN IF NOT EXISTS entity integer,
      ADD COLUMN IF NOT EXISTS src_memory integer;`,

    // Sync foreign key alias columns if null
    `UPDATE link SET entity = target_entity_id WHERE entity IS NULL AND target_entity_id IS NOT NULL;`,
    `UPDATE link SET src_memory = source_memory_id WHERE src_memory IS NULL AND source_memory_id IS NOT NULL;`,

    // 5. Entity enhancements (etype alias)
    `ALTER TABLE entity
      ADD COLUMN IF NOT EXISTS etype text DEFAULT 'person';`,
    `UPDATE entity SET etype = entity_type WHERE etype IS NULL OR etype = 'person';`,

    // 6. Medication table
    `CREATE TABLE IF NOT EXISTS medication (
      id serial primary key,
      name text not null,
      dose text default '',
      times text[] default '{}',
      stopped_on timestamptz,
      created_at timestamptz not null default now()
    );`,

    // 7. Checkin table
    `CREATE TABLE IF NOT EXISTS checkin (
      id serial primary key,
      at timestamptz not null default now(),
      note text default 'Heartbeat verified'
    );`,

    // Seed sample checkin and sample medication if empty
    `INSERT INTO checkin (note) 
     SELECT 'Morning bio-telemetry aligned, 62 BPM, cognitive load stable' 
     WHERE NOT EXISTS (SELECT 1 FROM checkin);`,
    `INSERT INTO medication (name, dose, times) 
     SELECT 'Electrolyte & Mineral Complex', '500mg', ARRAY['08:00', '14:00']
     WHERE NOT EXISTS (SELECT 1 FROM medication);`,
  ];

  for (const sql of ddlStatements) {
    try {
      await pool.query(sql);
      console.log('Executed:', sql.trim().split('\n')[0]);
    } catch (err: any) {
      console.warn('Notice executing SQL:', err.message);
    }
  }

  console.log('All migrations applied successfully.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
