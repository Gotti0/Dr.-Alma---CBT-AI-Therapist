export interface KnowledgeChunk {
   id: string;
   type: 'distortion' | 'socratic_pattern';
   title: string;
   content: string;
}

export const cognitiveDistortions: KnowledgeChunk[] = [
   { id: 'dist_1', type: 'distortion', title: 'All-or-Nothing Thinking', content: 'Perceiving situations only in dichotomous categories. (e.g., If it\'s not perfect, it\'s a failure)' },
   { id: 'dist_2', type: 'distortion', title: 'Overgeneralization', content: 'Interpreting a single negative event as a never-ending pattern of defeat. (e.g., This always happens to me)' },
   { id: 'dist_3', type: 'distortion', title: 'Mental Filtering', content: 'Dwelling entirely on negative details while filtering out all positive elements.' },
   { id: 'dist_4', type: 'distortion', title: 'Discounting the Positive', content: 'Dismissing positive experiences or achievements as flukes or worthless.' },
   { id: 'dist_5', type: 'distortion', title: 'Jumping to Conclusions (Mind Reading/Fortune Telling)', content: 'Being certain of others\' negative thoughts without evidence, or predicting that things will turn out badly as an established fact.' },
   { id: 'dist_6', type: 'distortion', title: 'Magnification/Minimization', content: 'Exaggerating the importance of one\'s mistakes or shrinking one\'s own positive traits and others\' achievements.' },
   { id: 'dist_7', type: 'distortion', title: 'Emotional Reasoning', content: 'Using emotions as evidence for objective reality. (e.g., I feel anxious, so something bad must be about to happen)' },
   { id: 'dist_8', type: 'distortion', title: 'Should Statements', content: 'Forcing unrealistic rules on oneself or others. (e.g., I "must" or "should" do this)' },
   { id: 'dist_9', type: 'distortion', title: 'Labeling', content: 'Defining oneself or others with negative nouns instead of describing specific behaviors. (e.g., I am a loser)' },
   { id: 'dist_10', type: 'distortion', title: 'Personalization', content: 'Feeling responsible for events over which one has no control.' }
];

export const socraticPatterns: KnowledgeChunk[] = [
   { id: 'soc_1', type: 'socratic_pattern', title: 'Evidence-Based Verification', content: 'What is the evidence that this thought is true? Is there any evidence to the contrary?' },
   { id: 'soc_2', type: 'socratic_pattern', title: 'Exploring Alternative Perspectives', content: 'What advice would you give your best friend if they were in the exact same situation?' },
   { id: 'soc_3', type: 'socratic_pattern', title: 'Decatastrophizing', content: 'If the absolute worst-case scenario were to happen, how could you cope with it?' },
   { id: 'soc_4', type: 'socratic_pattern', title: 'Utility Analysis', content: 'Is continuing to hold onto this thought helping you solve the problem?' },
   { id: 'soc_5', type: 'socratic_pattern', title: 'Clarification of Meaning and Definition', content: 'What exactly is your definition of a "complete failure"?' }
];

export const safetyProtocol = `
Safety Protocol:
If the user expresses intent for suicide, self-harm, or harming others (e.g., "I want to die", "I want to end it all"):
1. Immediately HALT all psychotherapeutic interventions.
2. Output the following exact rejection script and emergency contacts (Must be output in Korean):
"회원님의 말씀에서 스스로를 해치거나 삶을 마감하고 싶다는 의도가 느껴져 매우 걱정됩니다. 저는 AI 프로그램이기에 현재 회원님이 겪고 계신 위급한 상황에 직접적인 도움을 드릴 수가 없습니다. 지금 즉시 전문가의 도움이 필요합니다. 아래의 번호로 연락해 주시거나 가까운 응급실을 방문해 주세요.
- 자살예방상담전화: 109
- 정신건강위기상담전화: 1577-0199
- 긴급범죄신고: 112 / 구급신고: 119
부디 지금 바로 전문가에게 연락하여 안전을 확보해 주시기 바랍니다."
`;

export const sessionStructure = `
Session Flow:
1. Introduction & Mood Check: Measure SUDS (Subjective Units of Distress Scale, 0-10) and build rapport.
2. Agenda Setting: Select ONE specific problem to address today.
3. Main Body - Cognitive Restructuring (Intervention): Apply the ABCD model and execute Socratic questioning. Maintain a 3:7 ratio of empathy to questioning.
4. Closure & Homework: Summarize the session, re-evaluate mood (SUDS), and propose a gradual behavioral task (homework).
`;
