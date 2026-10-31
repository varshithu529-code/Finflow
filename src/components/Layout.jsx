// src/components/Layout.jsx
import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, Receipt, Repeat, PieChart, 
  Target, User, HelpCircle, BarChart3, 
  AlertTriangle, Moon, Sun, Wallet, X, Bell, Bot, Menu
} from 'lucide-react';
import { useStore } from '../store/StoreContext';
import { getBaselineStats, calculateGoalProjections, getDashboardStats } from '../utils/financeMath';
import CopilotDrawer from './CopilotDrawer';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'transactions', label: 'Transactions', icon: Receipt },
  { id: 'subscriptions', label: 'Subscriptions', icon: Repeat },
  { id: 'budgets', label: 'Budgets', icon: PieChart },
  { id: 'goals', label: 'Goals', icon: Target },
  { id: 'whatif', label: 'What-If', icon: HelpCircle },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'profile', label: 'Profile', icon: User },
];

export default function Layout({ activeTab, setActiveTab, children }) {
  const { store, updateStore, updateSettings, dismissNudge, toasts, removeToast } = useStore();
  const [showNudges, setShowNudges] = useState(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const nudgeDropdownRef = useRef(null);

  const toggleTheme = () => {
    updateSettings({ theme: store.settings.theme === 'dark' ? 'light' : 'dark' });
  };

  const activeNudges = store.nudges.filter(n => !n.isDismissed);

  useEffect(() => {
    const checkAndGenerateNudges = async () => {
      if (!store.settings.geminiApiKey || store.settings.isFirstRun) return;

      const today = new Date();
      const day = today.getDate();
      const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      const monthStr = today.toISOString().substring(0, 7);
      const currentMonthTxns = store.transactions.filter(t => t.date.startsWith(monthStr));

      const pendingPrompts = [];

      store.budgets.forEach(b => {
        const spent = currentMonthTxns.filter(t => t.category === b.category && t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
        const expected = (day / daysInMonth) * b.limit;
        if (spent > expected * 1.15) {
          const refId = `budget_${b.id}_${monthStr}`;
          if (!store.nudges.some(n => n.refId === refId)) {
            pendingPrompts.push({
              refId,
              context: `Budget for ${b.category} is ${b.limit}. Spent ${spent} by day ${day} of ${daysInMonth}. Expected pace was ${Math.round(expected)}.`
            });
          }
        }
      });

      const { surplus } = getBaselineStats(store);
      const projectedGoals = calculateGoalProjections(store.goals, surplus);
      projectedGoals.forEach(g => {
        if (g.status === 'Behind') {
          const refId = `goal_${g.id}_${monthStr}`;
          if (!store.nudges.some(n => n.refId === refId)) {
            pendingPrompts.push({
              refId,
              context: `Goal '${g.name}' is falling behind. Target is ${g.targetAmount}, currently saved ${g.currentAmount}. Deadline is ${g.deadline}.`
            });
          }
        }
      });

      store.subscriptions.forEach(s => {
        if (s.hasPriceIncrease) {
          const refId = `sub_price_${s.id}_${monthStr}`;
          if (!store.nudges.some(n => n.refId === refId)) {
            pendingPrompts.push({
              refId,
              context: `Subscription '${s.merchant}' recently increased in price to ${s.amount}.`
            });
          }
        }
        const daysSince = Math.round((today - new Date(s.lastUsedDate)) / 86400000);
        if (!s.isStillUsing || daysSince > 30) {
          const refId = `sub_unused_${s.id}_${monthStr}`;
          if (!store.nudges.some(n => n.refId === refId)) {
            pendingPrompts.push({
              refId,
              context: `Subscription '${s.merchant}' costing ${s.amount} hasn't been used in ${daysSince} days.`
            });
          }
        }
      });

      const stats = getDashboardStats(store);
      if (stats.safeDaily < stats.expectedSafeDaily * 0.5 && stats.expectedSafeDaily > 0) {
        const refId = `safedaily_${monthStr}`;
        if (!store.nudges.some(n => n.refId === refId)) {
          pendingPrompts.push({
            refId,
            context: `Safe daily spending limit has shrunk to ${Math.round(stats.safeDaily)} (originally expected ${Math.round(stats.expectedSafeDaily)}).`
          });
        }
      }

      if (pendingPrompts.length === 0) return;

      try {
        const prompt = `You are a friendly financial coach. For each scenario below, write exactly ONE sentence containing a friendly nudge and a concrete tip. Use ONLY the numbers provided. Do not invent figures.
        Return ONLY a valid JSON array of objects with keys "refId" and "text".
        Scenarios:
        ${JSON.stringify(pendingPrompts)}`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${store.settings.geminiApiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2, response_mime_type: "application/json" }
          })
        });

        if (response.ok) {
          const data = await response.json();
          const textResponse = data.candidates[0].content.parts[0].text;
          const generatedNudges = JSON.parse(textResponse.replace(/```json/g, '').replace(/```/g, '').trim());
          
          const newNudges = generatedNudges.map(n => ({
            id: 'nudge_' + Date.now() + Math.random().toString(36).substr(2, 9),
            refId: n.refId,
            text: n.text,
            isDismissed: false,
            date: new Date().toISOString()
          }));

          updateStore('nudges', [...store.nudges, ...newNudges]);
        }
      } catch (error) {
        console.error("Nudge Engine failed:", error);
      }
    };

    const timer = setTimeout(checkAndGenerateNudges, 2000);
    return () => clearTimeout(timer);
  }, [store.transactions, store.budgets, store.goals, store.subscriptions, store.settings.geminiApiKey, store.settings.isFirstRun]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (nudgeDropdownRef.current && !nudgeDropdownRef.current.contains(event.target)) {
        setShowNudges(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900 relative">
      
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 sm:hidden transition-opacity" 
          onClick={() => setIsMobileMenuOpen(false)} 
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col transform transition-transform duration-300 ease-in-out sm:relative sm:translate-x-0 print:hidden ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg text-white">
              <Wallet className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">FinFlow</h1>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="sm:hidden p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto pb-6">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setIsMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
                  isActive 
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium' 
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4 sm:px-6 shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsMobileMenuOpen(true)} 
              className="sm:hidden p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:flex items-center gap-2 text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-500/10 px-4 py-2 rounded-lg text-sm font-medium">
              <AlertTriangle className="w-4 h-4" />
              <span>Educational purposes only. Not financial advice.</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <select
              value={store.settings.currency}
              onChange={(e) => updateSettings({ currency: e.target.value })}
              className="hidden sm:block bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm rounded-lg px-3 py-2 border-none focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="INR">₹ INR</option>
              <option value="USD">$ USD</option>
              <option value="EUR">€ EUR</option>
              <option value="GBP">£ GBP</option>
            </select>

            <button
              onClick={toggleTheme}
              className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Toggle Theme"
            >
              {store.settings.theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* Copilot Button */}
            <button
              onClick={() => setIsCopilotOpen(true)}
              className="p-2 text-blue-600 dark:text-blue-400 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="Open FinFlow Copilot"
            >
              <Bot className="w-5 h-5" />
            </button>

            {/* Nudges Bell */}
            <div className="relative" ref={nudgeDropdownRef}>
              <button
                onClick={() => setShowNudges(!showNudges)}
                className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors relative focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5" />
                {activeNudges.length > 0 && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-gray-800"></span>
                )}
              </button>

              {showNudges && (
                <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-50 overflow-hidden flex flex-col max-h-96">
                  <div className="p-4 border-b border-gray-100 dark:border-gray-700 font-semibold text-gray-900 dark:text-white flex justify-between items-center">
                    <span>Coach Nudges</span>
                    <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400 px-2 py-1 rounded-full">{activeNudges.length} New</span>
                  </div>
                  <div className="overflow-y-auto flex-1 p-2 space-y-2">
                    {activeNudges.length === 0 ? (
                      <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                        You're all caught up!
                      </div>
                    ) : (
                      activeNudges.map(nudge => (
                        <div key={nudge.id} className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-gray-800 dark:text-gray-200 flex items-start gap-3 group">
                          <div className="flex-1 leading-relaxed">{nudge.text}</div>
                          <button 
                            onClick={() => dismissNudge(nudge.id)}
                            className="text-gray-400 hover:text-gray-700 dark:hover:text-white opacity-0 group-hover:opacity-100 transition-opacity focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 print:p-0 print:bg-white print:text-black">
          {children}
        </div>
      </main>

      {/* Copilot Drawer */}
      <CopilotDrawer isOpen={isCopilotOpen} onClose={() => setIsCopilotOpen(false)} />

      {/* Toast Container - Hidden when printing */}
      <div className="absolute bottom-6 right-4 sm:right-6 z-50 flex flex-col gap-2 pointer-events-none print:hidden">
        {toasts.map(toast => (
          <div 
            key={toast.id} 
            className={`flex items-center justify-between gap-4 px-4 py-3 rounded-lg shadow-lg pointer-events-auto transition-all min-w-[280px] sm:min-w-[300px] ${
              toast.type === 'success' ? 'bg-green-600 text-white' : 
              toast.type === 'error' ? 'bg-red-600 text-white' : 
              'bg-gray-800 text-white'
            }`}
          >
            <span className="text-sm font-medium">{toast.message}</span>
            <div className="flex items-center gap-3">
              {toast.action && (
                <button 
                  onClick={() => {
                    toast.action.onClick();
                    removeToast(toast.id);
                  }}
                  className="text-sm font-bold underline hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-white rounded"
                >
                  {toast.action.label}
                </button>
              )}
              <button onClick={() => removeToast(toast.id)} className="opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-white rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}