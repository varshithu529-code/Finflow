import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Repeat, Plus, Check, X, AlertTriangle, TrendingUp, 
  BrainCircuit, Calendar, Loader2, Trash2, Power, Edit2, Paperclip
} from 'lucide-react';
import { useStore } from '../store/StoreContext';
import { getMonthlyEquivalent, calculateNextBillingDate } from '../utils/financeMath';

export default function Subscriptions() {
  const { store, updateStore, addToast } = useStore();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [aiReviewingId, setAiReviewingId] = useState(null);
  const [aiResult, setAiResult] = useState(null);
  
  const [newSub, setNewSub] = useState({
    merchant: '', amount: '', frequency: 'monthly', customInterval: 30, nextDate: new Date().toISOString().split('T')[0]
  });

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const invoiceInputRef = useRef(null);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: store.settings.currency }).format(amount || 0);
  };

  useEffect(() => {
    const detectSubscriptions = () => {
      const grouped = {};
      (store.transactions || []).forEach(t => {
        if (t.type === 'expense' && t.merchant && t.merchant !== 'Unknown') {
          if (!grouped[t.merchant]) grouped[t.merchant] = [];
          grouped[t.merchant].push(t);
        }
      });

      const newSubs = [];
      const today = new Date().toISOString().split('T')[0];
      const keywords = ['annual', 'yearly', 'yr', 'quarterly', 'half yearly', 'renewal', 'plan', 'subscription'];

      Object.entries(grouped).forEach(([merchant, txns]) => {
        if (store.subscriptions.some(s => (s.merchant || '').toLowerCase() === merchant.toLowerCase())) return;

        txns.sort((a, b) => new Date(a.date) - new Date(b.date));
        const latestTxn = txns[txns.length - 1];
        const desc = (latestTxn.description || '').toLowerCase();
        
        let frequency = null;
        let nextDate = new Date(latestTxn.date);

        if (txns.length >= 2) {
          let hasSameAmount = false;
          const intervals = [];
          for (let i = 1; i < txns.length; i++) {
            if (txns[i].amount === txns[i-1].amount) hasSameAmount = true;
            const days = Math.round((new Date(txns[i].date) - new Date(txns[i-1].date)) / 86400000);
            intervals.push(days);
          }

          if (hasSameAmount) {
            const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            if (avgInterval >= 6 && avgInterval <= 8) frequency = 'weekly';
            else if (avgInterval >= 25 && avgInterval <= 35) frequency = 'monthly';
            else if (avgInterval >= 85 && avgInterval <= 95) frequency = 'quarterly';
            else if (avgInterval >= 175 && avgInterval <= 190) frequency = 'half-yearly';
            else if (avgInterval >= 350 && avgInterval <= 380) frequency = 'yearly';
          }
        }

        if (!frequency) {
          if (desc.includes('annual') || desc.includes('yearly') || desc.includes(' yr')) frequency = 'yearly';
          else if (desc.includes('quarterly')) frequency = 'quarterly';
          else if (desc.includes('half yearly')) frequency = 'half-yearly';
          else if (keywords.some(k => desc.includes(k))) frequency = 'monthly'; // Fallback assumed
        }

        if (frequency) {
          const prevTxn = txns.length > 1 ? txns[txns.length - 2] : null;
          newSubs.push({
            id: 'sub_' + Date.now() + Math.random().toString(36).substr(2, 9),
            merchant,
            amount: latestTxn.amount,
            frequency,
            customInterval: 30,
            status: 'pending',
            nextDate: calculateNextBillingDate(latestTxn.date, frequency),
            hasPriceIncrease: prevTxn ? latestTxn.amount > prevTxn.amount : false,
            lastUsedDate: today,
            isStillUsing: true,
            assumed: txns.length < 2 && frequency === 'monthly'
          });
        }
      });

      if (newSubs.length > 0) {
        updateStore('subscriptions', [...store.subscriptions, ...newSubs]);
        addToast(`Detected ${newSubs.length} potential subscriptions`, 'info');
      }
    };

    detectSubscriptions();
  }, [store.transactions]);

  const activeSubs = (store.subscriptions || []).filter(s => s.status === 'active');
  const pendingSubs = (store.subscriptions || []).filter(s => s.status === 'pending');

  const totals = useMemo(() => {
    let monthly = 0;
    let yearly = 0;
    activeSubs.forEach(sub => {
      const mEq = getMonthlyEquivalent(sub.amount, sub.frequency, sub.customInterval);
      monthly += mEq;
      yearly += mEq * 12;
    });
    return { monthly, yearly };
  }, [activeSubs]);

  const updateSubStatus = (id, status) => {
    const updated = store.subscriptions.map(s => s.id === id ? { ...s, status, assumed: false } : s);
    updateStore('subscriptions', updated);
    if (status === 'active') addToast('Subscription confirmed', 'success');
    if (status === 'dismissed') addToast('Subscription dismissed', 'info');
  };

  const deleteSub = (id) => {
    if (!window.confirm('Are you sure you want to delete this subscription?')) return;
    const previousState = [...store.subscriptions];
    updateStore('subscriptions', store.subscriptions.filter(s => s.id !== id));
    addToast('Subscription removed', 'info', {
      label: 'Undo',
      onClick: () => updateStore('subscriptions', previousState)
    });
  };

  const toggleStillUsing = (id) => {
    const updated = store.subscriptions.map(s => s.id === id ? { ...s, isStillUsing: !s.isStillUsing } : s);
    updateStore('subscriptions', updated);
  };

  const updateLastUsed = (id, date) => {
    const updated = store.subscriptions.map(s => s.id === id ? { ...s, lastUsedDate: date } : s);
    updateStore('subscriptions', updated);
  };

  const handleManualAdd = (e) => {
    e.preventDefault();
    const sub = {
      id: 'sub_manual_' + Date.now(),
      merchant: newSub.merchant,
      amount: parseFloat(newSub.amount) || 0,
      frequency: newSub.frequency,
      customInterval: parseInt(newSub.customInterval) || 30,
      status: 'active',
      nextDate: newSub.nextDate,
      hasPriceIncrease: false,
      lastUsedDate: new Date().toISOString().split('T')[0],
      isStillUsing: true
    };
    updateStore('subscriptions', [...store.subscriptions, sub]);
    setIsAddModalOpen(false);
    setNewSub({ merchant: '', amount: '', frequency: 'monthly', customInterval: 30, nextDate: new Date().toISOString().split('T')[0] });
    addToast('Subscription added manually', 'success');
  };

  const startEdit = (s) => {
    setEditingId(s.id);
    setEditForm({ ...s });
  };

  const saveEdit = () => {
    const previousState = [...store.subscriptions];
    const updated = store.subscriptions.map(s => s.id === editingId ? { 
      ...editForm, 
      amount: parseFloat(editForm.amount) || 0,
      customInterval: parseInt(editForm.customInterval) || 30,
      assumed: false
    } : s);
    updateStore('subscriptions', updated);
    setEditingId(null);
    addToast('Subscription updated', 'success', {
      label: 'Undo',
      onClick: () => updateStore('subscriptions', previousState)
    });
  };

  const handleAiReview = async (sub) => {
    if (!store.settings.geminiApiKey) {
      addToast('Gemini API key is missing. Please add it in the Profile tab.', 'error');
      return;
    }

    setAiReviewingId(sub.id);
    try {
      const prompt = `Analyze this recurring charge:
Merchant: ${sub.merchant}
Amount: ${sub.amount}
Frequency: ${sub.frequency}

Is this a true subscription/membership (like Netflix, Gym, SaaS, Rent) or just a frequent purchase (like groceries, Uber, Swiggy)?
Return ONLY valid JSON: { "isSubscription": boolean, "reason": "short 1-sentence explanation" }`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${store.settings.geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, response_mime_type: "application/json" }
        })
      });

      if (!response.ok) throw new Error('Failed to get AI review');
      
      const data = await response.json();
      const textResponse = data.candidates[0].content.parts[0].text;
      const result = JSON.parse(textResponse.replace(/```json/g, '').replace(/```/g, '').trim());
      
      setAiResult({ id: sub.id, ...result });
    } catch (error) {
      addToast('AI Review failed', 'error');
    } finally {
      setAiReviewingId(null);
    }
  };

  const handleInvoiceUpload = async (e, subId) => {
    const file = e.target.files[0];
    if (!file || !store.settings.geminiApiKey) return;
    
    setAiReviewingId(subId);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64String = event.target.result.split(',')[1];
        const prompt = `Read this invoice/receipt. What is the billing period or frequency?
        Return ONLY valid JSON: { "frequency": "weekly" | "monthly" | "quarterly" | "half-yearly" | "yearly" | "custom", "customIntervalDays": number (if custom, else 30) }`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${store.settings.geminiApiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: file.type, data: base64String } }] }],
            generationConfig: { temperature: 0.1, response_mime_type: "application/json" }
          })
        });

        if (!response.ok) throw new Error('API Error');
        const data = await response.json();
        const textResponse = data.candidates[0].content.parts[0].text;
        const result = JSON.parse(textResponse.replace(/```json/g, '').replace(/```/g, '').trim());
        
        const updated = store.subscriptions.map(s => s.id === subId ? { 
          ...s, 
          frequency: result.frequency, 
          customInterval: result.customIntervalDays || 30,
          assumed: false 
        } : s);
        updateStore('subscriptions', updated);
        addToast('Frequency updated from invoice', 'success');
        setAiReviewingId(null);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      addToast('Failed to read invoice', 'error');
      setAiReviewingId(null);
    }
    e.target.value = null;
  };

  const getYearlySavings = (sub) => getMonthlyEquivalent(sub.amount, sub.frequency, sub.customInterval) * 12;

  const isUnused = (sub) => {
    if (!sub.isStillUsing) return true;
    const daysSince = Math.round((new Date() - new Date(sub.lastUsedDate)) / 86400000);
    return daysSince > 30;
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Repeat className="w-6 h-6 text-blue-600" />
            Subscriptions
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage your recurring payments and memberships.</p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
        >
          <Plus className="w-4 h-4" />
          Add Manual
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Monthly Commitment</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{formatCurrency(totals.monthly)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Yearly Projection</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{formatCurrency(totals.yearly)}</p>
        </div>
      </div>

      {pendingSubs.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Detected Subscriptions ({pendingSubs.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingSubs.map(sub => (
              <div key={sub.id} className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 p-5 rounded-xl flex flex-col justify-between relative group">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-gray-900 dark:text-white">{sub.merchant}</h4>
                    <div className="flex items-center gap-2">
                      {sub.assumed && (
                        <button onClick={() => startEdit(sub)} className="text-[10px] bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 px-1.5 py-0.5 rounded hover:bg-amber-300 transition-colors">
                          Assumed {sub.frequency}
                        </button>
                      )}
                      <span className="px-2.5 py-1 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-400 text-xs font-medium rounded-full capitalize">
                        {sub.frequency === 'custom' ? `Every ${sub.customInterval} days` : sub.frequency}
                      </span>
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{formatCurrency(sub.amount)}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <Calendar className="w-4 h-4" /> Next: {sub.nextDate}
                  </p>
                  
                  {sub.hasPriceIncrease && (
                    <div className="mt-3 flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-md w-fit">
                      <TrendingUp className="w-3 h-3" /> Price increased recently
                    </div>
                  )}

                  {aiResult?.id === sub.id && (
                    <div className={`mt-3 p-3 rounded-lg text-sm ${aiResult.isSubscription ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}>
                      <strong>AI Review:</strong> {aiResult.reason}
                    </div>
                  )}
                </div>
                
                <div className="mt-5 flex items-center gap-2">
                  <button onClick={() => updateSubStatus(sub.id, 'active')} className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors flex justify-center items-center gap-1 focus:outline-none focus:ring-2 focus:ring-green-500">
                    <Check className="w-4 h-4" /> Confirm
                  </button>
                  <button onClick={() => updateSubStatus(sub.id, 'dismissed')} className="flex-1 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 text-sm font-medium rounded-lg transition-colors flex justify-center items-center gap-1 focus:outline-none focus:ring-2 focus:ring-gray-500">
                    <X className="w-4 h-4" /> Dismiss
                  </button>
                  <button 
                    onClick={() => handleAiReview(sub)}
                    disabled={aiReviewingId === sub.id}
                    className="p-2 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-lg transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    title="Ask AI if this is a real subscription"
                  >
                    {aiReviewingId === sub.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <BrainCircuit className="w-5 h-5" />}
                  </button>
                </div>
                
                <div className="absolute top-2 right-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex gap-1">
                  <button onClick={() => startEdit(sub)} className="p-1.5 bg-white dark:bg-gray-800 text-gray-500 hover:text-blue-600 rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"><Edit2 className="w-3 h-3" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4 flex-1">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Active Subscriptions</h3>
        
        {activeSubs.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-500 dark:text-gray-400">
            <Repeat className="w-12 h-12 mb-4 opacity-20" />
            <p>No active subscriptions.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {activeSubs.map(sub => {
              const unused = isUnused(sub);
              const savings = getYearlySavings(sub);
              const isEditing = editingId === sub.id;

              return (
                <div key={sub.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5 rounded-xl flex flex-col sm:flex-row gap-4 justify-between group relative">
                  {isEditing ? (
                    <div className="flex-1 space-y-3">
                      <div className="flex justify-between items-center">
                        <h3 className="font-bold text-gray-900 dark:text-white">Edit Subscription</h3>
                        <div className="flex gap-1">
                          <button onClick={saveEdit} className="p-1 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded focus:outline-none focus:ring-2 focus:ring-green-500"><Check className="w-4 h-4" /></button>
                          <button onClick={() => setEditingId(null)} className="p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-gray-500"><X className="w-4 h-4" /></button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Amount</label>
                          <input type="number" value={editForm.amount} onChange={e => setEditForm({...editForm, amount: e.target.value})} className="w-full p-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Next Date</label>
                          <input type="date" value={editForm.nextDate} onChange={e => setEditForm({...editForm, nextDate: e.target.value})} className="w-full p-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Frequency</label>
                          <select value={editForm.frequency} onChange={e => setEditForm({...editForm, frequency: e.target.value})} className="w-full p-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-sm outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                            <option value="quarterly">Quarterly</option>
                            <option value="half-yearly">Half-Yearly</option>
                            <option value="yearly">Yearly</option>
                            <option value="custom">Custom</option>
                          </select>
                        </div>
                        {editForm.frequency === 'custom' && (
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Every N Days</label>
                            <input type="number" value={editForm.customInterval} onChange={e => setEditForm({...editForm, customInterval: e.target.value})} className="w-full p-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <h4 className="font-bold text-lg text-gray-900 dark:text-white">{sub.merchant}</h4>
                          <span className="px-2.5 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium rounded-full capitalize">
                            {sub.frequency === 'custom' ? `Every ${sub.customInterval} days` : sub.frequency}
                          </span>
                          {sub.hasPriceIncrease && (
                            <span className="flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-md">
                              <TrendingUp className="w-3 h-3" /> Price Up
                            </span>
                          )}
                        </div>
                        <p className="text-xl font-bold text-gray-900 dark:text-white mb-3">{formatCurrency(sub.amount)}</p>
                        
                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" /> Next: {sub.nextDate}
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={sub.isStillUsing} 
                                onChange={() => toggleStillUsing(sub.id)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              Still Using?
                            </label>
                          </div>
                          <div className="flex items-center gap-2">
                            <span>Last used:</span>
                            <input 
                              type="date" 
                              value={sub.lastUsedDate}
                              onChange={(e) => updateLastUsed(sub.id, e.target.value)}
                              className="p-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-xs outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>

                        {unused && (
                          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-lg flex items-start gap-2 text-sm text-red-800 dark:text-red-300">
                            <Power className="w-5 h-5 shrink-0 mt-0.5" />
                            <div>
                              <strong>Unused Subscription Detected!</strong>
                              <p>You haven't used this recently. Cancel it to save <span className="font-bold">{formatCurrency(savings)}</span> per year.</p>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex sm:flex-col justify-end gap-2 border-t sm:border-t-0 sm:border-l border-gray-100 dark:border-gray-700 pt-4 sm:pt-0 sm:pl-4 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button onClick={() => startEdit(sub)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500">
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <div className="relative">
                          <input type="file" accept=".pdf,image/*" onChange={(e) => handleInvoiceUpload(e, sub.id)} className="hidden" id={`invoice-${sub.id}`} />
                          <label htmlFor={`invoice-${sub.id}`} className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-lg transition-colors cursor-pointer flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-purple-500" title="Attach Invoice to detect frequency">
                            {aiReviewingId === sub.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
                          </label>
                        </div>
                        <button onClick={() => deleteSub(sub.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Add Subscription</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleManualAdd} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Merchant / Service</label>
                <input required type="text" value={newSub.merchant} onChange={e => setNewSub({...newSub, merchant: e.target.value})} className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="e.g. Netflix" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount</label>
                <input required type="number" step="0.01" value={newSub.amount} onChange={e => setNewSub({...newSub, amount: e.target.value})} className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0.00" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Frequency</label>
                  <select value={newSub.frequency} onChange={e => setNewSub({...newSub, frequency: e.target.value})} className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="half-yearly">Half-Yearly</option>
                    <option value="yearly">Yearly</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                {newSub.frequency === 'custom' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Every N Days</label>
                    <input required type="number" value={newSub.customInterval} onChange={e => setNewSub({...newSub, customInterval: e.target.value})} className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Next Billing Date</label>
                <input required type="date" value={newSub.nextDate} onChange={e => setNewSub({...newSub, nextDate: e.target.value})} className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800">
                  Add Subscription
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
