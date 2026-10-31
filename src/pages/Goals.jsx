import React, { useState, useMemo } from 'react';
import { Target, Plus, X, Calendar, TrendingUp, AlertCircle, CheckCircle2, Trash2, Edit2, Check, PlusCircle } from 'lucide-react';
import { useStore } from '../store/StoreContext';
import { getBaselineStats, calculateGoalProjections } from '../utils/financeMath';

const TEMPLATES = [
  { id: 'emergency', name: 'Emergency Fund', icon: '🛡️' },
  { id: 'trip', name: 'Vacation / Trip', icon: '✈️' },
  { id: 'vehicle', name: 'New Vehicle', icon: '🚗' },
  { id: 'house', name: 'House Downpayment', icon: '🏠' },
  { id: 'custom', name: 'Custom Goal', icon: '🎯' }
];

export default function Goals() {
  const { store, updateStore, updateProfile, addToast } = useStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0]);
  
  const [newGoal, setNewGoal] = useState({
    name: 'Emergency Fund',
    targetAmount: '',
    currentAmount: '',
    deadline: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
    priority: (store.goals || []).length + 1
  });

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [contribId, setContribId] = useState(null);
  const [contribAmount, setContribAmount] = useState('');

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: store.settings.currency, maximumFractionDigits: 0 }).format(amount || 0);
  };

  const { surplus, totalExpenses } = useMemo(() => getBaselineStats(store), [store.transactions, store.profile]);
  const projectedGoals = useMemo(() => calculateGoalProjections(store, surplus), [store, surplus]);

  const handleTemplateSelect = (t) => {
    setSelectedTemplate(t);
    setNewGoal({ ...newGoal, name: t.name === 'Custom Goal' ? '' : t.name });
  };

  const reorderPriorities = (goals, newGoalPriority, excludeId = null) => {
    let sorted = [...goals].filter(g => g.id !== excludeId).sort((a, b) => a.priority - b.priority);
    let currentPrio = 1;
    sorted.forEach(g => {
      if (currentPrio === parseInt(newGoalPriority)) currentPrio++;
      g.priority = currentPrio;
      currentPrio++;
    });
    return sorted;
  };

  const handleAddGoal = (e) => {
    e.preventDefault();
    if (newGoal.name === 'Emergency Fund' && store.goals.some(g => g.name === 'Emergency Fund')) {
      addToast('Emergency Fund goal already exists.', 'error');
      return;
    }

    const goal = {
      id: 'g_' + Date.now(),
      name: newGoal.name,
      targetAmount: parseFloat(newGoal.targetAmount) || 0,
      currentAmount: parseFloat(newGoal.currentAmount) || 0,
      deadline: newGoal.deadline,
      priority: parseInt(newGoal.priority) || store.goals.length + 1
    };
    
    let updatedGoals = reorderPriorities(store.goals, goal.priority);
    updatedGoals.push(goal);
    
    if (goal.name === 'Emergency Fund') {
      updateProfile({ emergencyFund: goal.currentAmount, emergencyFundTargetMonths: Math.max(1, Math.round(goal.targetAmount / (totalExpenses || 1))) });
    }

    updateStore('goals', updatedGoals);
    setIsModalOpen(false);
    setNewGoal({ ...newGoal, name: '', targetAmount: '', currentAmount: '', priority: updatedGoals.length + 1 });
    addToast('Goal added successfully', 'success');
  };

  const startEdit = (g) => {
    setEditingId(g.id);
    setEditForm({ ...g });
  };

  const saveEdit = () => {
    const previousState = [...store.goals];
    const previousProfile = { ...store.profile };
    
    let updatedGoals = reorderPriorities(store.goals, editForm.priority, editingId);
    const updatedGoal = { 
      ...editForm, 
      targetAmount: parseFloat(editForm.targetAmount) || 0,
      currentAmount: parseFloat(editForm.currentAmount) || 0,
      priority: parseInt(editForm.priority) || 1
    };
    updatedGoals.push(updatedGoal);

    if (updatedGoal.name === 'Emergency Fund') {
      updateProfile({ 
        emergencyFund: updatedGoal.currentAmount, 
        emergencyFundTargetMonths: Math.max(1, Math.round(updatedGoal.targetAmount / (totalExpenses || 1))) 
      });
    }

    updateStore('goals', updatedGoals);
    setEditingId(null);
    addToast('Goal updated', 'success', {
      label: 'Undo',
      onClick: () => {
        updateStore('goals', previousState);
        updateProfile(previousProfile);
      }
    });
  };

  const deleteGoal = (id) => {
    if (!window.confirm('Are you sure you want to delete this goal?')) return;
    const previousState = [...store.goals];
    updateStore('goals', store.goals.filter(g => g.id !== id));
    addToast('Goal deleted', 'info', {
      label: 'Undo',
      onClick: () => updateStore('goals', previousState)
    });
  };

  const addContribution = (e, id) => {
    e.preventDefault();
    const amount = parseFloat(contribAmount);
    if (!amount || amount <= 0) return;

    const goal = store.goals.find(g => g.id === id);
    if (!goal) return;

    const newAmount = (goal.name === 'Emergency Fund' ? store.profile.emergencyFund : goal.currentAmount) + amount;
    
    if (goal.name === 'Emergency Fund') {
      updateProfile({ emergencyFund: newAmount });
    }
    
    const updated = store.goals.map(g => g.id === id ? { ...g, currentAmount: newAmount } : g);
    updateStore('goals', updated);
    setContribId(null);
    setContribAmount('');
    addToast(`Added ${formatCurrency(amount)} to ${goal.name}`, 'success');
  };

  const markComplete = (id) => {
    const goal = store.goals.find(g => g.id === id);
    if (!goal) return;
    
    const target = goal.name === 'Emergency Fund' ? (store.profile.emergencyFundTargetMonths * totalExpenses) : goal.targetAmount;
    
    if (goal.name === 'Emergency Fund') {
      updateProfile({ emergencyFund: target });
    }
    
    const updated = store.goals.map(g => g.id === id ? { ...g, currentAmount: target } : g);
    updateStore('goals', updated);
    addToast(`${goal.name} marked as complete!`, 'success');
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Target className="w-6 h-6 text-blue-600" />
            Financial Goals
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Monthly Surplus Available: <span className="font-bold text-green-600 dark:text-green-400">{formatCurrency(surplus)}</span>
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
        >
          <Plus className="w-4 h-4" />
          Add Goal
        </button>
      </div>

      {projectedGoals.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-500 dark:text-gray-400 p-12">
          <Target className="w-16 h-16 mb-4 opacity-20" />
          <p className="text-lg font-medium">No goals set yet.</p>
          <p className="text-sm mt-2">Create a goal to start allocating your monthly surplus.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {projectedGoals.map(goal => {
            const progress = Math.min(100, (goal.currentAmount / (goal.targetAmount || 1)) * 100);
            const isEditing = editingId === goal.id;
            const isContributing = contribId === goal.id;
            const isPastDeadline = new Date(goal.deadline) < new Date() && goal.status !== 'Completed';
            
            return (
              <div key={goal.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm flex flex-col group relative">
                {isEditing ? (
                  <div className="p-5 space-y-3 flex-1">
                    <div className="flex justify-between items-center">
                      <h3 className="font-bold text-gray-900 dark:text-white">Edit Goal</h3>
                      <div className="flex gap-1">
                        <button onClick={saveEdit} className="p-1 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded focus:outline-none focus:ring-2 focus:ring-green-500"><Check className="w-4 h-4" /></button>
                        <button onClick={() => setEditingId(null)} className="p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-gray-500"><X className="w-4 h-4" /></button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Name</label>
                      <input type="text" disabled={goal.name === 'Emergency Fund'} value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full p-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Target</label>
                        <input type="number" value={editForm.targetAmount} onChange={e => setEditForm({...editForm, targetAmount: e.target.value})} className="w-full p-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Saved</label>
                        <input type="number" value={editForm.currentAmount} onChange={e => setEditForm({...editForm, currentAmount: e.target.value})} className="w-full p-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Deadline</label>
                        <input type="date" value={editForm.deadline} onChange={e => setEditForm({...editForm, deadline: e.target.value})} className="w-full p-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Priority</label>
                        <input type="number" min="1" value={editForm.priority} onChange={e => setEditForm({...editForm, priority: e.target.value})} className="w-full p-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-bold rounded">
                            Priority {goal.priority}
                          </span>
                          <h3 className="text-lg font-bold text-gray-900 dark:text-white">{goal.name}</h3>
                        </div>
                        <p className={`text-sm flex items-center gap-1 ${isPastDeadline ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'}`}>
                          <Calendar className="w-4 h-4" /> Target: {goal.deadline} {isPastDeadline && '(Past Due)'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button onClick={() => startEdit(goal)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => deleteGoal(goal.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                    
                    <div className="p-5 space-y-4 flex-1">
                      <div className="flex justify-between text-sm font-medium">
                        <span className="text-gray-900 dark:text-white">{formatCurrency(goal.currentAmount)} saved</span>
                        <span className="text-gray-500 dark:text-gray-400">of {formatCurrency(goal.targetAmount)}</span>
                      </div>
                      
                      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                        <div 
                          className={`h-3 rounded-full transition-all duration-500 ${progress >= 100 ? 'bg-green-500' : 'bg-blue-600'}`}
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>

                      {isContributing ? (
                        <form onSubmit={(e) => addContribution(e, goal.id)} className="flex gap-2 pt-2">
                          <input autoFocus type="number" placeholder="Amount" value={contribAmount} onChange={e => setContribAmount(e.target.value)} className="flex-1 p-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                          <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500">Add</button>
                          <button type="button" onClick={() => setContribId(null)} className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500">Cancel</button>
                        </form>
                      ) : (
                        <div className="grid grid-cols-2 gap-4 pt-2">
                          <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg">
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Required Monthly</p>
                            <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(goal.required)}</p>
                          </div>
                          <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg">
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Allocated Surplus</p>
                            <p className="font-semibold text-blue-600 dark:text-blue-400">{formatCurrency(goal.allocated)}</p>
                          </div>
                        </div>
                      )}
                      
                      {!isContributing && progress < 100 && (
                        <div className="flex gap-2 pt-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setContribId(goal.id)} className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 focus:outline-none focus:underline">
                            <PlusCircle className="w-3 h-3" /> Add Funds
                          </button>
                          <span className="text-gray-300 dark:text-gray-700">|</span>
                          <button onClick={() => markComplete(goal.id)} className="flex items-center gap-1 text-xs font-medium text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 focus:outline-none focus:underline">
                            <CheckCircle2 className="w-3 h-3" /> Mark Complete
                          </button>
                        </div>
                      )}
                    </div>

                    <div className={`p-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between ${
                      goal.status === 'Completed' ? 'bg-green-50 dark:bg-green-900/10' :
                      goal.status === 'On Track' ? 'bg-blue-50 dark:bg-blue-900/10' : 'bg-red-50 dark:bg-red-900/10'
                    }`}>
                      <div className="flex items-center gap-2">
                        {goal.status === 'Completed' ? <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" /> :
                         goal.status === 'On Track' ? <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" /> :
                         <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />}
                        <span className={`text-sm font-medium ${
                          goal.status === 'Completed' ? 'text-green-700 dark:text-green-400' :
                          goal.status === 'On Track' ? 'text-blue-700 dark:text-blue-400' : 'text-red-700 dark:text-red-400'
                        }`}>
                          {goal.status}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Projected: {goal.projectedDate}
                      </span>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Goal Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Create New Goal</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Template</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {TEMPLATES.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleTemplateSelect(t)}
                      className={`p-3 rounded-lg border text-sm font-medium flex flex-col items-center gap-2 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        selectedTemplate.id === t.id 
                          ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-400' 
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700'
                      }`}
                    >
                      <span className="text-2xl">{t.icon}</span>
                      <span className="text-center">{t.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <form id="goalForm" onSubmit={handleAddGoal} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Goal Name</label>
                  <input required type="text" disabled={newGoal.name === 'Emergency Fund'} value={newGoal.name} onChange={e => setNewGoal({...newGoal, name: e.target.value})} className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Amount</label>
                    <input required type="number" value={newGoal.targetAmount} onChange={e => setNewGoal({...newGoal, targetAmount: e.target.value})} className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Already Saved</label>
                    <input type="number" value={newGoal.currentAmount} onChange={e => setNewGoal({...newGoal, currentAmount: e.target.value})} className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0.00" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Deadline</label>
                    <input required type="date" value={newGoal.deadline} onChange={e => setNewGoal({...newGoal, deadline: e.target.value})} className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority (1 = Highest)</label>
                    <input required type="number" min="1" value={newGoal.priority} onChange={e => setNewGoal({...newGoal, priority: e.target.value})} className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                </div>
              </form>
            </div>
            
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3 bg-gray-50 dark:bg-gray-900/50 rounded-b-xl">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500">
                Cancel
              </button>
              <button type="submit" form="goalForm" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800">
                Save Goal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}