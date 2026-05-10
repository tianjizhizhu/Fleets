import type { WorkRecord, WorkCategory, Cluster, UserConfig } from '@/types';

const CONFIG_KEY = 'worktime_config';
const DB_NAME = 'WorkTimeDB';
const DB_VERSION = 1;

let db: IDBDatabase | null = null;
let dbInitPromise: Promise<IDBDatabase> | null = null;

export function initDB(): Promise<IDBDatabase> {
  if (db) {
    return Promise.resolve(db);
  }

  if (dbInitPromise) {
    return dbInitPromise;
  }

  dbInitPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('IndexedDB 打开失败:', request.error);
      dbInitPromise = null;
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      dbInitPromise = null;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      if (!database.objectStoreNames.contains('records')) {
        const recordStore = database.createObjectStore('records', { keyPath: 'id' });
        recordStore.createIndex('categoryId', 'categoryId', { unique: false });
        recordStore.createIndex('annotationStatus', 'annotationStatus', { unique: false });
        recordStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      if (!database.objectStoreNames.contains('clusters')) {
        const clusterStore = database.createObjectStore('clusters', { keyPath: 'id' });
        clusterStore.createIndex('categoryId', 'categoryId', { unique: false });
      }
    };
  });

  return dbInitPromise;
}

export async function saveRecord(record: WorkRecord): Promise<void> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['records'], 'readwrite');
    const store = transaction.objectStore('records');
    
    const recordToSave = JSON.parse(JSON.stringify(record));
    const request = store.put(recordToSave);
    
    request.onerror = () => {
      console.error('保存记录失败:', request.error);
      reject(request.error);
    };
    request.onsuccess = () => resolve();
  });
}

export async function getRecord(id: string): Promise<WorkRecord | undefined> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['records'], 'readonly');
    const store = transaction.objectStore('records');
    const request = store.get(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function getAllRecords(): Promise<WorkRecord[]> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['records'], 'readonly');
    const store = transaction.objectStore('records');
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

export async function deleteRecord(id: string): Promise<void> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['records'], 'readwrite');
    const store = transaction.objectStore('records');
    const request = store.delete(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function saveCluster(cluster: Cluster): Promise<void> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['clusters'], 'readwrite');
    const store = transaction.objectStore('clusters');
    const request = store.put(cluster);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function getAllClusters(): Promise<Cluster[]> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['clusters'], 'readonly');
    const store = transaction.objectStore('clusters');
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

export async function deleteCluster(id: string): Promise<void> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['clusters'], 'readwrite');
    const store = transaction.objectStore('clusters');
    const request = store.delete(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export function saveConfig(config: UserConfig): void {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('保存配置失败:', e);
  }
}

export function getConfig(): UserConfig | null {
  try {
    const data = localStorage.getItem(CONFIG_KEY);
    if (!data) return null;
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function clearAllData(): void {
  localStorage.removeItem(CONFIG_KEY);
  initDB().then(database => {
    const transaction = database.transaction(['records', 'clusters'], 'readwrite');
    transaction.objectStore('records').clear();
    transaction.objectStore('clusters').clear();
  });
}

export async function exportAllData(): Promise<{ config: UserConfig | null; records: WorkRecord[]; clusters: Cluster[] }> {
  const [records, clusters] = await Promise.all([
    getAllRecords(),
    getAllClusters()
  ]);
  return {
    config: getConfig(),
    records,
    clusters
  };
}

export async function importData(data: { records: WorkRecord[]; clusters: Cluster[]; config?: UserConfig }): Promise<void> {
  const database = await initDB();

  const transaction = database.transaction(['records', 'clusters'], 'readwrite');

  await Promise.all([
    ...data.records.map(record =>
      new Promise<void>((resolve, reject) => {
        const request = transaction.objectStore('records').put(JSON.parse(JSON.stringify(record)));
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      })
    ),
    ...data.clusters.map(cluster =>
      new Promise<void>((resolve, reject) => {
        const request = transaction.objectStore('clusters').put(JSON.parse(JSON.stringify(cluster)));
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      })
    )
  ]);

  if (data.config) {
    saveConfig(data.config);
  }
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
