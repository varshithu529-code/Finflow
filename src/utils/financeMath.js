export const CATEGORIES = [
  'Salary', 'Housing', 'Utilities', 'Food & Dining', 
  'Transport', 'Entertainment', 'Health', 'Groceries', 
  'Shopping', 'Investment', 'Other'
];

export const safeDiv = (num, den, fallback = 0) => {
  return (den && den !== 0 && !isNaN(den)) ? num / den : fallback;
};

export const round1 = (num) => Math.round(num * 10) / 10;
export const round0 = (num) => Math.round(num);

export const cleanUpAIDecimals = (text) => {
  if (!text) return text;
  // Finds numbers with 2+ decimal places and rounds them to 1, ignoring commas
  return text.replace(/\b(\d{1,3}(?:,\d{3})*|\d+)\.(\d{2,})\b/g, (match, p1, p2) => {
    return `${p1}.${p2.substring(0, 1)}`;
  });
};

export const getMonthlyEquivalent = (amount, freq, customDays = 30) => {
  const safeAmount = parseFloat(amount) || 0;
  if (freq === 'weekly') return safeAmount * 4.333;
  if (freq === 'quarterly') return safeAmount / 3;
  if (freq === 'half-yearly') return safeAmount / 6;
  if (freq === 'yearly') return safeAmount / 12;
  if (freq === 'custom') return safeAmount * safeDiv(30.44, customDays, 1);
  return safeAmount; // monthly
};

export const calculateNextBillingDate = (currentDateStr, freq, customDays = 30) => {
  const d = new Date(currentDateStr || new Date());
  const day = d.getDate();
  
  if (freq === 'weekly') d.setDate(d.getDate() + 7);
  else if (freq === 'monthly') d.setMonth(d.getMonth() + 1);
  else if (freq === 'quarterly') d.setMonth(d.getMonth() + 3);
  else if (freq === 'half-yearly') d.setMonth(d.getMonth() + 6);
  else if (freq === 'yearly') d.setFullYear(d.getFullYear() + 1);
  else if (freq === 'custom') d.setDate(d.getDate() + (parseInt(customDays) || 30));

  // Handle month-end clipping (e.g. Jan 31 + 1 month -> Feb 28)
  if (['monthly', 'quarterly', 'half-yearly', 'yearly'].includes(freq)) {
    if (d.getDate() !== day && day > 28) d.setDate(0);
  }
  
  return d.toISOString().split('T')[0];
};

export const getBaselineStats = (store) => {
  const income = store.profile?.monthlyIncome || 0;
  
  const expenseTxns = (store.transactions || []).filter(t => t.type === 'expense');
  const uniqueMonths = new Set(expenseTxns.map(t => t.date.substring(0, 7))).size || 1;
  
  const categoryAverages = {};
  expenseTxns.forEach(t => {
    categoryAverages[t.category] = (categoryAverages[t.category] || 0) + t.amount;
  });
  
  let totalExpenses = 0;
  Object.keys(categoryAverages).forEach(cat => {
    categoryAverages[cat] = safeDiv(categoryAverages[cat], uniqueMonths);
    totalExpenses += categoryAverages[cat];
  });

  return { 
    income, 
    categoryAverages, 
    totalExpenses, 
    surplus: income - totalExpenses 
  };
};

export const applyAdjustments = (baseline, adjustments) => {
  let newIncome = baseline.income;
  let newCategoryAverages = { ...baseline.categoryAverages };
  let generalExpenseAdjustment = 0;
  
  (adjustments || []).forEach(adj => {
    if (adj.type === 'income') {
      if (adj.unit === 'percent') {
        newIncome += baseline.income * safeDiv(adj.value, 100);
      } else {
        newIncome += adj.value;
      }
    } else if (adj.type === 'expense') {
      if (adj.category === 'All') {
        if (adj.unit === 'percent') {
          generalExpenseAdjustment += baseline.totalExpenses * safeDiv(adj.value, 100);
        } else {
          generalExpenseAdjustment += adj.value;
        }
      } else {
        const cat = adj.category;
        const currentVal = newCategoryAverages[cat] || 0;
        if (adj.unit === 'percent') {
          newCategoryAverages[cat] = currentVal + (currentVal * safeDiv(adj.value, 100));
        } else {
          newCategoryAverages[cat] = Math.max(0, currentVal + adj.value);
        }
      }
    }
  });
  
  const newTotalExpenses = Object.values(newCategoryAverages).reduce((a, b) => a + b, 0) + generalExpenseAdjustment;
  
  return {
    income: newIncome,
    totalExpenses: newTotalExpenses,
    surplus: newIncome - newTotalExpenses
  };
};

export const calculateGoalProjections = (store, surplus) => {
  let availableSurplus = Math.max(0, surplus || 0);
  const { totalExpenses } = getBaselineStats(store);
  
  const projected = (store.goals || []).map(g => {
    let currentAmount = g.currentAmount || 0;
    let targetAmount = g.targetAmount || 0;
    
    // Sync Emergency Fund goal with Profile
    if (g.name === 'Emergency Fund') {
      currentAmount = store.profile?.emergencyFund || 0;
      targetAmount = (store.profile?.emergencyFundTargetMonths || 6) * totalExpenses;
    }
    
    return { 
      ...g, 
      currentAmount,
      targetAmount,
      required: 0, 
      allocated: 0, 
      remaining: Math.max(0, targetAmount - currentAmount) 
    };
  });
  
  const today = new Date();
  
  projected.forEach(g => {
    const deadline = new Date(g.deadline || today);
    const monthsLeft = Math.max(1, safeDiv(deadline - today, 1000 * 60 * 60 * 24 * 30.44, 1));
    g.required = safeDiv(g.remaining, monthsLeft);
  });
  
  projected.sort((a, b) => (a.priority || 99) - (b.priority || 99)).forEach(g => {
    if (g.remaining === 0) return;
    const alloc = Math.min(availableSurplus, g.required);
    g.allocated += alloc;
    availableSurplus -= alloc;
  });
  
  if (availableSurplus > 0) {
    const topGoal = projected.find(g => g.remaining > 0);
    if (topGoal) {
      topGoal.allocated += availableSurplus;
      availableSurplus = 0;
    }
  }
  
  projected.forEach(g => {
    if (g.remaining === 0) {
      g.projectedMonths = 0;
      g.projectedDate = new Date().toISOString().split('T')[0];
      g.status = 'Completed';
    } else if (g.allocated <= 0) {
      g.projectedMonths = Infinity;
      g.projectedDate = '-';
      g.status = 'Behind';
    } else {
      g.projectedMonths = safeDiv(g.remaining, g.allocated);
      const projDate = new Date();
      projDate.setDate(projDate.getDate() + (g.projectedMonths * 30.44));
      g.projectedDate = projDate.toISOString().split('T')[0];
      g.status = projDate <= new Date(g.deadline) ? 'On Track' : 'Behind';
    }
  });
  
  return projected;
};

export const getDashboardStats = (store) => {
  const today = new Date();
  const currentMonthStr = today.toISOString().substring(0, 7);
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysLeft = Math.max(1, daysInMonth - today.getDate() + 1);

  const uniqueMonths = new Set((store.transactions || []).map(t => t.date.substring(0, 7))).size;
  const useProfile = uniqueMonths < 3;

  const currentMonthTxns = (store.transactions || []).filter(t => t.date.startsWith(currentMonthStr));

  const actualIncome = currentMonthTxns.filter(t => t.type === 'income').reduce((a, b) => a + (b.amount || 0), 0);
  const income = (useProfile && actualIncome === 0) ? (store.profile?.monthlyIncome || 0) : actualIncome;

  const spent = currentMonthTxns.filter(t => t.type === 'expense').reduce((a, b) => a + (b.amount || 0), 0);

  const fixedCosts = store.profile?.fixedCosts || [];
  const activeSubs = (store.subscriptions || []).filter(s => s.status === 'active');

  const totalFixed = fixedCosts.reduce((a, b) => a + (b.amount || 0), 0);
  const totalSubs = activeSubs.reduce((a, b) => a + getMonthlyEquivalent(b.amount, b.frequency, b.customInterval), 0);

  let paidFixed = 0;
  let paidSubs = 0;

  currentMonthTxns.filter(t => t.type === 'expense').forEach(t => {
    const isSub = activeSubs.some(s => (s.merchant || '').toLowerCase() === (t.merchant || '').toLowerCase());
    if (isSub) { paidSubs += (t.amount || 0); return; }
    const isFixed = fixedCosts.some(fc => 
      (t.description || '').toLowerCase().includes((fc.name || '').toLowerCase()) || 
      (t.category || '').toLowerCase() === (fc.name || '').toLowerCase() ||
      (t.merchant || '').toLowerCase().includes((fc.name || '').toLowerCase())
    );
    if (isFixed) paidFixed += (t.amount || 0);
  });

  const upcomingCommitted = Math.max(0, totalFixed - paidFixed) + Math.max(0, totalSubs - paidSubs);
  const freeToSpend = income - spent - upcomingCommitted;
  const safeDaily = Math.max(0, safeDiv(freeToSpend, daysLeft));
  const expectedSafeDaily = Math.max(0, safeDiv(income - totalFixed - totalSubs, daysInMonth));

  return { income, spent, upcomingCommitted, freeToSpend, safeDaily, expectedSafeDaily, daysLeft, useProfile, currentMonthStr };
};

export const getHealthScore = (store) => {
  let score = 0;
  const breakdown = [];
  
  const { income, totalExpenses } = getBaselineStats(store);
  const savingsRate = income > 0 ? safeDiv(income - totalExpenses, income) * 100 : 0;
  
  if (savingsRate >= 20) { score += 30; breakdown.push({ label: 'Excellent Savings Rate (>20%)', pts: 30, max: 30 }); }
  else if (savingsRate >= 10) { score += 20; breakdown.push({ label: 'Good Savings Rate (10-20%)', pts: 20, max: 30 }); }
  else if (savingsRate > 0) { score += 10; breakdown.push({ label: 'Low Savings Rate (<10%)', pts: 10, max: 30 }); }
  else { breakdown.push({ label: 'Negative Savings Rate', pts: 0, max: 30 }); }

  const fixedTotal = (store.profile?.fixedCosts || []).reduce((sum, fc) => sum + (fc.amount || 0), 0);
  const burnRate = Math.max(fixedTotal, totalExpenses);
  const runway = burnRate > 0 ? safeDiv(store.profile?.emergencyFund || 0, burnRate) : 0;
  
  if (runway >= 6) { score += 30; breakdown.push({ label: 'Strong Emergency Fund (6+ mo)', pts: 30, max: 30 }); }
  else if (runway >= 3) { score += 20; breakdown.push({ label: 'Good Emergency Fund (3-6 mo)', pts: 20, max: 30 }); }
  else if (runway >= 1) { score += 10; breakdown.push({ label: 'Building Emergency Fund (1-3 mo)', pts: 10, max: 30 }); }
  else { breakdown.push({ label: 'Low Emergency Fund (<1 mo)', pts: 0, max: 30 }); }

  const currentMonthStr = new Date().toISOString().substring(0, 7);
  const currentMonthTxns = (store.transactions || []).filter(t => t.date.startsWith(currentMonthStr) && t.type === 'expense');
  let overBudgetCount = 0;
  (store.budgets || []).forEach(b => {
    const spent = currentMonthTxns.filter(t => t.category === b.category).reduce((sum, t) => sum + (t.amount || 0), 0);
    if (spent > (b.limit || 0)) overBudgetCount++;
  });
  
  if (!store.budgets || store.budgets.length === 0) {
    score += 10; breakdown.push({ label: 'No Budgets Set', pts: 10, max: 20 });
  } else if (overBudgetCount === 0) {
    score += 20; breakdown.push({ label: 'All Budgets Respected', pts: 20, max: 20 });
  } else if (overBudgetCount === 1) {
    score += 10; breakdown.push({ label: '1 Budget Overrun', pts: 10, max: 20 });
  } else {
    breakdown.push({ label: 'Multiple Budget Overruns', pts: 0, max: 20 });
  }

  const fixedRatio = income > 0 ? safeDiv(fixedTotal, income) * 100 : 100;
  if (fixedRatio <= 30) { score += 20; breakdown.push({ label: 'Low Fixed Costs (<=30%)', pts: 20, max: 20 }); }
  else if (fixedRatio <= 50) { score += 10; breakdown.push({ label: 'Moderate Fixed Costs (30-50%)', pts: 10, max: 20 }); }
  else { breakdown.push({ label: 'High Fixed Costs (>50%)', pts: 0, max: 20 }); }

  return { score, breakdown };
};

export const getAnomalies = (store) => {
  const anomalies = [];
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const recentTxns = (store.transactions || []).filter(t => new Date(t.date) >= thirtyDaysAgo && t.type === 'expense');
  
  for (let i = 0; i < recentTxns.length; i++) {
    for (let j = i + 1; j < recentTxns.length; j++) {
      const t1 = recentTxns[i];
      const t2 = recentTxns[j];
      if (t1.amount === t2.amount && t1.merchant === t2.merchant) {
        const daysDiff = safeDiv(Math.abs(new Date(t1.date) - new Date(t2.date)), 86400000);
        if (daysDiff <= 2) {
          anomalies.push({ type: 'Duplicate', txn: t1, relatedTxn: t2, message: `Possible duplicate charge of ${t1.amount} at ${t1.merchant}` });
        }
      }
    }
  }

  const { categoryAverages } = getBaselineStats(store);
  recentTxns.forEach(t => {
    const avg = categoryAverages[t.category];
    if (avg && avg > 500 && t.amount > avg * 2.5) {
      anomalies.push({ type: 'Large Charge', txn: t, message: `Unusually large ${t.category} expense: ${t.amount} at ${t.merchant}` });
    }
  });

  const uniqueAnomalies = [];
  const seenIds = new Set();
  anomalies.forEach(a => {
    if (!seenIds.has(a.txn.id)) {
      seenIds.add(a.txn.id);
      uniqueAnomalies.push(a);
    }
  });

  return uniqueAnomalies;
};

export const getCashFlowCalendar = (store) => {
  const calendar = [];
  const today = new Date();
  
  const lastMonth = new Date(today);
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  const lastMonthStr = lastMonth.toISOString().substring(0, 7);
  const recurringIncome = (store.transactions || []).filter(t => t.date.startsWith(lastMonthStr) && t.type === 'income');

  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const dayOfMonth = d.getDate();
    
    const events = [];

    (store.subscriptions || []).filter(s => s.status === 'active').forEach(sub => {
      if (sub.nextDate === dateStr) {
        events.push({ type: 'outflow', name: sub.merchant, amount: sub.amount });
      }
    });

    recurringIncome.forEach(inc => {
      const incDay = parseInt(inc.date.split('-')[2]);
      if (incDay === dayOfMonth) {
        events.push({ type: 'inflow', name: inc.description, amount: inc.amount });
      }
    });

    if (events.length > 0) {
      calendar.push({ date: dateStr, events });
    }
  }
  
  return calendar;
};

export const getReportStats = (store, monthStr) => {
  const txns = (store.transactions || []).filter(t => t.date.startsWith(monthStr));
  const income = txns.filter(t => t.type === 'income').reduce((sum, t) => sum + (t.amount || 0), 0);
  const expense = txns.filter(t => t.type === 'expense').reduce((sum, t) => sum + (t.amount || 0), 0);
  const savingsRate = income > 0 ? safeDiv(income - expense, income) * 100 : 0;

  const [year, month] = monthStr.split('-');
  let prevMonth = parseInt(month) - 1;
  let prevYear = parseInt(year);
  if (prevMonth === 0) { prevMonth = 12; prevYear -= 1; }
  const prevMonthStr = `${prevYear}-${prevMonth.toString().padStart(2, '0')}`;
  
  const prevTxns = (store.transactions || []).filter(t => t.date.startsWith(prevMonthStr));
  const prevExpense = prevTxns.filter(t => t.type === 'expense').reduce((sum, t) => sum + (t.amount || 0), 0);
  const expenseChange = prevExpense > 0 ? safeDiv(expense - prevExpense, prevExpense) * 100 : 0;

  const catTotals = {};
  txns.filter(t => t.type === 'expense').forEach(t => {
    catTotals[t.category] = (catTotals[t.category] || 0) + (t.amount || 0);
  });
  const topCategories = Object.entries(catTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, amount]) => ({ name, amount }));

  const overruns = [];
  (store.budgets || []).forEach(b => {
    const spent = catTotals[b.category] || 0;
    if (spent > (b.limit || 0)) {
      overruns.push({ category: b.category, limit: b.limit, spent, over: spent - b.limit });
    }
  });

  return {
    monthStr,
    income,
    expense,
    savingsRate,
    expenseChange,
    topCategories,
    overruns,
    categoryData: Object.entries(catTotals).map(([name, value]) => ({ name, value }))
  };
};