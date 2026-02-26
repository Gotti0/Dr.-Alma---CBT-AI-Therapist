const DB_NAME = 'CBT_Agent_DB';
const STORE_NAME = 'sessions';
const DB_VERSION = 1;

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

export async function saveMessage(message: ChatMessage): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(message);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getRecentMessages(): Promise<ChatMessage[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => {
      const now = Date.now();
      const twentyFourHours = 24 * 60 * 60 * 1000;
      const messages = (request.result as ChatMessage[])
        .filter(msg => now - msg.timestamp < twentyFourHours)
        .sort((a, b) => a.timestamp - b.timestamp);
      resolve(messages);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function cleanExpiredCache(): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => {
      const now = Date.now();
      const twentyFourHours = 24 * 60 * 60 * 1000;
      const messages = request.result as ChatMessage[];
      messages.forEach(msg => {
        if (now - msg.timestamp >= twentyFourHours) {
          store.delete(msg.id);
        }
      });
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

export async function clearAllMessages(): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
