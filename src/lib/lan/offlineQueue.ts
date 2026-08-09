import { openDB, DBSchema } from 'idb';

export interface QueuedOperation {
  operationId: string;
  userId: string;
  entityType: string;
  entityId: string;
  operationType: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: any;
  createdAt: string;
  status: 'QUEUED' | 'SYNCED';
}

interface OfflineDbSchema extends DBSchema {
  operations: {
    key: string;
    value: QueuedOperation;
    indexes: { 'by-status': string };
  };
  cache: {
    key: string;
    value: { key: string; data: any; updatedAt: string };
  };
}

class OfflineQueueManager {
  private dbPromise = openDB<OfflineDbSchema>('flick_offline_db', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('operations')) {
        const opStore = db.createObjectStore('operations', { keyPath: 'operationId' });
        opStore.createIndex('by-status', 'status');
      }
      if (!db.objectStoreNames.contains('cache')) {
        db.createObjectStore('cache', { keyPath: 'key' });
      }
    }
  });

  public async enqueue(op: Omit<QueuedOperation, 'operationId' | 'createdAt' | 'status'>): Promise<string> {
    const db = await this.dbPromise;
    const operationId = `op_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const fullOp: QueuedOperation = {
      ...op,
      operationId,
      createdAt: new Date().toISOString(),
      status: 'QUEUED'
    };
    await db.put('operations', fullOp);
    return operationId;
  }

  public async getPending(): Promise<QueuedOperation[]> {
    const db = await this.dbPromise;
    return db.getAllFromIndex('operations', 'by-status', 'QUEUED');
  }

  public async markSynced(operationId: string) {
    const db = await this.dbPromise;
    const item = await db.get('operations', operationId);
    if (item) {
      item.status = 'SYNCED';
      await db.put('operations', item);
    }
  }

  public async setCache(key: string, data: any) {
    const db = await this.dbPromise;
    await db.put('cache', { key, data, updatedAt: new Date().toISOString() });
  }

  public async getCache(key: string): Promise<any | null> {
    const db = await this.dbPromise;
    const item = await db.get('cache', key);
    return item ? item.data : null;
  }
}

export const offlineQueue = new OfflineQueueManager();
