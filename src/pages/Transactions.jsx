// src/pages/Transactions.jsx
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Search, Filter, Upload, Trash2, Edit2, Check, X, 
  ChevronDown, AlertCircle, FileSpreadsheet, MessageSquare, 
  FileText, Loader2, FileImage, Sparkles, CheckCircle2
} from 'lucide-react';
import { useStore } from '../store/StoreContext';

const CATEGORIES = [
  'Salary', 'Housing', 'Utilities', 'Food & Dining', 
  'Transport', 'Entertainment', 'Health', 'Groceries', 
  'Shopping', 'Investment', 'Other', 'Uncategorized'
];

const KEYWORD_RULES = {
  'swiggy': 'Food & Dining',
  'zomato': 'Food & Dining',
  'uber': 'Transport',
  'ola': 'Transport',
  'netflix': 'Entertainment',
  'spotify': 'Entertainment',
  'amazon': 'Shopping',
  'flipkart': 'Shopping',
  'bescom': 'Utilities',
  'airtel': 'Utilities',
  'jio': 'Utilities',
  'salary': 'Salary',
  'rent': 'Housing',
  'cult fit': 'Health',
  'blinkit': 'Groceries',
  'zepto': 'Groceries',
  'instamart': 'Groceries'
};

const DEMO_SMS = `Sent Rs. 450.00 from A/c ...1234 to Swiggy on 31-10-26. UPI Ref 1234567890.
Rs. 1,00,000.00 credited to a/c XXXXXX5678 on 01-11-2026 by Tech Corp Salary. Avail Bal Rs 1,50,000.00.
Txn of INR 1,500.00 done on Credit Card XX9999 at CULT FIT on 25-10-26.
Rs. 1450.00 debited from A/c ...1234 on 28-10-26 for BESCOM bill payment.`;

export default function Transactions() {
  const { store, updateStore, addToast } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ type: 'all', category: 'all', dateFrom: '', dateTo: '' });
  
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  
  const [csvPreview, setCsvPreview] = useState(null);
  const [showImportMenu, setShowImportMenu] = useState(false);
  
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);
  const [smsText, setSmsText] = useState('');
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  
  const [aiSuggestions, setAiSuggestions] = useState({});
  const [showReviewPanel, setShowReviewPanel] = useState(false);
  const [isCategorizing, setIsCategorizing] = useState(false);
  
  const fileInputRef = useRef(null);
  const aiFileInputRef = useRef(null);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: store.settings.currency }).format(amount || 0);
  };

  const filteredTransactions = useMemo(() => {
    return (store.transactions || []).filter(t => {
      const matchesSearch = (t.description || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                            (t.category || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filters.type === 'all' || t.type === filters.type;
      const matchesCategory = filters.category === 'all' || t.category === filters.category;
      const matchesDateFrom = !filters.dateFrom || t.date >= filters.dateFrom;
      const matchesDateTo = !filters.dateTo || t.date <= filters.dateTo;
      
      return matchesSearch && matchesType && matchesCategory && matchesDateFrom && matchesDateTo;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [store.transactions, searchTerm, filters]);

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredTransactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTransactions.map(t => t.id)));
    }
  };

  const toggleSelect = (id) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const deleteSelected = () => {
    const previousState = [...store.transactions];
    const updated = store.transactions.filter(t => !selectedIds.has(t.id));
    updateStore('transactions', updated);
    setSelectedIds(new Set());
    addToast(`Deleted ${selectedIds.size} transactions`, 'info', {
      label: 'Undo',
      onClick: () => updateStore('transactions', previousState)
    });
  };

  const deleteSingle = (id) => {
    const previousState = [...store.transactions];
    const updated = store.transactions.filter(t => t.id !== id);
    updateStore('transactions', updated);
    addToast('Transaction deleted', 'info', {
      label: 'Undo',
      onClick: () => updateStore('transactions', previousState)
    });
  };

  const handleCategoryChange = (transactionIds, newCategory) => {
    const previousTransactions = [...store.transactions];
    const previousRules = [...store.rules];
    
    const targetTxns = store.transactions.filter(t => transactionIds.has(t.id));
    const uniqueMerchants = [...new Set(targetTxns.map(t => t.merchant))];
    
    let updatedTransactions = [...store.transactions];
    let updatedRules = [...store.rules];
    let autoUpdatedCount = 0;

    uniqueMerchants.forEach(merchant => {
      if (!merchant || merchant === 'Unknown') return;
      
      const existingRuleIdx = updatedRules.findIndex(r => r.merchant.toLowerCase() === merchant.toLowerCase());
      if (existingRuleIdx >= 0) {
        updatedRules[existingRuleIdx] = { ...updatedRules[existingRuleIdx], category: newCategory };
      } else {
        updatedRules.push({ id: 'r_' + Date.now() + Math.random(), merchant, category: newCategory });
      }

      updatedTransactions = updatedTransactions.map(t => {
        if (!transactionIds.has(t.id) && t.category !== newCategory && 
           ((t.merchant || '').toLowerCase().includes(merchant.toLowerCase()) || (t.description || '').toLowerCase().includes(merchant.toLowerCase()))) {
          autoUpdatedCount++;
          return { ...t, category: newCategory };
        }
        return t;
      });
    });

    updatedTransactions = updatedTransactions.map(t => 
      transactionIds.has(t.id) ? { ...t, category: newCategory } : t
    );

    updateStore('transactions', updatedTransactions);
    updateStore('rules', updatedRules);
    
    // Clear suggestions for these
    const newSugs = { ...aiSuggestions };
    transactionIds.forEach(id => delete newSugs[id]);
    setAiSuggestions(newSugs);
    
    setSelectedIds(new Set());

    const merchantNames = uniqueMerchants.slice(0, 2).join(', ') + (uniqueMerchants.length > 2 ? '...' : '');
    
    if (autoUpdatedCount > 0) {
      addToast(`Learned: ${merchantNames} goes to ${newCategory}, applied to ${autoUpdatedCount} others`, 'success', {
        label: 'Undo',
        onClick: () => {
          updateStore('transactions', previousTransactions);
          updateStore('rules', previousRules);
        }
      });
    } else {
      addToast(`Updated category to ${newCategory}`, 'success', {
        label: 'Undo',
        onClick: () => {
          updateStore('transactions', previousTransactions);
          updateStore('rules', previousRules);
        }
      });
    }
  };

  const startEdit = (t) => {
    setEditingId(t.id);
    setEditForm({ ...t });
  };

  const saveEdit = () => {
    const previousState = [...store.transactions];
    const previousRules = [...store.rules];
    const original = store.transactions.find(t => t.id === editingId);
    
    let updatedTransactions = store.transactions.map(t => t.id === editingId ? editForm : t);
    let updatedRules = [...store.rules];
    let autoUpdatedCount = 0;

    if (original.category !== editForm.category) {
      const merchant = editForm.merchant;
      if (merchant && merchant !== 'Unknown') {
        const existingRuleIdx = updatedRules.findIndex(r => r.merchant.toLowerCase() === merchant.toLowerCase());
        if (existingRuleIdx >= 0) {
          updatedRules[existingRuleIdx] = { ...updatedRules[existingRuleIdx], category: editForm.category };
        } else {
          updatedRules.push({ id: 'r_' + Date.now() + Math.random(), merchant, category: editForm.category });
        }

        updatedTransactions = updatedTransactions.map(t => {
          if (t.id !== editingId && t.category !== editForm.category && 
             ((t.merchant || '').toLowerCase().includes(merchant.toLowerCase()) || (t.description || '').toLowerCase().includes(merchant.toLowerCase()))) {
            autoUpdatedCount++;
            return { ...t, category: editForm.category };
          }
          return t;
        });
      }
    }

    updateStore('transactions', updatedTransactions);
    updateStore('rules', updatedRules);
    setEditingId(null);

    if (autoUpdatedCount > 0) {
      addToast(`Learned: ${editForm.merchant} goes to ${editForm.category}, applied to ${autoUpdatedCount} others`, 'success', {
        label: 'Undo',
        onClick: () => {
          updateStore('transactions', previousState);
          updateStore('rules', previousRules);
        }
      });
    } else {
      addToast('Transaction updated', 'success', {
        label: 'Undo',
        onClick: () => {
          updateStore('transactions', previousState);
          updateStore('rules', previousRules);
        }
      });
    }
  };

  // --- AI Categorization Engine ---
  const maskSensitiveData = (text) => {
    if (!text) return text;
    let masked = text.replace(/(?:\+91|91)?[-\s]?\d{10}/g, '[PHONE_MASKED]');
    masked = masked.replace(/(?:a\/c|acct|account|no\.?)\s*[:\-]?\s*[X*]*\d{3,}/gi, 'A/c [MASKED]');
    masked = masked.replace(/(?:card|vpa)\s*[:\-]?\s*[X*]*\d{4}/gi, 'Card [MASKED]');
    return masked;
  };

  const fetchGeminiWithTimeout = async (prompt, inlineData = null) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    const parts = [{ text: prompt }];
    if (inlineData) parts.push({ inline_data: inlineData });

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${store.settings.geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { temperature: 0.1, response_mime_type: "application/json" }
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      if (!response.ok) {
        if (response.status === 429) throw new Error('Rate limit exceeded. Try again later.');
        throw new Error('API Error');
      }
      
      const data = await response.json();
      const textResponse = data.candidates[0].content.parts[0].text;
      return JSON.parse(textResponse.replace(/```json/g, '').replace(/```/g, '').trim());
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') throw new Error('Request timed out.');
      throw error;
    }
  };

  const categorizeBatch = async (txnsToCategorize) => {
    if (txnsToCategorize.length === 0) return {};
    
    const prompt = `Categorize these transactions into one of the following categories ONLY: ${CATEGORIES.join(', ')}.
    Return ONLY a valid JSON array of objects with keys: "id", "category", "confidence" (number 0-1), "reason" (short string).
    Transactions: ${JSON.stringify(txnsToCategorize.map(t => ({ id: t.id, description: maskSensitiveData(t.description), amount: t.amount, type: t.type })))}`;
    
    let result = [];
    try {
      result = await fetchGeminiWithTimeout(prompt);
    } catch (e) {
      console.warn("First attempt failed, retrying...", e);
      try {
        result = await fetchGeminiWithTimeout(prompt);
      } catch (retryErr) {
        console.error("Batch categorization failed completely", retryErr);
        throw retryErr;
      }
    }

    if (!Array.isArray(result)) return {};

    const newSuggestions = {};
    const newCache = { ...store.aiCategoryCache };
    
    result.forEach(r => {
      if (CATEGORIES.includes(r.category)) {
        newSuggestions[r.id] = r;
        const txn = txnsToCategorize.find(t => t.id === r.id);
        if (txn && txn.merchant && txn.merchant !== 'Unknown') {
          newCache[txn.merchant] = r.category;
        }
      }
    });

    updateStore('aiCategoryCache', newCache);
    return newSuggestions;
  };

  const handleCategorizeUncategorized = async () => {
    if (!store.settings.geminiApiKey) {
      addToast('Gemini API key is missing. Add it in Profile.', 'error');
      return;
    }
    if (isCategorizing) return;

    setIsCategorizing(true);
    try {
      const uncategorized = store.transactions.filter(t => t.category === 'Uncategorized' && !aiSuggestions[t.id]);
      if (uncategorized.length === 0) {
        addToast('No uncategorized transactions found.', 'info');
        setIsCategorizing(false);
        return;
      }

      // Check cache first
      const needsApi = [];
      const newSugs = { ...aiSuggestions };
      
      uncategorized.forEach(t => {
        if (t.merchant && store.aiCategoryCache[t.merchant]) {
          newSugs[t.id] = { id: t.id, category: store.aiCategoryCache[t.merchant], confidence: 0.9, reason: 'Cached from previous AI run' };
        } else {
          needsApi.push(t);
        }
      });

      // Batch API calls (max 25)
      const batchSize = 25;
      for (let i = 0; i < needsApi.length; i += batchSize) {
        const batch = needsApi.slice(i, i + batchSize);
        const batchResults = await categorizeBatch(batch);
        Object.assign(newSugs, batchResults);
      }

      setAiSuggestions(newSugs);
      if (Object.keys(newSugs).length > 0) setShowReviewPanel(true);
      addToast('Categorization complete. Review suggestions.', 'success');
    } catch (error) {
      addToast(error.message || 'Failed to categorize.', 'error');
    } finally {
      setIsCategorizing(false);
    }
  };

  const acceptSuggestion = (id) => {
    const sug = aiSuggestions[id];
    if (sug) handleCategoryChange(new Set([id]), sug.category);
  };

  const dismissSuggestion = (id) => {
    const newSugs = { ...aiSuggestions };
    delete newSugs[id];
    setAiSuggestions(newSugs);
  };

  const acceptAllSuggestions = (minConfidence = 0.5) => {
    const idsToAccept = Object.entries(aiSuggestions)
      .filter(([_, sug]) => sug.confidence >= minConfidence)
      .map(([id]) => id);
    
    if (idsToAccept.length === 0) return;

    const previousTransactions = [...store.transactions];
    const previousRules = [...store.rules];
    
    let updatedTransactions = [...store.transactions];
    let updatedRules = [...store.rules];

    idsToAccept.forEach(id => {
      const sug = aiSuggestions[id];
      const txn = updatedTransactions.find(t => t.id === id);
      if (!txn) return;

      updatedTransactions = updatedTransactions.map(t => t.id === id ? { ...t, category: sug.category } : t);
      
      if (txn.merchant && txn.merchant !== 'Unknown') {
        const existingRuleIdx = updatedRules.findIndex(r => r.merchant.toLowerCase() === txn.merchant.toLowerCase());
        if (existingRuleIdx >= 0) {
          updatedRules[existingRuleIdx] = { ...updatedRules[existingRuleIdx], category: sug.category };
        } else {
          updatedRules.push({ id: 'r_' + Date.now() + Math.random(), merchant: txn.merchant, category: sug.category });
        }
      }
    });

    updateStore('transactions', updatedTransactions);
    updateStore('rules', updatedRules);
    
    const newSugs = { ...aiSuggestions };
    idsToAccept.forEach(id => delete newSugs[id]);
    setAiSuggestions(newSugs);
    setShowReviewPanel(false);

    addToast(`Accepted ${idsToAccept.length} suggestions`, 'success', {
      label: 'Undo',
      onClick: () => {
        updateStore('transactions', previousTransactions);
        updateStore('rules', previousRules);
        setAiSuggestions(aiSuggestions); // Restore
      }
    });
  };

  // --- Import Processing Helpers ---
  const processImportedTransactions = async (rawTransactions) => {
    setIsProcessingAI(true);
    try {
      const newTransactions = [];
      let duplicates = 0;

      const baseTxns = rawTransactions.map(row => {
        let formattedDate = row.date;
        if (!formattedDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
          try { formattedDate = new Date(row.date).toISOString().split('T')[0]; } 
          catch (e) { formattedDate = new Date().toISOString().split('T')[0]; }
        }
        return {
          id: 'imp_' + Date.now() + Math.random().toString(36).substr(2, 9),
          date: formattedDate,
          description: row.description || 'Unknown',
          merchant: row.merchant || (row.description ? row.description.split(/[\/-]/)[0].trim().substring(0, 30) : 'Unknown'),
          amount: parseFloat(row.amount) || 0,
          type: row.type === 'income' ? 'income' : 'expense',
          category: 'Uncategorized'
        };
      });

      const uncategorized = [];
      const categorized = [];

      baseTxns.forEach(t => {
        let matchedCategory = null;
        
        const rule = store.rules.find(r => 
          (t.merchant || '').toLowerCase().includes((r.merchant || '').toLowerCase()) || 
          (t.description || '').toLowerCase().includes((r.merchant || '').toLowerCase())
        );
        
        if (rule) {
          matchedCategory = rule.category;
        } else {
          const desc = (t.description || '').toLowerCase();
          for (const [keyword, cat] of Object.entries(KEYWORD_RULES)) {
            const regex = new RegExp(`\\b${keyword}\\b`, 'i');
            if (regex.test(desc)) {
              matchedCategory = cat;
              break;
            }
          }
        }

        if (matchedCategory) {
          categorized.push({ ...t, category: matchedCategory });
        } else {
          uncategorized.push(t);
        }
      });

      // Deduplication before AI
      const allProcessed = [...categorized, ...uncategorized];
      const uniqueToImport = [];
      
      allProcessed.forEach(t => {
        const isDup = store.transactions.some(ext => 
          ext.date === t.date && ext.amount === t.amount && ext.description === t.description
        );
        if (isDup) duplicates++;
        else uniqueToImport.push(t);
      });

      setCsvPreview({ transactions: uniqueToImport, duplicates });
    } finally {
      setIsProcessingAI(false);
    }
  };

  const confirmImport = async () => {
    const previousState = [...store.transactions];
    const imported = csvPreview.transactions;
    updateStore('transactions', [...store.transactions, ...imported]);
    addToast(`Imported ${imported.length} transactions`, 'success', {
      label: 'Undo',
      onClick: () => updateStore('transactions', previousState)
    });
    setCsvPreview(null);
    
    // Auto-trigger categorization for the new uncategorized ones
    const newUncat = imported.filter(t => t.category === 'Uncategorized');
    if (newUncat.length > 0 && store.settings.geminiApiKey) {
      setTimeout(() => handleCategorizeUncategorized(), 1000);
    }
  };

  // --- CSV Import ---
  const handleCsvUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

      let headerIdx = -1;
      let headers = [];
      
      for (let i = 0; i < Math.min(30, lines.length); i++) {
        const cols = lines[i].toLowerCase().split(',');
        if (cols.some(c => c.includes('date')) && (cols.some(c => c.includes('amount')) || cols.some(c => c.includes('debit')))) {
          headerIdx = i;
          headers = cols.map(c => c.replace(/["']/g, '').trim());
          break;
        }
      }

      if (headerIdx === -1) {
        addToast('Could not find valid header row in CSV', 'error');
        return;
      }

      const dateIdx = headers.findIndex(h => h.includes('date'));
      const descIdx = headers.findIndex(h => h.includes('description') || h.includes('narration') || h.includes('particulars'));
      const amtIdx = headers.findIndex(h => h === 'amount' || h === 'amount(inr)' || h.includes('amount'));
      const drIdx = headers.findIndex(h => h.includes('debit') || h.includes('withdrawal'));
      const crIdx = headers.findIndex(h => h.includes('credit') || h.includes('deposit'));

      const rawRows = [];
      let firstPartOver12 = false;
      let secondPartOver12 = false;

      for (let i = headerIdx + 1; i < lines.length; i++) {
        const cols = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/["']/g, '').trim());
        if (cols.length < 3) continue;

        const rawDate = cols[dateIdx];
        if (!rawDate) continue;

        const parts = rawDate.split(/[-/]/);
        if (parts.length >= 3) {
          if (parseInt(parts[0]) > 12) firstPartOver12 = true;
          if (parseInt(parts[1]) > 12) secondPartOver12 = true;
        }

        let amount = 0;
        let type = 'expense';

        const parseAmount = (valStr) => parseFloat(valStr.replace(/["',]/g, ''));

        if (amtIdx >= 0 && cols[amtIdx]) {
          const val = parseAmount(cols[amtIdx]);
          amount = Math.abs(val);
          type = val < 0 ? 'expense' : 'income';
        } else if (drIdx >= 0 && cols[drIdx]) {
          amount = parseAmount(cols[drIdx]);
          type = 'expense';
        } else if (crIdx >= 0 && cols[crIdx]) {
          amount = parseAmount(cols[crIdx]);
          type = 'income';
        }

        if (!amount || isNaN(amount)) continue;

        rawRows.push({ rawDate, description: cols[descIdx] || 'Unknown', amount, type });
      }

      const isMonthFirst = secondPartOver12;
      const formattedRows = rawRows.map(row => {
        let formattedDate = new Date().toISOString().split('T')[0];
        if (row.rawDate.match(/^\d{4}[-/]\d{2}[-/]\d{2}/)) {
           formattedDate = row.rawDate.replace(/\//g, '-').substring(0, 10);
        } else {
           const parts = row.rawDate.split(/[-/]/);
           if (parts.length >= 3) {
             let d = isMonthFirst ? parts[1] : parts[0];
             let m = isMonthFirst ? parts[0] : parts[1];
             let y = parts[2].substring(0, 4);
             if (y.length === 2) y = '20' + y;
             formattedDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
           }
        }
        return { ...row, date: formattedDate };
      });

      processImportedTransactions(formattedRows);
    };
    reader.readAsText(file);
    e.target.value = null;
    setShowImportMenu(false);
  };

  const handleSmsSubmit = async () => {
    if (!smsText.trim()) return;
    setIsProcessingAI(true);
    
    try {
      const maskedText = maskSensitiveData(smsText);
      const prompt = `Extract financial transactions from the following SMS messages. 
Return ONLY a valid JSON array of objects. 
Each object must have exactly these keys:
- "date": string in YYYY-MM-DD format.
- "description": string (full narration).
- "merchant": string (clean name of the merchant or sender).
- "amount": number (positive value only).
- "type": string (must be exactly "income" or "expense").

SMS Messages:
${maskedText}`;

      const jsonResult = await fetchGeminiWithTimeout(prompt);
      if (!Array.isArray(jsonResult)) throw new Error("AI did not return an array");
      
      await processImportedTransactions(jsonResult);
      setIsSmsModalOpen(false);
      setSmsText('');
    } catch (error) {
      addToast(error.message, 'error');
      setIsProcessingAI(false);
    }
  };

  const handleAiFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setShowImportMenu(false);
    setIsProcessingAI(true);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const base64String = event.target.result.split(',')[1];
          const mimeType = file.type;
          
          const prompt = `Extract financial transactions from this document/image. 
Return ONLY a valid JSON array of objects. 
Each object must have exactly these keys:
- "date": string in YYYY-MM-DD format.
- "description": string (full narration).
- "merchant": string (clean name of the merchant or sender).
- "amount": number (positive value only).
- "type": string (must be exactly "income" or "expense").`;

          const jsonResult = await fetchGeminiWithTimeout(prompt, { mime_type: mimeType, data: base64String });
          if (!Array.isArray(jsonResult)) throw new Error("AI did not return an array");
          
          await processImportedTransactions(jsonResult);
        } catch (error) {
          addToast(error.message, 'error');
          setIsProcessingAI(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      addToast('Failed to read file', 'error');
      setIsProcessingAI(false);
    }
    e.target.value = null;
  };

  const suggestionCount = Object.keys(aiSuggestions).length;

  return (
    <div className="h-full flex flex-col space-y-4 relative">
      {isProcessingAI && (
        <div className="absolute inset-0 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm z-40 flex flex-col items-center justify-center rounded-xl">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
          <p className="text-gray-900 dark:text-gray-100 font-medium">AI is analyzing your data...</p>
        </div>
      )}

      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-gray-100 w-64"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${showFilters ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400' : 'bg-white border-gray-200 text-gray-600 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400'}`}
          >
            <Filter className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleCategorizeUncategorized}
            disabled={isCategorizing}
            className="flex items-center gap-2 px-4 py-2 bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/20 dark:hover:bg-purple-900/40 text-purple-700 dark:text-purple-400 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            {isCategorizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span className="hidden sm:inline">Categorize Uncategorized</span>
            <span className="sm:hidden">Auto-Cat</span>
          </button>

          <div className="relative">
            <button
              onClick={() => setShowImportMenu(!showImportMenu)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
            >
              <Upload className="w-4 h-4" />
              Import
              <ChevronDown className="w-4 h-4" />
            </button>

            {showImportMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-30 overflow-hidden">
                <input type="file" accept=".csv" ref={fileInputRef} onChange={handleCsvUpload} className="hidden" />
                <input type="file" accept=".pdf,image/*" ref={aiFileInputRef} onChange={handleAiFileUpload} className="hidden" />
                
                <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 text-left focus:outline-none focus:bg-gray-50 dark:focus:bg-gray-700">
                  <FileSpreadsheet className="w-4 h-4 text-green-600" />
                  Import CSV
                </button>
                <button onClick={() => aiFileInputRef.current?.click()} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 text-left border-t border-gray-100 dark:border-gray-700 focus:outline-none focus:bg-gray-50 dark:focus:bg-gray-700">
                  <FileImage className="w-4 h-4 text-purple-600" />
                  Upload PDF / Image (AI)
                </button>
                <button onClick={() => { setShowImportMenu(false); setIsSmsModalOpen(true); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 text-left border-t border-gray-100 dark:border-gray-700 focus:outline-none focus:bg-gray-50 dark:focus:bg-gray-700">
                  <MessageSquare className="w-4 h-4 text-blue-600" />
                  Paste SMS (AI)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Type</label>
            <select value={filters.type} onChange={(e) => setFilters({...filters, type: e.target.value})} className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="all">All Types</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Category</label>
            <select value={filters.category} onChange={(e) => setFilters({...filters, category: e.target.value})} className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="all">All Categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">From Date</label>
            <input type="date" value={filters.dateFrom} onChange={(e) => setFilters({...filters, dateFrom: e.target.value})} className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">To Date</label>
            <input type="date" value={filters.dateTo} onChange={(e) => setFilters({...filters, dateTo: e.target.value})} className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
      )}

      {/* Review Suggestions Banner */}
      {suggestionCount > 0 && showReviewPanel && (
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800/50 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <div>
              <h3 className="font-semibold text-purple-900 dark:text-purple-300">{suggestionCount} AI Suggestions to Review</h3>
              <p className="text-sm text-purple-700 dark:text-purple-400">Accept them individually below, or accept all high-confidence ones.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button onClick={() => acceptAllSuggestions(0.8)} className="flex-1 sm:flex-none px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500">
              Accept {'>'}80%
            </button>
            <button onClick={() => setShowReviewPanel(false)} className="p-1.5 text-purple-600 hover:bg-purple-100 dark:hover:bg-purple-900/50 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
          <span className="text-sm font-medium text-blue-800 dark:text-blue-300">
            {selectedIds.size} selected
          </span>
          <div className="flex items-center gap-3">
            <select 
              onChange={(e) => { if(e.target.value) handleCategoryChange(selectedIds, e.target.value); e.target.value = ''; }}
              className="p-1.5 text-sm bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-700 rounded-lg text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Change Category...</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button onClick={deleteSelected} className="p-1.5 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500">
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 dark:bg-gray-900/50 sticky top-0 z-10">
              <tr>
                <th className="p-4 border-b border-gray-200 dark:border-gray-700 w-12">
                  <input 
                    type="checkbox" 
                    checked={filteredTransactions.length > 0 && selectedIds.size === filteredTransactions.length}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="p-4 border-b border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                <th className="p-4 border-b border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Description</th>
                <th className="p-4 border-b border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Category</th>
                <th className="p-4 border-b border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Amount</th>
                <th className="p-4 border-b border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-gray-500 dark:text-gray-400">
                    No transactions found.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map(t => {
                  const isEditing = editingId === t.id;
                  const isSelected = selectedIds.has(t.id);
                  const sug = aiSuggestions[t.id];
                  
                  return (
                    <tr key={t.id} className={`group hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${isSelected ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                      <td className="p-4">
                        <input 
                          type="checkbox" 
                          checked={isSelected}
                          onChange={() => toggleSelect(t.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="p-4 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        {isEditing ? (
                          <input type="date" value={editForm.date} onChange={e => setEditForm({...editForm, date: e.target.value})} className="w-full p-1 border rounded dark:bg-gray-900 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        ) : t.date}
                      </td>
                      <td className="p-4 text-sm text-gray-900 dark:text-gray-100">
                        {isEditing ? (
                          <input type="text" value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} className="w-full p-1 border rounded dark:bg-gray-900 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        ) : t.description}
                      </td>
                      <td className="p-4 text-sm">
                        {isEditing ? (
                          <select value={editForm.category} onChange={e => setEditForm({...editForm, category: e.target.value})} className="w-full p-1 border rounded dark:bg-gray-900 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        ) : sug ? (
                          <div className="flex items-center gap-1 group/sug relative">
                            {sug.confidence >= 0.5 ? (
                              <div className="flex items-center gap-1 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 px-2 py-1 rounded-full text-xs font-medium border border-purple-200 dark:border-purple-800/50 cursor-help" title={sug.reason}>
                                <Sparkles className="w-3 h-3" />
                                {sug.category} {Math.round(sug.confidence * 100)}%
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-2 py-1 rounded-full text-xs font-medium cursor-help" title={sug.reason}>
                                Low confidence: {sug.category}
                              </div>
                            )}
                            <div className="flex items-center gap-0.5 opacity-0 group-hover/sug:opacity-100 transition-opacity">
                              <button onClick={() => acceptSuggestion(t.id)} className="p-1 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded focus:outline-none focus:ring-2 focus:ring-green-500"><Check className="w-3 h-3" /></button>
                              <button onClick={() => dismissSuggestion(t.id)} className="p-1 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-gray-500"><X className="w-3 h-3" /></button>
                            </div>
                          </div>
                        ) : (
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${t.category === 'Uncategorized' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
                            {t.category}
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-sm text-right whitespace-nowrap">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-2">
                            <select value={editForm.type} onChange={e => setEditForm({...editForm, type: e.target.value})} className="p-1 border rounded dark:bg-gray-900 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
                              <option value="expense">Dr</option>
                              <option value="income">Cr</option>
                            </select>
                            <input type="number" value={editForm.amount} onChange={e => setEditForm({...editForm, amount: parseFloat(e.target.value) || 0})} className="w-24 p-1 border rounded dark:bg-gray-900 dark:border-gray-600 text-right focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          </div>
                        ) : (
                          <span className={`font-medium ${t.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-gray-100'}`}>
                            {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={saveEdit} className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded focus:outline-none focus:ring-2 focus:ring-green-500"><Check className="w-4 h-4" /></button>
                            <button onClick={() => setEditingId(null)} className="p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-gray-500"><X className="w-4 h-4" /></button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            <button onClick={() => startEdit(t)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={() => deleteSingle(t.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals (SMS, Preview) remain unchanged but use focus rings */}
      {isSmsModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full flex flex-col">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 dark:bg-blue-900/50 p-2 rounded-lg text-blue-600 dark:text-blue-400">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Paste Bank SMS</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Account and phone numbers will be masked before sending to AI.
                  </p>
                </div>
              </div>
              <button onClick={() => setIsSmsModalOpen(false)} className="text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              <textarea
                value={smsText}
                onChange={(e) => setSmsText(e.target.value)}
                placeholder="Paste your bank SMS messages here..."
                className="w-full h-48 p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              />
              <div className="mt-4 flex justify-between items-center">
                <button 
                  onClick={() => setSmsText(DEMO_SMS)}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                >
                  Load Demo SMS
                </button>
                <div className="flex gap-3">
                  <button onClick={() => setIsSmsModalOpen(false)} className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500">
                    Cancel
                  </button>
                  <button 
                    onClick={handleSmsSubmit}
                    disabled={!smsText.trim()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                  >
                    Process with AI
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {csvPreview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 dark:bg-blue-900/50 p-2 rounded-lg text-blue-600 dark:text-blue-400">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Review Import</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Found {csvPreview.transactions.length} new transactions. Skipped {csvPreview.duplicates} duplicates.
                  </p>
                </div>
              </div>
              <button onClick={() => setCsvPreview(null)} className="text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-auto p-6">
              {csvPreview.transactions.length === 0 ? (
                <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                  No new transactions to import. All rows were duplicates or invalid.
                </div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                      <th className="pb-2">Date</th>
                      <th className="pb-2">Description</th>
                      <th className="pb-2">Category</th>
                      <th className="pb-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {csvPreview.transactions.slice(0, 50).map((t, i) => (
                      <tr key={i}>
                        <td className="py-2 text-gray-900 dark:text-gray-100">{t.date}</td>
                        <td className="py-2 text-gray-900 dark:text-gray-100 truncate max-w-xs">{t.description}</td>
                        <td className="py-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${t.category === 'Uncategorized' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
                            {t.category}
                          </span>
                        </td>
                        <td className={`py-2 text-right ${t.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-gray-100'}`}>
                          {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {csvPreview.transactions.length > 50 && (
                <p className="text-center text-sm text-gray-500 mt-4">Showing first 50 transactions...</p>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3 bg-gray-50 dark:bg-gray-900/50 rounded-b-xl">
              <button onClick={() => setCsvPreview(null)} className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500">
                Cancel
              </button>
              <button 
                onClick={confirmImport}
                disabled={csvPreview.transactions.length === 0}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
              >
                Import {csvPreview.transactions.length} Transactions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}