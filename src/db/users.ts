import crypto from 'crypto';
import { db } from './index.ts';
import { users, memory, secret, circleMember, entity, link, attachment, checkinLog } from './schema.ts';
import { eq, desc, ilike, sql } from 'drizzle-orm';

function deriveVaultKey(salt: string) {
  return crypto.createHash('sha256').update(`${process.env.IZA_SECRET_KEY || 'iza-vault-default'}:${salt}`).digest();
}

function encryptSecretValue(value: string) {
  const salt = crypto.randomBytes(16).toString('hex');
  const nonce = crypto.randomBytes(12);
  const key = deriveVaultKey(salt);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: Buffer.concat([encrypted, tag]).toString('hex'),
    nonce: nonce.toString('hex'),
    salt,
  };
}

function decryptSecretValue(row: { ciphertext: string; nonce: string; salt: string }) {
  try {
    const key = deriveVaultKey(row.salt);
    const raw = Buffer.from(row.ciphertext, 'hex');
    const tag = raw.subarray(raw.length - 16);
    const encrypted = raw.subarray(0, raw.length - 16);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(row.nonce, 'hex'));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch (error) {
    console.warn('Secret decrypt warning:', error);
    return '**********';
  }
}

export async function getOrCreateUser(uid: string, email: string) {
  try {
    const result = await db.insert(users)
      .values({
        uid,
        email,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('getOrCreateUser error:', error);
    throw new Error('Database operation failed.', { cause: error });
  }
}

export async function getMemories(limitCount = 50) {
  try {
    return await db.select().from(memory).orderBy(desc(memory.capturedAt)).limit(limitCount);
  } catch (error) {
    console.error('getMemories error:', error);
    throw new Error('Database query failed.', { cause: error });
  }
}

export async function searchMemories(query: string, limitCount = 50) {
  try {
    return await db
      .select()
      .from(memory)
      .where(ilike(memory.content, `%${query}%`))
      .orderBy(desc(memory.capturedAt))
      .limit(limitCount);
  } catch (error) {
    console.error('searchMemories error:', error);
    throw new Error('Database search failed.', { cause: error });
  }
}

export async function insertMemory(content: string, kind = 'note', salience = 0.5, meta: Record<string, any> = {}) {
  try {
    const result = await db.insert(memory).values({
      content,
      kind,
      salience,
      meta,
    }).returning();
    return result[0];
  } catch (error) {
    console.error('insertMemory error:', error);
    throw new Error('Failed to insert memory.', { cause: error });
  }
}

export async function insertBatchMemories(items: Array<{ content: string; kind?: string; salience?: number; meta?: any; capturedAt?: string }>) {
  try {
    if (!items || items.length === 0) return [];
    const valuesToInsert = items.map(item => ({
      content: item.content,
      kind: item.kind || 'note',
      salience: item.salience ?? 0.5,
      meta: item.meta || {},
      capturedAt: item.capturedAt ? new Date(item.capturedAt) : new Date(),
    }));
    return await db.insert(memory).values(valuesToInsert).returning();
  } catch (error) {
    console.error('insertBatchMemories error:', error);
    throw new Error('Failed to insert batch memories.', { cause: error });
  }
}

export async function deleteMemory(id: number) {
  try {
    if (!id || isNaN(id) || !Number.isSafeInteger(id)) {
      return null;
    }
    const result = await db.delete(memory).where(eq(memory.id, id)).returning();
    return result[0] || null;
  } catch (error) {
    console.warn('deleteMemory warning:', error);
    return null;
  }
}

export async function deleteMemoriesByQuery(query: string) {
  try {
    const clean = query.trim();
    if (!clean) return { count: 0, deleted: [] };
    const deleted = await db
      .delete(memory)
      .where(ilike(memory.content, `%${clean}%`))
      .returning({ id: memory.id, content: memory.content });
    return { count: deleted.length, deleted };
  } catch (error) {
    console.error('deleteMemoriesByQuery error:', error);
    throw new Error('Failed to delete memories by query.', { cause: error });
  }
}

// Memory Enrichment helpers
export async function getUnenrichedMemories(limitCount = 20) {
  try {
    return await db
      .select()
      .from(memory)
      .where(sql`(${memory.meta}->>'enriched') IS NULL OR (${memory.meta}->>'enriched') = 'false'`)
      .orderBy(desc(memory.capturedAt))
      .limit(limitCount);
  } catch (error) {
    console.error('getUnenrichedMemories error:', error);
    return [];
  }
}

export async function updateMemoryEnrichment(id: number, summary: string, salience: number, metaUpdates: Record<string, any>) {
  try {
    const current = await db.select().from(memory).where(eq(memory.id, id)).limit(1);
    const existingMeta = (current[0]?.meta as Record<string, any>) || {};
    const mergedMeta = {
      ...existingMeta,
      ...metaUpdates,
      summary,
      enriched: true,
      enrichedAt: new Date().toISOString(),
    };

    const result = await db
      .update(memory)
      .set({
        salience,
        meta: mergedMeta,
      })
      .where(eq(memory.id, id))
      .returning();

    return result[0];
  } catch (error) {
    console.error('updateMemoryEnrichment error:', error);
    throw error;
  }
}

// Entity & Knowledge Graph helpers
export async function upsertEntity(name: string, entityType = 'concept', aka: string[] = [], notes = '') {
  try {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const existing = await db.select().from(entity).where(ilike(entity.name, trimmed)).limit(1);
    if (existing.length > 0) {
      return existing[0];
    }

    const inserted = await db
      .insert(entity)
      .values({
        name: trimmed,
        entityType,
        aka,
        notes,
      })
      .returning();
    return inserted[0];
  } catch (error) {
    console.error('upsertEntity error:', error);
    return null;
  }
}

export async function createLink(sourceMemoryId: number, targetEntityId: number, relationship = 'mentions') {
  try {
    const inserted = await db
      .insert(link)
      .values({
        sourceMemoryId,
        targetEntityId,
        relationship,
      })
      .returning();
    return inserted[0];
  } catch (error) {
    console.error('createLink error:', error);
    return null;
  }
}

export async function getAllEntities() {
  try {
    return await db.select().from(entity).orderBy(desc(entity.createdAt));
  } catch (error) {
    console.error('getAllEntities error:', error);
    return [];
  }
}

export async function getEntityTimeline(entityId: number) {
  try {
    const entityRecord = await db.select().from(entity).where(eq(entity.id, entityId)).limit(1);
    if (entityRecord.length === 0) return { entity: null, timeline: [] };

    // Find all linked memories
    const links = await db.select().from(link).where(eq(link.targetEntityId, entityId));
    const memoryIds = links.map(l => l.sourceMemoryId).filter(Boolean) as number[];

    let linkedMemories: any[] = [];
    if (memoryIds.length > 0) {
      linkedMemories = await db
        .select()
        .from(memory)
        .where(sql`${memory.id} IN (${sql.join(memoryIds.map(id => sql`${id}`), sql`, `)})`)
        .orderBy(desc(memory.capturedAt));
    }

    return {
      entity: entityRecord[0],
      timeline: linkedMemories.map(m => ({
        ...m,
        relationship: links.find(l => l.sourceMemoryId === m.id)?.relationship || 'mentions',
      })),
    };
  } catch (error) {
    console.error('getEntityTimeline error:', error);
    return { entity: null, timeline: [] };
  }
}

// Attachments
export async function insertAttachment(memoryId: number, filePath: string, mimeType: string) {
  try {
    const result = await db.insert(attachment).values({
      memoryId,
      filePath,
      mimeType,
    }).returning();
    return result[0];
  } catch (error) {
    console.error('insertAttachment error:', error);
    throw error;
  }
}

// Daily Pulse Data (last 24 hours)
export async function getDailyPulseData() {
  try {
    const recentMemories = await db
      .select()
      .from(memory)
      .where(sql`${memory.capturedAt} >= NOW() - INTERVAL '24 hours'`)
      .orderBy(desc(memory.capturedAt))
      .limit(20);

    const checkins = await db
      .select()
      .from(checkinLog)
      .where(sql`${checkinLog.createdAt} >= NOW() - INTERVAL '24 hours'`)
      .orderBy(desc(checkinLog.createdAt))
      .limit(5);

    const highSalience = await db
      .select()
      .from(memory)
      .where(sql`${memory.salience} >= 0.7`)
      .orderBy(desc(memory.capturedAt))
      .limit(5);

    return {
      recentMemories,
      checkins,
      highSalience,
    };
  } catch (error) {
    console.error('getDailyPulseData error:', error);
    return {
      recentMemories: [],
      checkins: [],
      highSalience: [],
    };
  }
}

export async function insertCheckin(note = 'Heartbeat verified') {
  try {
    const result = await db.insert(checkinLog).values({ note }).returning();
    return result[0];
  } catch (error) {
    console.error('insertCheckin error:', error);
    throw error;
  }
}

export async function getSecrets() {
  try {
    const rows = await db.select().from(secret).orderBy(desc(secret.createdAt));
    return rows.map((row) => ({
      ...row,
      value: decryptSecretValue(row),
    }));
  } catch (error) {
    console.error('getSecrets error:', error);
    throw new Error('Failed to fetch secrets.', { cause: error });
  }
}

export async function insertSecret(label: string, value: string) {
  try {
    const trimmedLabel = label.trim();
    if (!trimmedLabel || !value) {
      throw new Error('Secret label and value are required.');
    }
    const encrypted = encryptSecretValue(value);
    const result = await db.insert(secret)
      .values({
        label: trimmedLabel,
        ciphertext: encrypted.ciphertext,
        salt: encrypted.salt,
        nonce: encrypted.nonce,
      })
      .onConflictDoUpdate({
        target: secret.label,
        set: {
          ciphertext: encrypted.ciphertext,
          salt: encrypted.salt,
          nonce: encrypted.nonce,
          createdAt: new Date(),
        },
      })
      .returning();

    return {
      ...result[0],
      value,
    };
  } catch (error) {
    console.error('insertSecret error:', error);
    throw new Error('Failed to store secret.', { cause: error });
  }
}

export async function getCircleMembers() {
  try {
    return await db.select().from(circleMember).orderBy(desc(circleMember.lastContactAt));
  } catch (error) {
    console.error('getCircleMembers error:', error);
    throw new Error('Failed to fetch circle members.', { cause: error });
  }
}

export async function addCircleMember(name: string, relation = 'Trusted') {
  try {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Circle member name is required.');
    }

    const result = await db.insert(circleMember)
      .values({
        name: trimmedName,
        relation,
        status: 'SYNCED',
        lastContactAt: new Date(),
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('addCircleMember error:', error);
    throw new Error('Failed to add circle member.', { cause: error });
  }
}

export interface SnapshotInput {
  title: string;
  content: string;
  domain: 'sanctuary' | 'carer' | 'machinery' | 'creative';
  mood?: string;
  confidence?: number;
  sourceChunk?: string;
  tags?: string[];
}

export async function createSnapshot(input: SnapshotInput) {
  try {
    const meta = {
      isSnapshot: true,
      title: input.title,
      domain: input.domain || 'sanctuary',
      mood: input.mood || 'Focused & Grounded',
      confidence: input.confidence ?? 0.95,
      sourceChunk: input.sourceChunk || 'Sovereign Dialogue Session',
      tags: input.tags || [input.domain],
      spatialAnchor: getSpatialLabel(input.domain),
    };

    const formattedContent = `[${meta.spatialAnchor}]: ${input.title}\n${input.content}`;
    const result = await db.insert(memory).values({
      content: formattedContent,
      summary: input.content.slice(0, 200),
      kind: 'snapshot',
      salience: 0.95,
      source: input.sourceChunk || 'snapshot_card',
      pinned: true,
      meta,
    }).returning();

    return result[0];
  } catch (error) {
    console.error('createSnapshot error:', error);
    throw new Error('Failed to create snapshot card.', { cause: error });
  }
}

function getSpatialLabel(domain: string): string {
  switch (domain) {
    case 'health':
    case 'carer': 
      return 'Carer & Support (Health & Care)';
    case 'work':
    case 'machinery': 
      return 'Work & Knowledge Store (Custom Document RAG)';
    case 'study':
    case 'creative': 
      return 'Study & Reference Files';
    case 'personal':
    case 'sanctuary':
    default: 
      return 'Personal Vault (Life & Reflection)';
  }
}

export async function getSnapshots(domainFilter?: string) {
  try {
    const all = await db.select().from(memory).orderBy(desc(memory.capturedAt)).limit(100);
    return all.filter((m) => {
      const meta = (m.meta || {}) as any;
      if (domainFilter && domainFilter !== 'all') {
        const normFilter = domainFilter === 'carer' ? 'health' : domainFilter === 'machinery' ? 'work' : domainFilter;
        const normDomain = meta.domain === 'carer' ? 'health' : meta.domain === 'machinery' ? 'work' : meta.domain === 'sanctuary' ? 'personal' : meta.domain;
        return normDomain === normFilter;
      }
      return meta.isSnapshot === true || m.kind === 'snapshot' || meta.domain !== undefined;
    });
  } catch (error) {
    console.error('getSnapshots error:', error);
    throw new Error('Failed to fetch snapshots.', { cause: error });
  }
}

export interface DocumentInput {
  title: string;
  content: string;
  domain: 'personal' | 'health' | 'work' | 'study';
  fileName?: string;
  chunkCount?: number;
  meta?: Record<string, any>;
}

export async function insertDocument(doc: DocumentInput) {
  try {
    const meta = {
      isDocument: true,
      domain: doc.domain,
      fileName: doc.fileName || `${doc.title}.pdf`,
      chunkCount: doc.chunkCount || 1,
      sourceChunk: `${doc.fileName || doc.title} §1`,
      spatialAnchor: getSpatialLabel(doc.domain),
      ...(doc.meta || {}),
    };

    const formattedContent = `[${meta.spatialAnchor}]: ${doc.title}\n${doc.content}`;
    const result = await db.insert(memory).values({
      content: formattedContent,
      summary: doc.content.slice(0, 250),
      kind: 'document',
      salience: 0.9,
      source: doc.fileName || 'custom_document_rag',
      pinned: false,
      meta,
    }).returning();

    return result[0];
  } catch (error) {
    console.error('insertDocument error:', error);
    throw new Error('Failed to insert document.', { cause: error });
  }
}

export async function searchUniversal(queryText: string, domainFilter = 'all') {
  try {
    const memories = await db.select().from(memory).orderBy(desc(memory.capturedAt)).limit(100);
    const q = queryText.toLowerCase().trim();

    return memories.filter((m) => {
      const meta = (m.meta || {}) as any;
      const mDomain = meta.domain || (m.kind === 'document' ? 'work' : 'personal');

      // Domain filter check
      if (domainFilter !== 'all') {
        const normFilter = domainFilter === 'carer' ? 'health' : domainFilter === 'machinery' ? 'work' : domainFilter;
        const normDomain = mDomain === 'carer' ? 'health' : mDomain === 'machinery' ? 'work' : mDomain === 'sanctuary' ? 'personal' : mDomain;
        if (normDomain !== normFilter) return false;
      }

      // Query check
      if (!q) return true;
      const content = m.content.toLowerCase();
      const title = (meta.title || '').toLowerCase();
      const source = (m.source || '').toLowerCase();
      return content.includes(q) || title.includes(q) || source.includes(q);
    }).map((m) => {
      const meta = (m.meta || {}) as any;
      const rawDomain = meta.domain || 'personal';
      const normDomain = (rawDomain === 'carer' ? 'health' : rawDomain === 'machinery' ? 'work' : rawDomain === 'sanctuary' ? 'personal' : rawDomain) as 'personal' | 'health' | 'work' | 'study';

      return {
        id: m.id,
        content: m.content,
        summary: m.summary || m.content.slice(0, 200),
        kind: m.kind,
        domain: normDomain,
        domainLabel: getSpatialLabel(normDomain),
        sourceChunk: meta.sourceChunk || m.source || 'Vault Chunk §1',
        confidence: meta.confidence || 0.95,
        title: meta.title || m.content.split('\n')[0].replace(/^\[.*?\]:\s*/, ''),
        capturedAt: m.capturedAt,
      };
    });
  } catch (error) {
    console.error('searchUniversal error:', error);
    throw new Error('Universal search failed.', { cause: error });
  }
}
