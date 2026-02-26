import { GoogleGenAI, Modality } from '@google/genai';
import { safetyProtocol, sessionStructure } from './knowledgeBase';
import { GOOGLE_SEARCH_DUMMY_ID } from './knowledgeManager';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const systemInstruction = `
# CBT AI Therapeutic Agent - System Prompt

## Role Definition
You are 'Dr. Alma', a world-class clinical psychologist and an expert in Cognitive Behavioral Therapy (CBT).
Your ultimate goal is to identify cognitive distortions in the user's dialogue, correct them using Socratic questioning, and foster healthy behavioral changes. You must consistently maintain a demeanor that is warm and empathetic, yet highly logical and structured.

## Primary Directive
Strictly execute the ABCD model: rigorously analyze user inputs to uncover hidden irrational beliefs, actively dispute them, and strategically guide the user to formulate new, rational perspectives.

## Safety Override
${safetyProtocol}

## Conversational Constraints
1. ONE QUESTION RULE: Ask exactly ONE question per turn. Never bombard the user with multiple questions.
2. VALIDATION FIRST: You must fully validate and empathize with the user's emotions BEFORE offering any psychological intervention or advice.
3. GUIDED DISCOVERY: Never provide direct answers. Facilitate self-realization by asking targeted questions that lead the user to their own insights.
4. TRIGGER WORD DETECTION: Actively monitor user inputs for cognitive distortion triggers such as "always", "never", "must", "should", and address them when found.

## Behavioral Rules

# Session Flow Control
1. [Mood Check]: ALWAYS initiate the conversation by asking for the user's SUDS (Subjective Units of Distress Scale, 0 to 10).
2. [Agenda Setting]: When a user presents multiple problems, immediately ask them to restrict the scope: "Which ONE specific issue would you like to focus on the most today?"
3. [Intervention Examples]: 
   - If user says: "I am a failure" -> You ask: "How exactly do you define a failure?"
   - If user says: "He hates me" -> You ask: "What concrete evidence do you have that proves this thought is factually true?"
4. [Homework]: At the end of every session, assign a 5-to-10 minute 'graded task assignment' (a gradual behavioral step) engineered to improve the user's mood.

# Tone & Style
- LANGUAGE REQUIREMENT: All your responses to the user MUST be exclusively in Korean.
- Maintain a highly professional yet non-authoritarian and approachable tone (In Korean, strictly use the polite '해요(Haeyo)' form).
- DO NOT offer empty reassurances (e.g., do not say "Everything will be fine"). Instead, emphasize building realistic coping mechanisms and problem-solving skills (e.g., "Let's examine this problem together").

## Knowledge Base
${sessionStructure}
`;

export interface StreamChunk {
  type: 'thought' | 'answer';
  text: string;
}

export async function* sendMessageStream(
  model: string,
  history: { role: 'user' | 'model', text: string }[],
  message: string,
  contextString?: string,
  fileSearchStoreNames?: string[],
  audioData?: { base64: string; mimeType: string }
): AsyncGenerator<StreamChunk> {
  const contents = history.map(h => ({
    role: h.role,
    parts: [{ text: h.text }]
  }));

  // 오디오 데이터가 있으면 inlineData 파트를 포함하여 전송
  const userParts: any[] = [];
  if (audioData) {
    userParts.push({
      inlineData: { mimeType: audioData.mimeType, data: audioData.base64 }
    });
  }
  userParts.push({ text: message || '(음성 메시지)' });

  contents.push({
    role: 'user',
    parts: userParts
  });

  let finalInstruction = systemInstruction;

  if (contextString) {
    finalInstruction += `\n\n[System Runtime Context - User's Long-Term Memory]\n${contextString}\n(Note: The above memories are retrieved from past sessions. Use them to provide personalized responses if relevant.)`;
  }

  const config: any = {
    systemInstruction: finalInstruction,
    temperature: 0.7,
    thinkingConfig: {
      includeThoughts: true,
    },
  };

  if (fileSearchStoreNames && fileSearchStoreNames.length > 0) {
    config.tools = [];

    // Check if Google Search tool is requested
    if (fileSearchStoreNames.includes(GOOGLE_SEARCH_DUMMY_ID)) {
      config.tools.push({
        googleSearch: {}
      });
    }

    // Filter out the dummy ID to get only valid File Search Store names
    const validStoreNames = fileSearchStoreNames.filter(name => name !== GOOGLE_SEARCH_DUMMY_ID);

    if (validStoreNames.length > 0) {
      config.tools.push({
        fileSearch: {
          fileSearchStoreNames: validStoreNames
        }
      });
    }

    // If no tools were actually added (e.g., only dummy was selected but it failed), remove the empty array
    if (config.tools.length === 0) {
      delete config.tools;
    }
  }

  const responseStream = await ai.models.generateContentStream({
    model: model,
    contents: contents,
    config: config
  });

  for await (const chunk of responseStream) {
    const candidate = chunk.candidates?.[0];
    if (!candidate?.content?.parts) continue;

    for (const part of candidate.content.parts) {
      if (!part.text) continue;
      yield {
        type: (part as any).thought ? 'thought' : 'answer',
        text: part.text,
      };
    }
  }
}

export async function generateEmbedding(text: string, isQuery: boolean = true): Promise<number[]> {
  try {
    const response = await ai.models.embedContent({
      model: 'gemini-embedding-001',
      contents: text,
      config: {
        taskType: isQuery ? 'RETRIEVAL_QUERY' : 'RETRIEVAL_DOCUMENT',
        outputDimensionality: 768,
      }
    });

    // Fallback to deal with potential variance in the response structure based on the Google SDK
    if ((response as any).embedding && (response as any).embedding.values) {
      return (response as any).embedding.values;
    } else if (response.embeddings && response.embeddings.length > 0) {
      return response.embeddings[0].values;
    }

    throw new Error('No embedding returned from Gemini API');
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

export interface GeminiModelInfo {
  id: string;
  name: string;
}

/**
 * GoogleGenAI SDK를 통해 사용 가능한 모델 목록을 동적으로 가져옵니다.
 * generateContent를 지원하는 모델만 필터링하여 반환합니다.
 */
export async function fetchAvailableModels(): Promise<GeminiModelInfo[]> {
  try {
    console.log('[ModelLoader] Fetching models via SDK ai.models.list()...');
    const pager = await ai.models.list({ config: { pageSize: 1000 } });
    console.log('[ModelLoader] Pager received:', {
      pageLength: pager.page?.length ?? 'undefined',
      pagerKeys: Object.keys(pager),
    });

    const models: GeminiModelInfo[] = [];
    const modelList = pager.page || [];

    if (modelList.length === 0) {
      console.warn('[ModelLoader] pager.page is empty or undefined. Raw pager:', JSON.stringify(pager, null, 2));
    }

    for (const model of modelList) {
      const actions: string[] = model.supportedActions || [];
      if (actions.includes('generateContent')) {
        const id = (model.name || '').replace(/^models\//, '');
        const displayName = (model as any).displayName || id;
        models.push({ id, name: displayName });
      }
    }

    console.log(`[ModelLoader] Total models from API: ${modelList.length}, After filtering (generateContent): ${models.length}`);
    if (models.length > 0) {
      console.log('[ModelLoader] First 5 models:', models.slice(0, 5).map(m => `${m.id} (${m.name})`));
    }

    return models;
  } catch (error) {
    console.error('[ModelLoader] Failed to fetch models:', error);
    return [];
  }
}

/**
 * Gemini TTS API를 사용하여 텍스트를 음성으로 변환합니다.
 * @returns base64 인코딩된 PCM 오디오 데이터
 */
export async function generateTtsAudio(text: string, voiceName: string = 'Kore'): Promise<string> {
  const ttsPrompt = `
# AUDIO PROFILE: Dr. Alma
## THE SCENE: A comfortable and warm therapy room
The space is quiet, intimate, and safe, designed to make the user feel heard, understood, and relaxed.

### DIRECTOR'S NOTES
Style: Empathetic, warm, professional, and encouraging AI Cognitive Behavioral Therapist. The tone should be consistently supportive and non-judgmental. Use a subtle "vocal smile" to sound explicitly inviting, but maintain appropriate seriousness when discussing difficult emotions.
Pacing: Measured, calm, and deliberate. Lean into a soothing cadence.
Accent: Clear and articulate.

### SAMPLE CONTEXT
Dr. Alma is responding to a user sharing their thoughts or feelings, guiding them through CBT and mindfulness techniques with a highly compassionate attitude.

#### TRANSCRIPT
${text}`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-preview-tts',
    contents: [{ parts: [{ text: ttsPrompt }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) {
    throw new Error('[TTS] 오디오 데이터가 응답에 없습니다.');
  }
  return base64Audio;
}
