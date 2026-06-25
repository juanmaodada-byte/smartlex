import React, { useState, useRef, useEffect, useCallback } from 'react';
import { SemanticAnalysis, ChatMessage } from '../types';
import { chatWithAI, getActiveProviderName } from '../aiService';
import { hasActiveApiKey } from '../services/apiConfig';
import { useStore } from '../contexts/StoreContext';

const ChatSidebar: React.FC = () => {
  const { currentAnalysis } = useStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [providerName, setProviderName] = useState(getActiveProviderName());
  const [keyReady, setKeyReady] = useState(hasActiveApiKey());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  useEffect(() => {
    const refresh = () => {
      setProviderName(getActiveProviderName());
      setKeyReady(hasActiveApiKey());
    };
    window.addEventListener('smartlex:provider-changed', refresh);
    window.addEventListener('smartlex:api-key-changed', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('smartlex:provider-changed', refresh);
      window.removeEventListener('smartlex:api-key-changed', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isTyping) return;

    if (!hasActiveApiKey()) {
      const errMsg: ChatMessage = {
        role: 'model',
        text: '⚠️ 尚未配置 API Key，请在「设置 → AI 模型」中填入 Key 后再对话。',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errMsg]);
      return;
    }

    const userMsg: ChatMessage = {
      role: 'user',
      text: input,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setIsTyping(true);

    try {
      const response = await chatWithAI(input, currentAnalysis, messages);
      const aiMsg: ChatMessage = {
        role: 'model',
        text: response || "抱歉，我现在有点忙，请稍后再试~ 😊",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (error: any) {
      console.error("Chat error:", error);
      const errMsg: ChatMessage = {
        role: 'model',
        text: `❌ ${error?.message || '对话失败，请检查 API Key 或网络连接。'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsTyping(false);
    }
  }, [input, isTyping, currentAnalysis, messages]);

  return (
    <aside className="w-72 md:w-80 flex flex-col bg-bg-surface dark:bg-warm-900 border-l border-warm-200/60 dark:border-warm-800/60 shrink-0 z-20">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-warm-100 dark:border-warm-800/40 shrink-0">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-lg bg-accent-100 dark:bg-accent-900/30 flex items-center justify-center">
            <span className="material-symbols-outlined text-accent-600 dark:text-accent-400 text-lg">smart_toy</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-warm-800 dark:text-warm-200">AI 助手</p>
            <div className="flex items-center gap-1.5">
              <span className={`size-1.5 rounded-full ${isTyping ? 'bg-warning-500 animate-pulse' : keyReady ? 'bg-success-500' : 'bg-error-500'}`} />
              <span className="text-[10px] text-warm-400 font-medium">
                {isTyping ? '思考中...' : keyReady ? providerName : '未配置'}
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={() => setMessages([])}
          className="size-8 rounded-lg flex items-center justify-center text-warm-400 hover:text-warm-600 dark:hover:text-warm-300 hover:bg-warm-100 dark:hover:bg-warm-800/50 transition-colors"
          title="新对话"
        >
          <span className="material-symbols-outlined text-lg">add_comment</span>
        </button>
      </div>

      {/* ─── 消息区 ─── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4 space-y-5">
        {messages.length === 0 ? (
          /* 欢迎界面 */
          <div className="flex flex-col items-start animate-fade-in">
            <div className="bg-warm-50 dark:bg-warm-800/50 rounded-2xl rounded-tl-sm p-5 w-full border border-warm-100 dark:border-warm-700/40">
              <p className="text-lg font-bold text-warm-800 dark:text-warm-200 mb-3 flex items-center gap-2">
                <span className="text-xl">👋</span> 你好！
              </p>
              <p className="text-sm text-warm-500 dark:text-warm-400 mb-4 leading-relaxed">
                准备好深入探索语言了吗？我可以帮你：
              </p>
              <div className="space-y-3">
                {[
                  { icon: 'psychology', text: '解码隐喻与深层含义' },
                  { icon: 'translate', text: '解析习语与俚语用法' },
                  { icon: 'menu_book', text: '探索词汇搭配与起源' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm text-warm-600 dark:text-warm-300">
                    <span className="size-6 rounded-md bg-accent-100 dark:bg-accent-900/30 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-sm text-accent-600 dark:text-accent-400">{item.icon}</span>
                    </span>
                    {item.text}
                  </div>
                ))}
              </div>

              {currentAnalysis && (
                <div className="mt-5 p-3 bg-accent-50/50 dark:bg-accent-900/10 rounded-xl border border-accent-100 dark:border-accent-900/20">
                  <p className="text-[10px] text-accent-500 mb-1 font-semibold uppercase tracking-wide">当前分析</p>
                  <p className="text-sm font-bold text-warm-700 dark:text-warm-300 italic">
                    "{currentAnalysis.term}"
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} gap-1 animate-fade-in`}>
              {msg.role === 'model' && (
                <span className="text-[10px] font-semibold text-warm-400 ml-1 uppercase tracking-wide">SmartLex AI</span>
              )}
              <div className={`max-w-[88%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${msg.role === 'user'
                  ? 'bg-accent-500 text-white rounded-br-sm'
                  : 'bg-warm-50 dark:bg-warm-800/50 text-warm-700 dark:text-warm-300 rounded-bl-sm border border-warm-100 dark:border-warm-700/40'
                }`}>
                {msg.text}
              </div>
              <span className="text-[10px] text-warm-400 px-1">{msg.timestamp}</span>
            </div>
          ))
        )}

        {isTyping && (
          <div className="flex flex-col items-start gap-1">
            <span className="text-[10px] font-semibold text-warm-400 ml-1 uppercase tracking-wide">SmartLex AI</span>
            <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-warm-50 dark:bg-warm-800/50 border border-warm-100 dark:border-warm-700/40">
              <div className="flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-warm-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="size-1.5 rounded-full bg-warm-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="size-1.5 rounded-full bg-warm-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── 输入区 ─── */}
      <div className="p-3 border-t border-warm-100 dark:border-warm-800/40 bg-bg-surface dark:bg-warm-900">
        <div className="flex items-end gap-2 p-1.5 bg-warm-50 dark:bg-warm-800/50 rounded-xl border border-warm-200/60 dark:border-warm-700/40 focus-within:border-accent-300 dark:focus-within:border-accent-600 focus-within:shadow-glow transition-all">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-medium min-h-[40px] max-h-36 py-2 px-2 resize-none placeholder:text-warm-400 dark:placeholder:text-warm-500 outline-none leading-relaxed"
            placeholder="问点什么..."
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className="shrink-0 size-9 rounded-lg bg-accent-500 text-white flex items-center justify-center hover:bg-accent-600 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 shadow-sm"
          >
            <span className="material-symbols-outlined text-lg">send</span>
          </button>
        </div>
      </div>
    </aside>
  );
};

export default ChatSidebar;
