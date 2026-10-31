import React, { useState, useMemo } from 'react';
import { User, Key, Database, BookOpen, Trash2, ShieldAlert, Plus, Wallet } from 'lucide-react';
import { useStore } from '../store/StoreContext';
import { safeDiv } from '../utils/financeMath';

export default function Profile() {
  const { store, updateStore, updateProfile, updateSettings, loadDemoData, addToast } = useStore();
  
  const [newFixedCost, setNewFixedCost] = useState({ name: '', amount: '' });

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: store.settings.currency }).format(amount || 0);
  };

  const deleteRule = (ruleId) => {
    const updatedRules = store.rules.filter(r => r.id !== ruleId);
    updateStore('rules', updatedRules);
    addToast('Rule deleted', 'info');
  };

  const addFixedCost = (e) => {
    e.preventDefault();
    if (!newFixedCost.name || !newFixedCost.amount) return;
    
    const cost = {
      id: 'fc_' + Date.now(),
      name: newFixedCost.name,
      amount: parseFloat(newFixedCost.amount) || 0
    };
    
    updateProfile({ fixedCosts: [...(store.profile.fixedCosts || []), cost] });
    setNewFixedCost({ name: '', amount: '' });
    addToast('Fixed cost added', 'success');
  };

  const removeFixedCost = (id) => {
    const updated = store.profile.fixedCosts.filter(fc => fc.id !== id);
    updateProfile({ fixedCosts: updated });
  };

  const { runwayMonths, progress, targetMonths, monthlyBurnRate } = useMemo(() => {
    const fixedTotal = (store.profile.fixedCosts || []).reduce((sum, fc) => sum + (fc.amount || 0), 0);
    const activeSubs = (store.subscriptions || []).filter(s => s.status === 'active');
    const subsTotal = activeSubs.reduce((sum, sub) => {
      if (sub.frequency === 'monthly') return sum + sub.amount;
      if (sub.frequency === 'yearly') return sum + sub.amount / 12;
      if (sub.frequency === 'weekly') return sum + sub.amount * 4.33;
      return sum;
    }, 0);

    const uniqueMonths = new Set((store.transactions || []).map(t => t.date.substring(0, 7))).size;
    const allExpenses = (store.transactions || []).filter(t => t.type === 'expense').reduce((sum, t) => sum + (t.amount || 0), 0);
    const avgMonthlyExpenses = uniqueMonths > 0 ? safeDiv(allExpenses, uniqueMonths) : 0;
    
    const burnRate = Math.max(fixedTotal + subsTotal, avgMonthlyExpenses);
    
    const currentEF = store.profile.emergencyFund || 0;
    const target = store.profile.emergencyFundTargetMonths || 6;
    
    const runway = burnRate > 0 ? safeDiv(currentEF, burnRate) : 0;
    const prog = Math.min(100, target > 0 ? safeDiv(runway, target) * 100 : 0);

    return { runwayMonths: runway, progress: prog, targetMonths: target, monthlyBurnRate: burnRate };
  }, [store.profile, store.subscriptions, store.transactions]);

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3 mb-2 text-gray-800 dark:text-gray-200">
        <User className="w-8 h-8" />
        <h2 className="text-2xl font-bold">Profile & Settings</h2>
      </div>
      
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-800 dark:text-gray-200">
          <Wallet className="w-5 h-5" /> Financial Profile
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Monthly Income
            </label>
            <input
              type="number"
              value={store.profile.monthlyIncome || ''}
              onChange={(e) => updateProfile({ monthlyIncome: parseFloat(e.target.value) || 0 })}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="0.00"
            />
            <p className="text-xs text-gray-500 mt-1">Used as a baseline if transaction history is sparse.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Current Emergency Fund
            </label>
            <input
              type="number"
              value={store.profile.emergencyFund || ''}
              onChange={(e) => updateProfile({ emergencyFund: parseFloat(e.target.value) || 0 })}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="0.00"
            />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-800 dark:text-gray-200">
            <ShieldAlert className="w-5 h-5 text-blue-600" /> Emergency Fund Runway
          </h3>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 dark:text-gray-400">Target Months:</label>
            <input 
              type="number" 
              value={store.profile.emergencyFundTargetMonths || 6}
              onChange={(e) => updateProfile({ emergencyFundTargetMonths: parseInt(e.target.value) || 1 })}
              className="w-16 p-1 text-center rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between text-sm font-medium">
            <span className="text-gray-700 dark:text-gray-300">{runwayMonths.toFixed(1)} Months Saved</span>
            <span className="text-gray-500 dark:text-gray-400">Target: {targetMonths} Months</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
            <div 
              className={`h-4 rounded-full transition-all duration-500 ${progress >= 100 ? 'bg-green-500' : progress >= 50 ? 'bg-blue-500' : 'bg-amber-500'}`}
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Based on an estimated monthly burn rate of {formatCurrency(monthlyBurnRate)}.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-800 dark:text-gray-200">
          <Database className="w-5 h-5" /> Committed Fixed Costs
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Add your non-negotiable monthly expenses (Rent, EMI, Insurance). Subscriptions are tracked separately.
        </p>
        
        <div className="space-y-3 mb-4">
          {(store.profile.fixedCosts || []).map(fc => (
            <div key={fc.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
              <span className="font-medium text-gray-900 dark:text-gray-100">{fc.name}</span>
              <div className="flex items-center gap-4">
                <span className="text-gray-700 dark:text-gray-300">{formatCurrency(fc.amount)}</span>
                <button onClick={() => removeFixedCost(fc.id)} className="text-gray-400 hover:text-red-600 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 rounded">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {(!store.profile.fixedCosts || store.profile.fixedCosts.length === 0) && (
            <div className="text-center p-4 text-sm text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
              No fixed costs added yet.
            </div>
          )}
        </div>

        <form onSubmit={addFixedCost} className="flex gap-3">
          <input
            type="text"
            placeholder="Expense Name (e.g. Rent)"
            value={newFixedCost.name}
            onChange={e => setNewFixedCost({...newFixedCost, name: e.target.value})}
            className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
          />
          <input
            type="number"
            placeholder="Amount"
            value={newFixedCost.amount}
            onChange={e => setNewFixedCost({...newFixedCost, amount: e.target.value})}
            className="w-32 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
          />
          <button type="submit" className="px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-gray-500">
            <Plus className="w-4 h-4" /> Add
          </button>
        </form>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-800 dark:text-gray-200">
          <Key className="w-5 h-5" /> API Configuration
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Gemini API Key
            </label>
            <input
              type="password"
              value={store.settings.geminiApiKey}
              onChange={(e) => updateSettings({ geminiApiKey: e.target.value })}
              placeholder="AIzaSy..."
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Stored locally in your browser. Required for AI categorization and coaching.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-800 dark:text-gray-200">
          <BookOpen className="w-5 h-5" /> Learned Categorization Rules
        </h3>
        <div className="space-y-4">
          {store.rules.length === 0 ? (
            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg text-center text-sm text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
              No rules learned yet. Change a transaction's category to create one.
            </div>
          ) : (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="p-3 font-medium text-gray-500 dark:text-gray-400">Merchant / Keyword</th>
                    <th className="p-3 font-medium text-gray-500 dark:text-gray-400">Category</th>
                    <th className="p-3 font-medium text-gray-500 dark:text-gray-400 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {store.rules.map(rule => (
                    <tr key={rule.id} className="bg-white dark:bg-gray-800">
                      <td className="p-3 text-gray-900 dark:text-gray-100 font-medium">{rule.merchant}</td>
                      <td className="p-3">
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                          {rule.category}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <button 
                          onClick={() => deleteRule(rule.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-800 dark:text-gray-200">
          <Database className="w-5 h-5" /> Data Management
        </h3>
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Load sample data to test the application. This will overwrite your current transactions, budgets, and goals.
          </p>
          <button
            onClick={loadDemoData}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
          >
            Load Demo Data
          </button>
        </div>
      </div>
    </div>
  );
}