import { pgTable, serial, bigserial, bigint, text, real, timestamp, jsonb, integer, boolean } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Custom vector type for pgvector in Drizzle
import { customType } from 'drizzle-orm/pg-core';

export const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'vector(768)';
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: string): number[] {
    return JSON.parse(value.replace(/^{|}$/g, (m) => (m === '{' ? '[' : ']')));
  },
});

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const memory = pgTable('memory', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  content: text('content').notNull(),
  summary: text('summary'),
  kind: text('kind').notNull().default('note'),
  salience: real('salience').notNull().default(0.5),
  source: text('source').default('web'),
  pinned: boolean('pinned').default(false),
  isArchived: boolean('is_archived').default(false),
  embedding: vector('embedding'),
  meta: jsonb('meta').default({}),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow(),
  capturedAt: timestamp('captured_at', { withTimezone: true }).defaultNow(),
});

export const entity = pgTable('entity', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  entityType: text('entity_type').notNull().default('person'),
  etype: text('etype').notNull().default('person'),
  aka: text('aka').array().default([]),
  notes: text('notes').default(''),
  embedding: vector('embedding'),
  meta: jsonb('meta').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const link = pgTable('link', {
  id: serial('id').primaryKey(),
  sourceMemoryId: bigint('source_memory_id', { mode: 'number' }).references(() => memory.id, { onDelete: 'cascade' }),
  targetMemoryId: bigint('target_memory_id', { mode: 'number' }).references(() => memory.id, { onDelete: 'cascade' }),
  targetEntityId: integer('target_entity_id').references(() => entity.id, { onDelete: 'cascade' }),
  relationship: text('relationship').notNull().default('mentions'),
  relation: text('relation').notNull().default('mentions'),
  confidence: real('confidence').default(0.85),
  sourceType: text('source_type').default('auto'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const attachment = pgTable('attachment', {
  id: serial('id').primaryKey(),
  memoryId: bigint('memory_id', { mode: 'number' }).references(() => memory.id, { onDelete: 'cascade' }),
  filePath: text('file_path').notNull().default('attachment'),
  mimeType: text('mime_type').notNull().default('image/jpeg'),
  ocrText: text('ocr_text'),
  visualSummary: text('visual_summary'),
  embedding: vector('embedding'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const dailyPulse = pgTable('daily_pulse', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  pulseDate: timestamp('pulse_date', { withTimezone: true }).defaultNow(),
  summary: text('summary').notNull(),
  priorities: text('priorities').array().default([]),
  medStatus: text('med_status').notNull().default('All Active Items'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const medication = pgTable('medication', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  dose: text('dose').default(''),
  times: text('times').array().default([]),
  stoppedOn: timestamp('stopped_on', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const checkin = pgTable('checkin', {
  id: serial('id').primaryKey(),
  at: timestamp('at', { withTimezone: true }).defaultNow(),
  note: text('note').default('Heartbeat verified'),
});

export const secret = pgTable('secret', {
  id: serial('id').primaryKey(),
  label: text('label').notNull().unique(),
  ciphertext: text('ciphertext').notNull(),
  salt: text('salt').notNull(),
  nonce: text('nonce').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const circleMember = pgTable('circle_member', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  relation: text('relation').notNull().default('Trusted'),
  email: text('email').default(''),
  phone: text('phone').default(''),
  webhookUrl: text('webhook_url').default(''),
  isEscalation: boolean('is_escalation').default(false),
  status: text('status').default('SYNCED'),
  lastContactAt: timestamp('last_contact_at', { withTimezone: true }).defaultNow(),
});

export const checkinLog = pgTable('checkin_log', {
  id: serial('id').primaryKey(),
  note: text('note').default('all good'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const memoryRelations = relations(memory, ({ many }) => ({
  links: many(link),
  attachments: many(attachment),
}));

export const entityRelations = relations(entity, ({ many }) => ({
  links: many(link),
}));
