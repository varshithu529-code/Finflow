import React, { useState } from 'react';
import { StoreProvider, useStore } from './store/StoreContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Subscriptions from './pages/Subscriptions';
import Budgets from './pages/Budgets';
import Goals from './pages/Goals';
import Profile from './pages/Profile';
import WhatIf from './pages/WhatIf';
import Reports from './pages/Reports';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Wallet, Sparkles, ArrowRight } from 'lucide-react';

function WelcomeScreen() {
  const { loadDemoData, startEmpty } = useStore();

  return (
    <div className="fixed inset-0 bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 max-w-lg w-full rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-8 text-center animate-in fade-in zoom-in duration-500">
        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-500/30">
          <Wallet className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3 tracking-tight">Welcome to FinFlow</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
          Your personal finance coach with a living money model. Track spending, set goals, and use AI to model "what-if" scenarios.
        </p>
        
        <div className="space-y-4">
          <button 
            onClick={loadDemoData}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-md"
          >
            <Sparkles className="w-5 h-5" />
            Load Demo Data (Recommended)
          </button>
          
          <button 
            onClick={startEmpty}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-semibold rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            Start Empty
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-500 mt-6">
          All data is stored locally in your browser.
        </p>
      </div>
    </div>
  );
}

function AppContent() {
  const { store } = useStore();
  const [activeTab, setActiveTab] = useState('dashboard');

  if (store.settings.isFirstRun) {
    return <WelcomeScreen />;
  }

  const renderPage = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'transactions': return <Transactions />;
      case 'subscriptions': return <Subscriptions />;
      case 'budgets': return <Budgets />;
      case 'goals': return <Goals />;
      case 'whatif': return <WhatIf />;
      case 'reports': return <Reports />;
      case 'profile': return <Profile />;
      default: return <Dashboard />;
    }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      <ErrorBoundary>
        {renderPage()}
      </ErrorBoundary>
    </Layout>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <AppContent />
    </StoreProvider>
  );
}