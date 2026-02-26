// src/services/knowledgeManager.ts
import { GoogleGenAI } from '@google/genai';
import { CBT_KNOWLEDGE_DOCUMENT } from '../assets/cbtKnowledge';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const STORE_ARRAY_KEY = 'CBT_FILE_SEARCH_STORES';
const BASE_STORE_VERSION = 'v2_pdf_merged'; // Bump this to force re-initialization of base knowledge
export const GOOGLE_SEARCH_DUMMY_ID = 'google_search_dummy';

export interface KnowledgeStoreInfo {
    id: string;
    displayName: string;
    storeName: string;
    isBase: boolean;
    version?: string;
}

/**
 * Retrieves the list of knowledge stores from localStorage.
 */
export function getKnowledgeStores(): KnowledgeStoreInfo[] {
    const data = localStorage.getItem(STORE_ARRAY_KEY);
    return data ? JSON.parse(data) : [];
}

/**
 * Saves the list of knowledge stores to localStorage.
 */
function saveKnowledgeStores(stores: KnowledgeStoreInfo[]) {
    localStorage.setItem(STORE_ARRAY_KEY, JSON.stringify(stores));
}

/**
 * Initializes the base CBT knowledge into the Gemini File Search Store.
 * Skips initialization if a base store already exists.
 */
export async function initKnowledgeBase(): Promise<KnowledgeStoreInfo | null> {
    try {
        let stores = getKnowledgeStores();
        let existingBase = stores.find(s => s.isBase && s.id !== GOOGLE_SEARCH_DUMMY_ID);

        // Check for version mismatch to force re-initialization
        if (existingBase && existingBase.version !== BASE_STORE_VERSION) {
            console.log('Base knowledge version mismatch. Deleting old base store:', existingBase.storeName);
            try {
                // We attempt to delete it from the cloud
                await ai.fileSearchStores.delete({ name: existingBase.storeName });
            } catch (e) {
                console.warn('Could not delete old base store on cloud, proceeding anyway.', e);
            }
            stores = stores.filter(s => s.id !== existingBase.id);
            existingBase = undefined; // Force re-creation
        }

        const storesToSave = [...stores];

        if (existingBase) {
            console.log('Base knowledge already initialized (Latest Version) in Google File Store:', existingBase.storeName);

            // Ensure Google Search Dummy exists even if base was already initialized
            const searchStoreExists = storesToSave.find(s => s.id === GOOGLE_SEARCH_DUMMY_ID);
            if (!searchStoreExists) {
                storesToSave.push({
                    id: GOOGLE_SEARCH_DUMMY_ID,
                    displayName: '🌍 실시간 구글 웹 검색 (Web Search)',
                    storeName: GOOGLE_SEARCH_DUMMY_ID,
                    isBase: true
                });
                saveKnowledgeStores(storesToSave);
            }
            return existingBase;
        }

        console.log('Creating new File Search Store and uploading base knowledge document...');

        // Create File Search Store
        const fileSearchStore = await ai.fileSearchStores.create({
            config: { displayName: 'CBT_Base_Knowledge_Store_' + Date.now() }
        });

        // Create a Blob/File from our static markdown content
        const fileBlob = new Blob([CBT_KNOWLEDGE_DOCUMENT], { type: 'text/plain' });
        const file = new File([fileBlob], 'cbt_knowledge.txt', { type: 'text/plain' });

        // Upload to store
        let operation = await ai.fileSearchStores.uploadToFileSearchStore({
            file: file,
            fileSearchStoreName: fileSearchStore.name,
            config: {
                displayName: 'CBT Diagnostic Methods',
            }
        });

        console.log('Waiting for File Search Store upload operation...');
        // Wait for indexing to complete
        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 3000));
            operation = await ai.operations.get({ operation: operation });
        }

        console.log('Successfully initialized Knowledge Base in Gemini File Store:', fileSearchStore.name);

        const newStoreInfo: KnowledgeStoreInfo = {
            id: 'base_' + Date.now(),
            displayName: '닥터 알마 CBT 기본 지식',
            storeName: fileSearchStore.name,
            isBase: true,
            version: BASE_STORE_VERSION
        };

        storesToSave.push(newStoreInfo);

        // Add Google Search Dummy if not exists
        const searchStoreExists = storesToSave.find(s => s.id === GOOGLE_SEARCH_DUMMY_ID);
        if (!searchStoreExists) {
            storesToSave.push({
                id: GOOGLE_SEARCH_DUMMY_ID,
                displayName: '🌍 실시간 구글 웹 검색 (Web Search)',
                storeName: GOOGLE_SEARCH_DUMMY_ID,
                isBase: true
            });
        }

        saveKnowledgeStores(storesToSave);

        return newStoreInfo;
    } catch (error) {
        console.error('Failed to initialize knowledge base:', error);
        return null;
    }
}

/**
 * Uploads a user-provided file (.txt, .md, .pdf) to a NEW File Search Store,
 * making it independently manageable via checkboxes.
 */
export async function uploadUserKnowledge(file: File): Promise<KnowledgeStoreInfo | null> {
    try {
        console.log(`Creating new Knowledge Store for user file '${file.name}'...`);

        const fileSearchStore = await ai.fileSearchStores.create({
            config: { displayName: `UserUpload_${file.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}` }
        });

        let operation = await ai.fileSearchStores.uploadToFileSearchStore({
            file: file,
            fileSearchStoreName: fileSearchStore.name,
            config: {
                displayName: file.name,
            }
        });

        console.log('Waiting for user file indexing operation...');
        // Poll for completion
        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 3000));
            operation = await ai.operations.get({ operation: operation });
        }

        console.log(`Successfully created store and added '${file.name}' to the Knowledge Base.`);

        const newStoreInfo: KnowledgeStoreInfo = {
            id: 'user_' + Date.now(),
            displayName: file.name,
            storeName: fileSearchStore.name,
            isBase: false
        };

        const stores = getKnowledgeStores();
        saveKnowledgeStores([...stores, newStoreInfo]);

        return newStoreInfo;
    } catch (error) {
        console.error('Failed to upload user knowledge file:', error);
        return null;
    }
}

/**
 * Deletes a specific Knowledge Store by ID.
 */
export async function deleteKnowledgeStore(id: string): Promise<boolean> {
    try {
        const stores = getKnowledgeStores();
        const storeToDelete = stores.find(s => s.id === id);
        if (!storeToDelete) return false;

        // Base logic cannot be deleted from UI
        if (storeToDelete.isBase) return false;

        console.log(`Deleting store: ${storeToDelete.storeName}`);
        await ai.fileSearchStores.delete({
            name: storeToDelete.storeName,
            config: { force: true }
        });

        const updatedStores = stores.filter(s => s.id !== id);
        saveKnowledgeStores(updatedStores);

        return true;
    } catch (error) {
        console.error('Failed to delete knowledge store:', error);
        return false;
    }
}
