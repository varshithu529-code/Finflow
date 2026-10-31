import React, { useState, useMemo } from 'react';
import { PieChart, Plus, Trash2, Wand2, X, Edit2, Check } from 'lucide-react';
import { useStore } from '../store/StoreContext';
import { CATEGORIES, getBaselineStats } from '../utils/financeMath';

export default function Budgets() {
  const { store, updateStore, addToast } = useStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newBudget, setNewBudget] = useState({ category: CATEGORIES[0], limit: '', period: 'monthly', startDate: '', endDate: '' });
  
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: store.settings.currency, maximumFractionDigits: 0 }).format(amount || 0);
  };

  const budgetsWithProgress = useMemo(() => {
    const today = new Date();
    const currentMonthStr = today.toISOString().substring(0, 7);
    const currentYearStr = today.getFullYear().toString();
    
    // Weekly bounds
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    const startOfWeekStr = startOfWeek.toISOString().split('T')[0];
    const endOfWeekStr = endOfWeek.toISOString().split('T')[0];

    // Quarterly bounds
    const quarter = Math.floor(today.getMonth() / 3);
    const startOfQuarter = new Date(today.getFullYear(), quarter * 3, 1);
    const endOfQuarter = new Date(today.getFullYear(), quarter * 3 + 3, 0);
    const startOfQuarterStr = startOfQuarter.toISOString().split('T')[0];
    const endOfQuarterStr = endOfQuarter.toISOString().split('T')[0];

    return (store.budgets || []).map(b => {
      const period = b.period || 'monthly';
      const txns = (store.transactions || []).filter(t => {
        if (t.type !== 'expense' || t.category !== b.category) return false;
        if (period === 'monthly') return t.date.startsWith(currentMonthStr);
        if (period === 'yearly') return t.date.startsWith(currentYearStr);
        if (period === 'weekly') return t.date >= startOfWeekStr && t.date <= endOfWeekStr;
        if (period === 'quarterly') return t.date >= startOfQuarterStr && t.date <= endOfQuarterStr;
        if (period === 'custom') return t.date >= b.startDate && t.date <= b.endDate;
        return false;
      });

      const spent = txns.reduce((sum, t) => sum + (t.amount || 0), 0);
      const progress = Math.min(100, (spent / (b.limit || 1)) * 100);
      return { ...b, spent, progress };
    });
  }, [store.budgets, store.transactions]);

  const handleAddBudget = (e) => {
    e.preventDefault();
    if (store.budgets.some(b => b.category === newBudget.category)) {
      addToast('Budget for this category already exists', 'error');
      return;
    }
    const budget = {
      id: 'b_' + Date.now(),
      category: newBudget.category,
      limit: parseFloat(newBudget.limit) || 0,
      period: newBudget.period,
      startDate: newBudget.startDate,
      endDate: newBudget.endDate
    };
    updateStore('budgets', [...store.budgets, budget]);
    setIsModalOpen(false);
    setNewBudget({ category: CATEGORIES[0], limit: '', period: 'monthly', startDate: '', endDate: '' });
    addToast('Budget added', 'success');
  };

  const startEdit = (b) => {
    setEditingId(b.id);
    setEditForm({ ...b });
  };

  const saveEdit = () => {
    const previousState = [...store.budgets];
    const updated = store.budgets.map(b => b.id === editingId ? { ...editForm, limit: parseFloat(editForm.limit) || 0 } : b);
    updateStore('budgets', updated);
    setEditingId(null);
    addToast('Budget updated', 'success', {
      label: 'Undo',
      onClick: () => updateStore('budgets', previousState)
    });
  };

  const deleteBudget = (id) => {
    if (!window.confirm('Are you sure you want to delete this budget?')) return;
    const previousState = [...store.budgets];
    updateStore('budgets', store.budgets.filter(b => b.id !== id));
    addToast('Budget deleted', 'info', {
      label: 'Undo',
      onClick: () => updateStore('budgets', previousState)
    });
  };

  const suggestBudgets = () => {
    const stats = getBaselineStats(store);
    const existingCategories = new Set(store.budgets.map(b => b.category));
    
    const suggestions = Object.entries(stats.categoryAverages)
      .filter(([cat, avg]) => avg > 0 && cat !== 'Uncategorized' && !existingCategories.has(cat))
      .map(([cat, avg]) => ({
        id: 'b_sug_' + Date.now() + Math.random(),
        category: cat,
        limit: Math.ceil(avg / 100) * 100,
        period: 'monthly'
      }));

    if (suggestions.length === 0) {
      addToast('No new categories to suggest based on history.', 'info');
      return;
    }

    updateStore('budgets', [...store.budgets, ...suggestions]);
    addToast(`Added ${suggestions.length} suggested budgets`, 'success');
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <PieChart className="w-6 h-6 text-blue-600" />
            Budgets
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Track your spending limits across different periods.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={suggestBudgets}
            className="flex items-center gap-2 px-4 py-2 bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-400 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <Wand2 className="w-4 h-4" />
            <span className="hidden sm:inline">Suggest from History</span>
            <span className="sm:hidden">Suggest</span>
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
          >
            <Plus className="w-4 h-4" />
            Add Budget
          </button>
        </div>
      </div>

      {budgetsWithProgress.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-500 dark:text-gray-400 p-12">
          <PieChart className="w-16 h-16 mb-4 opacity-20" />
          <p className="text-lg font-medium">No budgets set.</p>
          <p className="text-sm mt-2">Create a budget or use the suggest button to auto-fill based on past spending.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {budgetsWithProgress.map(budget => {
            const isOver = budget.spent > budget.limit;
            const isWarning = budget.progress >= 80 && !isOver;
            const isEditing = editingId === budget.id;
            
            return (
              <div key={budget.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5 rounded-xl shadow-sm flex flex-col group relative">
                {isEditing ? (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <h3 className="font-bold text-gray-900 dark:text-white">{budget.category}</h3>
                      <div className="flex gap-1">
                        <button onClick={saveEdit} className="p-1 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded focus:outline-none focus:ring-2 focus:ring-green-500"><Check className="w-4 h-4" /></button>
                        <button onClick={() => setEditingId(null)} className="p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-gray-500"><X className="w-4 h-4" /></button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Limit</label>
                      <input type="number" value={editForm.limit} onChange={e => setEditForm({...editForm, limit: e.target.value})} className="w-full p-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Period</label>
                      <select value={editForm.period} onChange={e => setEditForm({...editForm, period: e.target.value})} className="w-full p-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-sm outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                        <option value="yearly">Yearly</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>
                    {editForm.period === 'custom' && (
                      <div className="grid grid-cols-2 gap-2">
                        <input type="date" value={editForm.startDate || ''} onChange={e => setEditForm({...editForm, startDate: e.target.value})} className="w-full p-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-xs outline-none" />
                        <input type="date" value={editForm.endDate || ''} onChange={e => setEditForm({...editForm, endDate: e.target.value})} className="w-full p-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-xs outline-none" />
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-bold text-gray-900 dark:text-white">{budget.category}</h3>
                        <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">{budget.period}</span>
                      </div>
                      <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button onClick={() => startEdit(budget)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => deleteBudget(budget.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-end mb-2">
                      <div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(budget.spent)}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">spent of {formatCurrency(budget.limit)}</p>
                      </div>
                      <span className={`text-sm font-bold ${isOver ? 'text-red-600 dark:text-red-400' : isWarning ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
                        {Math.round(budget.progress)}%
                      </span>
                    </div>

                    <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3 overflow-hidden mt-auto">
                      <div 
                        className={`h-3 rounded-full transition-all duration-500 ${isOver ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-green-500'}`}
                        style={{ width: `${budget.progress}%` }}
                      ></div>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Budget Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-sm w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Add Budget</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleAddBudget} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                <select value={newBudget.category} onChange={e => setNewBudget({...newBudget, category: e.target.value})} className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Limit</label>
                <input required type="number" value={newBudget.limit} onChange={e => setNewBudget({...newBudget, limit: e.target.value})} className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0.00" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Period</label>
                <select value={newBudget.period} onChange={e => setNewBudget({...newBudget, period: e.target.value})} className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              {newBudget.period === 'custom' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
                    <input required type="date" value={newBudget.startDate} onChange={e => setNewBudget({...newBudget, startDate: e.target.value})} className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
                    <input required type="date" value={newBudget.endDate} onChange={e => setNewBudget({...newBudget, endDate: e.target.value})} className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                </div>
              )}
              
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800">
                  Save Budget
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}