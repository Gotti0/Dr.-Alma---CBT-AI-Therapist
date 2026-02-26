// src/services/memoryManager.ts
import { generateEmbedding } from './gemini';
import { saveEmbedding, searchSimilar, VectorMemory } from './vectorStore';
import { ChatMessage } from './sessionCache';

/**
 * Extracts a meaningful chunk from a recent interaction and saves it as an embedding.
 * Instead of saving every single short text, we combine a user message and AI response.
 */
export async function extractAndSaveMemory(userMessage: string, aiMessage: string): Promise<void> {
    try {
        // If messages are too short, skip saving to prevent noise (e.g., "네", "아니오")
        if (userMessage.length < 5 && aiMessage.length < 10) {
            return;
        }

        const memoryChunk = `[User]: ${userMessage}\n[Dr. Alma]: ${aiMessage}`;

        // Generate the embedding as a "document" since it will be stored and retrieved
        const embedding = await generateEmbedding(memoryChunk, false);

        // Save to IndexedDB
        await saveEmbedding({
            text: memoryChunk,
            embedding: embedding,
            metadata: { type: 'conversation_exchange' }
        });

    } catch (error) {
        console.error('Failed to extract and save memory:', error);
        // Non-blocking error: we don't want to crash the app if memory saving fails
    }
}

/**
 * Periodically or on specific triggers, you could also summarize a whole session.
 * For now, this is a placeholder if we want to run a summarize-and-save background task.
 */
export async function saveSessionSummaryMemory(summaryText: string): Promise<void> {
    try {
        const embedding = await generateEmbedding(summaryText, false);
        await saveEmbedding({
            text: summaryText,
            embedding: embedding,
            metadata: { type: 'session_summary' }
        });
    } catch (error) {
        console.error('Failed to save session summary memory:', error);
    }
}

/**
 * Retrieves the most relevant past contexts based on the user's current query.
 * @param currentQuery The latest message from the user
 * @param limit Max number of memory chunks to retrieve
 * @returns A formatted string containing the relevant past memories
 */
export async function retrieveRelevantContext(currentQuery: string, limit: number = 3): Promise<string> {
    if (!currentQuery || currentQuery.trim().length === 0) {
        return "";
    }

    try {
        // Generate embedding for the query (isQuery = true)
        const queryEmbedding = await generateEmbedding(currentQuery, true);

        // Search the vector database for similar chunks
        const similarMemories: VectorMemory[] = await searchSimilar(queryEmbedding, limit);

        if (similarMemories.length === 0) {
            return "";
        }

        // Combine the retrieved memories into a context string
        let matchedContext = "--- Relevant Past Encounters ---\n";
        similarMemories.forEach((memory, idx) => {
            // Adding some structure to help the LLM process the context
            matchedContext += `Memory ${idx + 1} (${new Date(memory.timestamp).toLocaleString()}):\n`;
            matchedContext += `${memory.text}\n\n`;
        });

        return matchedContext;
    } catch (error) {
        console.error('Failed to retrieve relevant context:', error);
        return "";
    }
}
