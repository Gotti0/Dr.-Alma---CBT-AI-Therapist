import React, { useState, useEffect, useRef } from 'react';
import { Send, User, Bot, Trash2, AlertTriangle, Paperclip, Loader2, Database, X, Check, FileText, Brain, ChevronDown } from 'lucide-react';
import { sendMessageStream, StreamChunk, fetchAvailableModels, GeminiModelInfo } from '../services/gemini';
import { ChatMessage, getRecentMessages, saveMessage, cleanExpiredCache, clearAllMessages } from '../services/sessionCache';
import { retrieveRelevantContext, extractAndSaveMemory } from '../services/memoryManager';
import { initKnowledgeBase, uploadUserKnowledge, KnowledgeStoreInfo, getKnowledgeStores, deleteKnowledgeStore } from '../services/knowledgeManager';
import ReactMarkdown from 'react-markdown';
const FALLBACK_MODELS: GeminiModelInfo[] = [
  { id: 'gemini-2.5-flash-preview-05-20', name: 'Gemini 2.5 Flash Preview' },
  { id: 'gemini-2.5-pro-preview-05-06', name: 'Gemini 2.5 Pro Preview' },
];

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'model',
  text: '안녕하세요. 저는 닥터 알마입니다. 오늘 하루 어떠셨나요?\n\n상담을 시작하기 전에, 현재 느끼시는 우울이나 불안의 정도를 0에서 10 사이의 숫자로 표현해 주시겠어요? (0은 평온함, 10은 견딜 수 없는 고통입니다.)',
  timestamp: Date.now(),
};

export default function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [models, setModels] = useState<GeminiModelInfo[]>(FALLBACK_MODELS);
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [selectedModel, setSelectedModel] = useState(FALLBACK_MODELS[0].id);
  const [stores, setStores] = useState<KnowledgeStoreInfo[]>([]);
  const [activeStoreIds, setActiveStoreIds] = useState<string[]>([]);
  const [showStoreMenu, setShowStoreMenu] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [thinkingText, setThinkingText] = useState('');
  const [showThinking, setShowThinking] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const thinkingEndRef = useRef<HTMLDivElement>(null);

  const loadStores = () => {
    const loadedStores = getKnowledgeStores();
    setStores(loadedStores);

    // By default, activate the base store if we don't have active stores set
    if (activeStoreIds.length === 0) {
      const baseStore = loadedStores.find(s => s.isBase);
      if (baseStore) setActiveStoreIds([baseStore.id]);
    } else {
      // Remove any active IDs that no longer exist
      const existingIds = loadedStores.map(s => s.id);
      setActiveStoreIds(prev => prev.filter(id => existingIds.includes(id)));
    }
  };

  useEffect(() => {
    const init = async () => {
      // 동적 모델 목록 불러오기
      setIsLoadingModels(true);
      try {
        console.log('[ChatInterface] Starting model fetch...');
        const fetched = await fetchAvailableModels();
        if (fetched.length > 0) {
          console.log(`[ChatInterface] Successfully loaded ${fetched.length} models dynamically. Selected: ${fetched[0].id}`);
          setModels(fetched);
          setSelectedModel(fetched[0].id);
        } else {
          console.warn('[ChatInterface] fetchAvailableModels returned 0 models -> using FALLBACK_MODELS');
        }
      } catch (err) {
        console.error('[ChatInterface] Model fetch failed with error -> using FALLBACK_MODELS:', err);
      } finally {
        setIsLoadingModels(false);
      }

      // Initialize the knowledge base file store in the background
      await initKnowledgeBase();
      loadStores();

      await cleanExpiredCache();
      const history = await getRecentMessages();
      if (history.length === 0) {
        setMessages([WELCOME_MESSAGE]);
        await saveMessage(WELCOME_MESSAGE);
      } else {
        setMessages(history);
      }
    };
    init();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (thinkingText) {
      thinkingEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [thinkingText]);

  const toggleStoreActive = (id: string) => {
    setActiveStoreIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleDeleteStore = async (id: string) => {
    if (window.confirm('이 지식 문서를 정말 삭제하시겠습니까? (API 스토어에서도 영구 삭제됩니다)')) {
      const success = await deleteKnowledgeStore(id);
      if (success) {
        loadStores();
      }
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: input.trim(),
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    setThinkingText('');
    setShowThinking(true);
    await saveMessage(userMsg);

    try {
      // Retrieve Personal Memory context
      let retrievedContext = '';
      try {
        retrievedContext = await retrieveRelevantContext(userMsg.text);
      } catch (err) {
        console.error('Context retrieval failed:', err);
      }

      const historyForApi = messages.map(m => ({ role: m.role, text: m.text }));

      const activeStoreNames = stores
        .filter(s => activeStoreIds.includes(s.id))
        .map(s => s.storeName);

      const stream = await sendMessageStream(
        selectedModel,
        historyForApi,
        userMsg.text,
        retrievedContext,
        activeStoreNames.length > 0 ? activeStoreNames : undefined
      );

      const modelMsgId = (Date.now() + 1).toString();
      let fullText = '';
      let currentThinking = '';
      let answerStarted = false;

      setMessages(prev => [...prev, {
        id: modelMsgId,
        role: 'model',
        text: '',
        timestamp: Date.now(),
      }]);

      for await (const chunk of stream) {
        if (chunk.type === 'thought') {
          currentThinking += chunk.text;
          setThinkingText(currentThinking);
        } else {
          if (!answerStarted) {
            answerStarted = true;
            // Fade out thinking when answer starts
            setThinkingText('');
          }
          fullText += chunk.text;
          setMessages(prev => prev.map(msg =>
            msg.id === modelMsgId ? { ...msg, text: fullText } : msg
          ));
        }
      }

      await saveMessage({
        id: modelMsgId,
        role: 'model',
        text: fullText,
        timestamp: Date.now(),
      });

      // Background task to save memory chunk
      extractAndSaveMemory(userMsg.text, fullText).catch(console.error);

    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: '죄송합니다. 오류가 발생했습니다. 다시 시도해 주세요.',
        timestamp: Date.now(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = async () => {
    try {
      await clearAllMessages();
      const newWelcome = { ...WELCOME_MESSAGE, id: Date.now().toString(), timestamp: Date.now() };
      setMessages([newWelcome]);
      await saveMessage(newWelcome);
    } catch (error) {
      console.error('Failed to clear chat:', error);
      // Fallback alert if custom modal fails, though custom modal is preferred
      alert('대화 기록을 삭제하는 중 문제가 발생했습니다.');
    } finally {
      setShowClearConfirm(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so the same file can be selected again
    e.target.value = '';

    setIsUploadingFile(true);

    // Add temporary message indicating upload start
    const uploadStartMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'model',
      text: `\`${file.name}\` 지식 문서를 업로드하고 있습니다...`,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, uploadStartMsg]);

    const success = await uploadUserKnowledge(file);

    setIsUploadingFile(false);

    if (success) {
      loadStores();
      if (success.id) {
        setActiveStoreIds(prev => [...prev, success.id]);
      }
      setMessages(prev => [
        ...prev.filter(m => m.id !== uploadStartMsg.id),
        {
          id: Date.now().toString(),
          role: 'model',
          text: `✅ 성공적으로 \`${file.name}\` 지식 문서를 학습했습니다. (지식 제어 메뉴에서 켜고 끌 수 있습니다)`,
          timestamp: Date.now()
        }
      ]);
    } else {
      setMessages(prev => [
        ...prev.filter(m => m.id !== uploadStartMsg.id),
        {
          id: Date.now().toString(),
          role: 'model',
          text: `❌ \`${file.name}\` 파일 업로드에 실패했습니다. 다시 시도해 주세요.`,
          timestamp: Date.now()
        }
      ]);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-stone-50 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 px-6 py-4 flex justify-between items-center shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-serif text-xl font-bold">
            A
          </div>
          <div>
            <h1 className="text-xl font-semibold text-stone-800">Dr. Alma</h1>
            <p className="text-xs text-stone-500">CBT AI Therapist</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            disabled={isLoadingModels}
            className="text-sm border border-stone-300 rounded-md px-3 py-1.5 bg-stone-50 text-stone-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
          >
            {isLoadingModels ? (
              <option>모델 불러오는 중...</option>
            ) : (
              models.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))
            )}
          </select>
          <button
            onClick={() => setShowClearConfirm(true)}
            type="button"
            className="text-stone-400 hover:text-red-500 transition-colors p-2 rounded-md hover:bg-stone-100"
            title="대화 초기화"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </header>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-4 max-w-3xl mx-auto ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${msg.role === 'user' ? 'bg-stone-800 text-white' : 'bg-emerald-100 text-emerald-700'
              }`}>
              {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
            </div>
            <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`px-5 py-3.5 rounded-2xl shadow-sm ${msg.role === 'user'
                ? 'bg-stone-800 text-white rounded-tr-sm'
                : 'bg-white border border-stone-200 text-stone-800 rounded-tl-sm'
                }`}>
                {msg.role === 'model' && msg.text.includes('109') && msg.text.includes('119') ? (
                  <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl mb-2 flex items-start gap-3">
                    <AlertTriangle className="flex-shrink-0 mt-0.5" size={20} />
                    <div className="text-sm font-medium">
                      <ReactMarkdown>{msg.text}</ReactMarkdown>
                    </div>
                  </div>
                ) : (
                  <div className="prose prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-stone-100 prose-pre:text-stone-800">
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                  </div>
                )}
              </div>
              <span className="text-[10px] text-stone-400 mt-1 px-1">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}

        {/* Thinking Summary Panel */}
        {isLoading && thinkingText && (
          <div className="max-w-3xl mx-auto thinking-panel-enter">
            <div className="bg-gradient-to-br from-amber-50/90 to-orange-50/90 border border-amber-200/60 rounded-2xl shadow-sm overflow-hidden backdrop-blur-sm">
              <button
                onClick={() => setShowThinking(!showThinking)}
                className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-amber-100/30 transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center thinking-pulse">
                  <Brain size={14} className="text-amber-600" />
                </div>
                <span className="text-sm font-medium text-amber-800 flex-1">AI가 생각하고 있어요...</span>
                <ChevronDown
                  size={16}
                  className={`text-amber-400 transition-transform duration-200 ${showThinking ? 'rotate-180' : ''}`}
                />
              </button>
              {showThinking && (
                <div className="px-4 pb-3 thinking-content-enter">
                  <div className="max-h-40 overflow-y-auto text-xs leading-relaxed text-amber-700/80 font-mono bg-white/40 rounded-xl px-3 py-2.5 border border-amber-100/50 thinking-text-scroll">
                    {thinkingText}
                    <span className="inline-block w-1.5 h-3.5 bg-amber-400 ml-0.5 animate-pulse rounded-sm" />
                    <div ref={thinkingEndRef} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Loading Indicator (when no thinking text yet) */}
        {isLoading && !thinkingText && (
          <div className="max-w-3xl mx-auto flex gap-4">
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 flex-shrink-0">
              <Bot size={16} />
            </div>
            <div className="px-5 py-3.5 rounded-2xl rounded-tl-sm bg-white border border-stone-200 shadow-sm">
              <div className="flex items-center gap-2 text-stone-400">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-sm">응답을 준비하고 있어요...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-stone-200 p-4 sm:p-6">
        <div className="max-w-3xl mx-auto relative flex items-end gap-2">

          {/* Knowledge Control Popover */}
          <div className="relative">
            <button
              onClick={() => setShowStoreMenu(!showStoreMenu)}
              className={`p-3 transition-colors rounded-xl ${showStoreMenu ? 'bg-emerald-100 text-emerald-700' : 'text-stone-400 hover:text-emerald-600 hover:bg-stone-50'}`}
              title="지식 베이스 제어"
            >
              <Database size={20} />
              {activeStoreIds.length > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white"></span>
              )}
            </button>

            {showStoreMenu && (
              <div className="absolute bottom-full left-0 mb-2 w-72 bg-white rounded-2xl shadow-xl border border-stone-200 p-3 z-50">
                <div className="flex justify-between items-center mb-3 px-1">
                  <h3 className="text-sm font-semibold text-stone-800">지식 베이스 관리</h3>
                  <button onClick={() => setShowStoreMenu(false)} className="text-stone-400 hover:text-stone-600">
                    <X size={16} />
                  </button>
                </div>
                <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
                  {stores.length === 0 ? (
                    <p className="text-xs text-stone-500 italic p-2">업로드된 지식이 없습니다.</p>
                  ) : (
                    stores.map(store => (
                      <div key={store.id} className="flex items-center justify-between p-2 hover:bg-stone-50 rounded-lg group">
                        <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                          <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border ${activeStoreIds.includes(store.id) ? 'bg-emerald-500 border-emerald-500' : 'border-stone-300'}`}>
                            {activeStoreIds.includes(store.id) && <Check size={12} className="text-white" />}
                          </div>
                          <input
                            type="checkbox"
                            className="hidden"
                            checked={activeStoreIds.includes(store.id)}
                            onChange={() => toggleStoreActive(store.id)}
                          />
                          <FileText size={14} className="text-stone-400 flex-shrink-0" />
                          <span className="text-xs font-medium text-stone-700 truncate">{store.displayName}</span>
                        </label>
                        {!store.isBase && (
                          <button
                            onClick={(e) => { e.preventDefault(); handleDeleteStore(store.id); }}
                            className="text-stone-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="삭제"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                        {store.isBase && (
                          <span className="text-[9px] bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded ml-2 flex-shrink-0">기본</span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".txt,.md,.pdf"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingFile || isLoading}
            className="p-3 text-stone-400 hover:text-emerald-600 transition-colors disabled:opacity-50 hover:bg-stone-50 rounded-xl"
            title="새로운 지식 문서 업로드 (.txt, .md, .pdf)"
          >
            {isUploadingFile ? <Loader2 size={20} className="animate-spin text-emerald-600" /> : <Paperclip size={20} />}
          </button>

          <div className="relative flex-1">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="마음속 이야기를 편하게 들려주세요..."
              className="w-full bg-stone-50 border border-stone-300 rounded-2xl px-4 py-3.5 pr-12 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none min-h-[56px] max-h-32 text-stone-800"
              rows={1}
              style={{ height: 'auto' }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="absolute right-2 bottom-2 p-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-stone-300 text-white rounded-xl transition-colors flex items-center justify-center"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
        <p className="text-center text-[10px] text-stone-400 mt-3">
          AI는 전문적인 의료 진단을 제공하지 않습니다. 위급한 상황일 경우 119 또는 109(자살예방상담전화)로 연락하세요.
        </p>
      </div>

      {/* Clear Chat Confirm Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl shadow-xl max-w-sm w-full animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-semibold text-stone-800 mb-2">대화 기록 삭제</h3>
            <p className="text-stone-600 text-sm mb-6">모든 대화 기록을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleClearChat}
                className="px-4 py-2 text-sm font-medium bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                disabled={isLoading}
              >
                삭제하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
