import React, { createContext, useContext, useState, useEffect } from 'react';

const StoreContext = createContext();

const defaultState = {
  transactions: [],
  budgets: [],
  goals: [],
  profile: {
    monthlyIncome: 0,
    fixedCosts: [],
    emergencyFund: 0,
    emergencyFundTargetMonths: 6
  },
  rules: [],
  subscriptions: [],
  nudges: [],
  aiCategoryCache: {},
  settings: {
    currency: 'INR',
    theme: 'dark',
    geminiApiKey: '',
    isFirstRun: true
  }
};

const DEMO_DATA = {
  profile: { 
    name: 'Rahul Sharma', 
    monthlyIncome: 100000, 
    profession: 'Software Engineer',
    fixedCosts: [
      { id: 'fc1', name: 'Rent', amount: 30000 },
      { id: 'fc2', name: 'Electricity', amount: 1500 },
      { id: 'fc3', name: 'Internet', amount: 1000 }
    ],
    emergencyFund: 150000,
    emergencyFundTargetMonths: 6
  },
  budgets: [
    { id: 'b1', category: 'Food & Dining', limit: 12000, period: 'monthly' },
    { id: 'b2', category: 'Transport', limit: 4000, period: 'monthly' },
    { id: 'b3', category: 'Utilities', limit: 5000, period: 'monthly' }
  ],
  goals: [
    { id: 'g1', name: 'Emergency Fund', targetAmount: 300000, currentAmount: 150000, deadline: '2027-12-31', priority: 1 },
    { id: 'g2', name: 'Goa Vacation', targetAmount: 50000, currentAmount: 15000, deadline: '2027-03-15', priority: 2 }
  ],
  rules: [],
  subscriptions: [],
  nudges: [],
  aiCategoryCache: {},
  transactions: [
    { id: 't1', date: '2026-08-01', amount: 100000, type: 'income', category: 'Salary', merchant: 'Tech Corp', description: 'August Salary' },
    { id: 't2', date: '2026-08-02', amount: 30000, type: 'expense', category: 'Housing', merchant: 'Landlord', description: 'Rent via UPI' },
    { id: 't3', date: '2026-08-05', amount: 1500, type: 'expense', category: 'Utilities', merchant: 'BESCOM', description: 'Electricity Bill' },
    { id: 't4', date: '2026-08-08', amount: 199, type: 'expense', category: 'Entertainment', merchant: 'Netflix', description: 'Monthly Subscription' },
    { id: 't5', date: '2026-08-10', amount: 119, type: 'expense', category: 'Entertainment', merchant: 'Spotify', description: 'Premium' },
    { id: 't6', date: '2026-08-12', amount: 1500, type: 'expense', category: 'Health', merchant: 'Cult Fit', description: 'Gym Membership' },
    { id: 't7', date: '2026-08-15', amount: 450, type: 'expense', category: 'Food & Dining', merchant: 'Swiggy', description: 'Dinner order' },
    { id: 't8', date: '2026-08-18', amount: 300, type: 'expense', category: 'Transport', merchant: 'Uber', description: 'Office ride' },
    { id: 't9', date: '2026-08-22', amount: 5000, type: 'expense', category: 'Groceries', merchant: 'Blinkit', description: 'Monthly groceries' },
    { id: 't10', date: '2026-09-01', amount: 100000, type: 'income', category: 'Salary', merchant: 'Tech Corp', description: 'September Salary' },
    { id: 't11', date: '2026-09-02', amount: 30000, type: 'expense', category: 'Housing', merchant: 'Landlord', description: 'Rent via UPI' },
    { id: 't12', date: '2026-09-05', amount: 1600, type: 'expense', category: 'Utilities', merchant: 'BESCOM', description: 'Electricity Bill' },
    { id: 't13', date: '2026-09-08', amount: 199, type: 'expense', category: 'Entertainment', merchant: 'Netflix', description: 'Monthly Subscription' },
    { id: 't14', date: '2026-09-10', amount: 119, type: 'expense', category: 'Entertainment', merchant: 'Spotify', description: 'Premium' },
    { id: 't15', date: '2026-09-12', amount: 1500, type: 'expense', category: 'Health', merchant: 'Cult Fit', description: 'Gym Membership' },
    { id: 't16', date: '2026-09-16', amount: 600, type: 'expense', category: 'Food & Dining', merchant: 'Zomato', description: 'Lunch order' },
    { id: 't17', date: '2026-09-19', amount: 450, type: 'expense', category: 'Transport', merchant: 'Uber', description: 'Airport ride' },
    { id: 't18', date: '2026-09-24', amount: 4800, type: 'expense', category: 'Groceries', merchant: 'Zepto', description: 'Groceries' },
    { id: 't19', date: '2026-10-01', amount: 100000, type: 'income', category: 'Salary', merchant: 'Tech Corp', description: 'October Salary' },
    { id: 't20', date: '2026-10-02', amount: 30000, type: 'expense', category: 'Housing', merchant: 'Landlord', description: 'Rent via UPI' },
    { id: 't21', date: '2026-10-05', amount: 1450, type: 'expense', category: 'Utilities', merchant: 'BESCOM', description: 'Electricity Bill' },
    { id: 't22', date: '2026-10-08', amount: 499, type: 'expense', category: 'Entertainment', merchant: 'Netflix', description: 'Monthly Subscription (Price Increase)' },
    { id: 't23', date: '2026-10-10', amount: 119, type: 'expense', category: 'Entertainment', merchant: 'Spotify', description: 'Premium' },
    { id: 't24', date: '2026-10-12', amount: 1500, type: 'expense', category: 'Health', merchant: 'Cult Fit', description: 'Gym Membership' },
    { id: 't25', date: '2026-10-15', amount: 550, type: 'expense', category: 'Food & Dining', merchant: 'Swiggy', description: 'Dinner order' },
    { id: 't26', date: '2026-10-20', amount: 250, type: 'expense', category: 'Transport', merchant: 'Uber', description: 'Office ride' },
    { id: 't27', date: '2026-10-25', amount: 5200, type: 'expense', category: 'Groceries', merchant: 'Blinkit', description: 'Diwali groceries' },
  ]
};

export function StoreProvider({ children }) {
  const [store, setStore] = useState(() => {
    const saved = localStorage.getItem('finflow_store') ?? localStorage.getItem('finpilot_store');
    const parsed = saved ? JSON.parse(saved) : defaultState;
    
    if (!parsed.profile) parsed.profile = defaultState.profile;
    if (parsed.profile.monthlyIncome === undefined) parsed.profile.monthlyIncome = 0;
    if (!parsed.profile.fixedCosts) parsed.profile.fixedCosts = [];
    if (parsed.profile.emergencyFund === undefined) parsed.profile.emergencyFund = 0;
    if (parsed.profile.emergencyFundTargetMonths === undefined) parsed.profile.emergencyFundTargetMonths = 6;
    if (!parsed.subscriptions) parsed.subscriptions = [];
    if (!parsed.nudges) parsed.nudges = [];
    if (!parsed.aiCategoryCache) parsed.aiCategoryCache = {};
    if (parsed.settings.isFirstRun === undefined) parsed.settings.isFirstRun = false;
    
    if (parsed.goals) {
      parsed.goals = parsed.goals.map((g, i) => ({ ...g, priority: g.priority || i + 1 }));
      
      // Sync legacy EF goal into profile on load
      const efGoal = parsed.goals.find(g => g.name === 'Emergency Fund');
      if (efGoal && parsed.profile.emergencyFund === 0 && efGoal.currentAmount > 0) {
        parsed.profile.emergencyFund = efGoal.currentAmount;
      }
    }
    
    if (parsed.budgets) {
      parsed.budgets = parsed.budgets.map(b => ({ ...b, period: b.period || 'monthly' }));
    }
    
    return parsed;
  });

  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    localStorage.setItem('finflow_store', JSON.stringify(store));
    
    if (store.settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [store]);

  const updateStore = (key, value) => {
    setStore(prev => ({ ...prev, [key]: value }));
  };

  const updateProfile = (updates) => {
    setStore(prev => ({
      ...prev,
      profile: { ...prev.profile, ...updates }
    }));
  };

  const updateSettings = (newSettings) => {
    setStore(prev => ({
      ...prev,
      settings: { ...prev.settings, ...newSettings }
    }));
  };

  const dismissNudge = (id) => {
    setStore(prev => ({
      ...prev,
      nudges: prev.nudges.map(n => n.id === id ? { ...n, isDismissed: true } : n)
    }));
  };

  const loadDemoData = () => {
    setStore(prev => ({
      ...prev,
      ...DEMO_DATA,
      settings: { ...prev.settings, isFirstRun: false }
    }));
    addToast('Demo data loaded successfully!', 'success');
  };

  const startEmpty = () => {
    updateSettings({ isFirstRun: false });
    addToast('Started fresh! Add a Gemini API key in Profile to enable AI features.', 'success');
  };

  const addToast = (message, type = 'info', action = null) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type, action }]);
    setTimeout(() => {
      removeToast(id);
    }, 6000);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <StoreContext.Provider value={{ store, updateStore, updateProfile, updateSettings, dismissNudge, loadDemoData, startEmpty, toasts, addToast, removeToast }}>
      {children}
    </StoreContext.Provider>
  );
}

export const useStore = () => useContext(StoreContext);
