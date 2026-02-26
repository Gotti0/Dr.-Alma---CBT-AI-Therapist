import React, { useState, useEffect, useRef } from 'react';
import { Send, User, Bot, Trash2, AlertTriangle } from 'lucide-react';
import { sendMessageStream } from '../services/gemini';
import { ChatMessage, getRecentMessages, saveMessage, cleanExpiredCache, clearAllMessages } from '../services/sessionCache';
import ReactMarkdown from 'react-markdown';

const MODELS = [
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro (추천)' },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash' },
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
  const [selectedModel, setSelectedModel] = useState(MODELS[0].id);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const init = async () => {
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
    await saveMessage(userMsg);

    try {
      const historyForApi = messages.map(m => ({ role: m.role, text: m.text }));
      const stream = await sendMessageStream(selectedModel, historyForApi, userMsg.text);
      
      const modelMsgId = (Date.now() + 1).toString();
      let fullText = '';
      
      setMessages(prev => [...prev, {
        id: modelMsgId,
        role: 'model',
        text: '',
        timestamp: Date.now(),
      }]);

      for await (const chunk of stream) {
        const chunkText = (chunk as any).text || '';
        fullText += chunkText;
        setMessages(prev => prev.map(msg => 
          msg.id === modelMsgId ? { ...msg, text: fullText } : msg
        ));
      }

      await saveMessage({
        id: modelMsgId,
        role: 'model',
        text: fullText,
        timestamp: Date.now(),
      });

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
    if (window.confirm('대화 기록을 모두 삭제하시겠습니까?')) {
      await clearAllMessages();
      const newWelcome = { ...WELCOME_MESSAGE, id: Date.now().toString(), timestamp: Date.now() };
      setMessages([newWelcome]);
      await saveMessage(newWelcome);
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
            className="text-sm border border-stone-300 rounded-md px-3 py-1.5 bg-stone-50 text-stone-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {MODELS.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <button 
            onClick={handleClearChat}
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
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
              msg.role === 'user' ? 'bg-stone-800 text-white' : 'bg-emerald-100 text-emerald-700'
            }`}>
              {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
            </div>
            <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`px-5 py-3.5 rounded-2xl shadow-sm ${
                msg.role === 'user' 
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
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-stone-200 p-4 sm:p-6">
        <div className="max-w-3xl mx-auto relative flex items-end gap-2">
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
        <p className="text-center text-[10px] text-stone-400 mt-3">
          AI는 전문적인 의료 진단을 제공하지 않습니다. 위급한 상황일 경우 119 또는 109(자살예방상담전화)로 연락하세요.
        </p>
      </div>
    </div>
  );
}
