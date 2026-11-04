// Client-side IndexedDB offline fallback and auto-sync engine for IZA OS
import { apiFetch } from './api';
const DB_NAME = 'iza_offline_vault';
const DB_VERSION = 1;
const STORE_MEMORIES = 'pending_memories';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported'));
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_MEMORIES)) {
        db.createObjectStore(STORE_MEMORIES, { keyPath: 'localId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export interface OfflineMemoryItem {
  localId: string;
  content: string;
  kind?: string;
  salience?: number;
  meta?: Record<string, any>;
  capturedAt: string;
  synced: boolean;
}

export async function saveOfflineMemory(item: { content: string; kind?: string; salience?: number; meta?: any }): Promise<OfflineMemoryItem> {
  const db = await openDB();
  const memoryRecord: OfflineMemoryItem = {
    localId: 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    content: item.content,
    kind: item.kind || 'note',
    salience: item.salience ?? 0.5,
    meta: { ...(item.meta || {}), offlineCaptured: true },
    capturedAt: new Date().toISOString(),
    synced: false,
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_MEMORIES, 'readwrite');
    const store = tx.objectStore(STORE_MEMORIES);
    const req = store.put(memoryRecord);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  // Request background sync with Service Worker
  registerBackgroundSync().catch(() => {});

  return memoryRecord;
}

export async function getPendingOfflineMemories(): Promise<OfflineMemoryItem[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_MEMORIES, 'readonly');
      const store = tx.objectStore(STORE_MEMORIES);
      const req = store.getAll();
      req.onsuccess = () => {
        const items: OfflineMemoryItem[] = req.result || [];
        resolve(items.filter((i) => !i.synced));
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function clearSyncedMemories(localIds: string[]): Promise<void> {
  if (localIds.length === 0) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MEMORIES, 'readwrite');
    const store = tx.objectStore(STORE_MEMORIES);
    localIds.forEach((id) => store.delete(id));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function registerBackgroundSync() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'SyncManager' in window) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await (reg as any).sync.register('sync-memories');
    } catch (e) {
      console.warn('SyncManager register notice:', e);
    }
  }
}

export async function flushOfflineMemoriesToServer(): Promise<{ syncedCount: number; errors: any[] }> {
  const pending = await getPendingOfflineMemories();
  if (pending.length === 0) {
    return { syncedCount: 0, errors: [] };
  }

  try {
    const response = await apiFetch('/api/memories/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: pending.map((m) => ({
          content: m.content,
          kind: m.kind,
          salience: m.salience,
          meta: m.meta,
          capturedAt: m.capturedAt,
        })),
      }),
    });

    if (!response.ok) {
      throw new Error(`Batch sync HTTP error: ${response.status}`);
    }

    const data = await response.json();
    const syncedIds = pending.map((p) => p.localId);
    await clearSyncedMemories(syncedIds);

    return { syncedCount: data.syncedCount || pending.length, errors: [] };
  } catch (err) {
    console.warn('Flush offline memories deferred until network returns:', err);
    return { syncedCount: 0, errors: [err] };
  }
}

// Global auto-sync handlers on network reconnection and SW sync messages
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    flushOfflineMemoriesToServer().catch(() => {});
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'TRIGGER_OFFLINE_SYNC') {
        flushOfflineMemoriesToServer().catch(() => {});
      }
    });
  }
}
