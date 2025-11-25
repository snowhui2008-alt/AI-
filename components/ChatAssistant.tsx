import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Loader2, Sparkles } from 'lucide-react';
import { ChatMessage, CircuitMode, CircuitState } from '../types';
import { sendMessageToGemini } from '../services/geminiService';
import { Content } from '@google/genai';

interface ChatAssistantProps {
  mode: CircuitMode;
  circuitState: CircuitState;
}

const ChatAssistant: React.FC<ChatAssistantProps> = ({ mode, circuitState }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: '你好！我是安培，你的物理助教。关于这个电路，你可以问我任何问题！' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // Convert internal ChatMessage to Gemini Content type
      const history: Content[] = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      const responseText = await sendMessageToGemini(input, history, mode, circuitState);
      
      const aiMsg: ChatMessage = { role: 'model', text: responseText };
      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'model', text: "抱歉，连接神经网络时出现错误。", isError: true }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const predefinedQuestions = [
    "解释这里的基尔霍夫定律",
    "计算总电阻",
    mode === 'rc-delay' ? "什么是时间常数？" : "如果增加电压会发生什么？"
  ];

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-800">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center gap-2 bg-slate-950">
        <Sparkles className="w-5 h-5 text-indigo-400" />
        <h2 className="font-bold text-slate-100">AI 助教</h2>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-indigo-600' : 'bg-emerald-600'}`}>
              {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
            </div>
            <div className={`p-3 rounded-lg text-sm max-w-[85%] leading-relaxed ${
              msg.role === 'user' 
                ? 'bg-indigo-600/20 text-indigo-100 border border-indigo-500/30' 
                : msg.isError 
                  ? 'bg-red-900/20 text-red-200 border border-red-800'
                  : 'bg-slate-800 text-slate-200 border border-slate-700'
            }`}>
              {/* Simple Markdown-like rendering for bold text */}
              {msg.text.split('\n').map((line, i) => (
                  <p key={i} className="mb-1 last:mb-0">
                      {line.split('**').map((part, j) => 
                          j % 2 === 1 ? <strong key={j} className="text-white font-semibold">{part}</strong> : part
                      )}
                  </p>
              ))}
            </div>
          </div>
        ))}
        {isLoading && (
           <div className="flex gap-3">
             <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center animate-pulse">
               <Bot size={16} />
             </div>
             <div className="flex items-center gap-1 text-slate-500 text-sm">
               思考中 <Loader2 className="w-3 h-3 animate-spin" />
             </div>
           </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      <div className="px-4 py-2 flex gap-2 overflow-x-auto scrollbar-hide">
        {predefinedQuestions.map((q, i) => (
          <button 
            key={i}
            onClick={() => { setInput(q); }}
            className="whitespace-nowrap px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-slate-800 bg-slate-950">
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="向安培提问关于电路的问题..."
            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-4 pr-12 py-3 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-slate-100"
          />
          <button 
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="absolute right-2 top-2 p-1.5 bg-indigo-600 rounded hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatAssistant;