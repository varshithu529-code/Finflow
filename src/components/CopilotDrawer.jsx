// src/components/CopilotDrawer.jsx
import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, User, ShieldAlert, Loader2, Mic } from 'lucide-react';
import { useStore } from '../store/StoreContext';
import { getDashboardStats } from '../utils/financeMath';

export default function CopilotDrawer({ isOpen, onClose }) {
  const { store } = useStore();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { role: 'model', text: "Hi! I'm FinFlow, your personal finance coach. Ask me about your budgets, goals, or run a what-if scenario!" }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInput(prev => prev ? `${prev} ${transcript}` : transcript);
      };
      
      recognition.onerror = (event) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
      };
      
      recognition.onend = () => {
        setIsListening(false);
      };
      
      recognitionRef.current = recognition;
    }
  }, []);

  const toggleListening = (e) => {
    e.preventDefault();
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!input.trim()) return;

    const userText = input.trim();
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setInput('');
    setIsLoading(true);

    // Layer 2 Guardrail: Code Check for restricted financial advice
    const guardrailPattern = /\b(buy|sell|invest in|recommend|which)\b.*\b(stock|stocks|fund|funds|crypto|cryptocurrency|bitcoin|tesla|apple|shares|securities|etf)\b/i;
    
    if (guardrailPattern.test(userText)) {
      setTimeout(() => {
        setMessages(prev => [...prev, { 
          role: 'model', 
          text: "I can help explain investing concepts, but I cannot recommend buying or selling specific stocks, funds, crypto, or securities. Please consult a licensed financial advisor for personalized investment advice." 
        }]);
        setIsLoading(false);
      }, 600);
      return;
    }

    if (!store.settings.geminiApiKey) {
      setMessages(prev => [...prev, { role: 'model', text: "Please add your Gemini API key in the Profile tab to chat with me." }]);
      setIsLoading(false);
      return;
    }

    try {
      // Build context from real numbers
      const stats = getDashboardStats(store);
      const context = {
        profile: store.profile,
        monthlyIncome: stats.income,
        monthlySpent: stats.spent,
        freeToSpend: stats.freeToSpend,
        budgets: store.budgets,
        goals: store.goals,
        subscriptions: store.subscriptions.filter(s => s.status === 'active'),
        nudges: store.nudges.filter(n => !n.isDismissed)
      };

      // Layer 1 Guardrail: System Instruction embedded in prompt
      const systemInstruction = `You are FinFlow, a personal finance coach. 
      CRITICAL RULE: NEVER recommend specific stocks, funds, crypto, or securities. If asked, explain the concept and suggest a licensed advisor.
      Here is the user's current financial data context: ${JSON.stringify(context)}`;

      // Format history for Gemini API
      const contents = messages.slice(1).map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }]
      }));
      
      contents.push({
        role: 'user',
        parts: [{ text: `[SYSTEM CONTEXT: ${systemInstruction}]\n\nUser Question: ${userText}` }]
      });

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${store.settings.geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: { temperature: 0.3 }
        })
      });

      if (!response.ok) throw new Error('API Error');
      const data = await response.json();
      const reply = data.candidates[0].content.parts[0].text;

      setMessages(prev => [...prev, { role: 'model', text: reply }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'model', text: "Sorry, I'm having trouble connecting right now. Please check your API key or try again later." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div className={`fixed inset-y-0 right-0 w-full sm:w-96 bg-white dark:bg-gray-900 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col border-l border-gray-200 dark:border-gray-800 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        
        {/* Header */}
        <div className="h-16 px-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-white dark:bg-gray-900 shrink-0">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-500">
            <Bot className="w-6 h-6" />
            <h2 className="font-bold text-lg text-gray-900 dark:text-white">FinFlow Copilot</h2>
          </div>
          <button onClick={onClose} className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900/50">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400' : 'bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>
                {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <div className={`px-4 py-2 rounded-2xl max-w-[75%] text-sm ${
                msg.role === 'user' 
                  ? 'bg-blue-600 text-white rounded-tr-sm' 
                  : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-tl-sm'
              }`}>
                {msg.text}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center shrink-0 text-gray-600 dark:text-gray-400">
                <Bot className="w-4 h-4" />
              </div>
              <div className="px-4 py-3 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-tl-sm flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                <span className="text-sm text-gray-500">Thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 shrink-0">
          <form onSubmit={handleSend} className="relative flex items-center">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your finances..."
              className="w-full pl-4 pr-20 py-3 bg-gray-100 dark:bg-gray-800 border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-gray-900 focus:ring-2 focus:ring-blue-500 rounded-xl text-sm text-gray-900 dark:text-white outline-none transition-all"
            />
            <div className="absolute right-2 flex items-center gap-1">
              {speechSupported && (
                <button
                  type="button"
                  onClick={toggleListening}
                  className={`p-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isListening 
                      ? 'text-red-500 bg-red-50 dark:bg-red-900/30 animate-pulse' 
                      : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30'
                  }`}
                  title={isListening ? "Stop listening" : "Start dictation"}
                >
                  <Mic className="w-4 h-4" />
                </button>
              )}
              <button 
                type="submit"
                disabled={!input.trim() || isLoading}
                className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
          <div className="mt-2 flex items-center justify-center gap-1 text-[10px] text-gray-400 dark:text-gray-500">
            <ShieldAlert className="w-3 h-3" />
            <span>FinFlow is an AI assistant. Not financial advice.</span>
          </div>
        </div>

      </div>
    </>
  );
}