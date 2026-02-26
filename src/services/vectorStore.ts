// src/services/vectorStore.ts

const DB_NAME = 'CBT_Agent_VectorDB';
const STORE_NAME = 'embeddings';
const DB_VERSION = 1;

export interface VectorMemory {
    id: string;          // Unique identifier (usually timestamp or UUID)
    text: string;        // The original text chunk
    embedding: number[]; // The generated embedding vector
    timestamp: number;   // When it was stored
    metadata?: any;      // Optional extra information (e.g., session ID, topic)
}

function getVectorDB(): Promise<IDBDatabase> {
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

/**
 * Calculates the cosine similarity between two vectors.
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
        throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Saves a new embedding to the IndexedDB vector store.
 */
export async function saveEmbedding(memory: Omit<VectorMemory, 'id' | 'timestamp'>): Promise<void> {
    const db = await getVectorDB();
    const newMemory: VectorMemory = {
        ...memory,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
    };

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(newMemory);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

/**
 * Searches the vector store for the most similar memories to the query embedding.
 * @param queryEmbedding the generated embedding of the search query
 * @param limit maximum number of results
 * @param metadataFilterType an optional metadata type to filter by (e.g. 'knowledge', 'memory')
 */
export async function searchSimilar(queryEmbedding: number[], limit: number = 5, metadataFilterType?: string): Promise<VectorMemory[]> {
    const db = await getVectorDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
            let allMemories = request.result as VectorMemory[];

            // Filter by metadata type if provided
            if (metadataFilterType) {
                allMemories = allMemories.filter(m => m.metadata && m.metadata.type === metadataFilterType);
            }

            // Calculate similarity for all stored (and filtered) memories
            const memoriesWithScores = allMemories.map(memory => {
                const similarity = cosineSimilarity(queryEmbedding, memory.embedding);
                return { memory, similarity };
            });

            // Sort by descending similarity and take the top N
            const topMemories = memoriesWithScores
                .sort((a, b) => b.similarity - a.similarity)
                .slice(0, limit)
                .map(item => item.memory);

            resolve(topMemories);
        };

        request.onerror = () => reject(request.error);
    });
}

/**
 * Clears all embeddings from the database.
 */
export async function clearAllEmbeddings(): Promise<void> {
    const db = await getVectorDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}
