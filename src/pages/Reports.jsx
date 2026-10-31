import React, { useState, useMemo } from 'react';
import { 
  BarChart3, Printer, Sparkles, Loader2, TrendingUp, TrendingDown, 
  Wallet, Target, Repeat
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { useStore } from '../store/StoreContext';
import { getReportStats, round1, round0, cleanUpAIDecimals } from '../utils/financeMath';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b'];

export default function Reports() {
  const { store, addToast } = useStore();
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiNarrative, setAiNarrative] = useState(null);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: store.settings.currency, maximumFractionDigits: 0 }).format(amount || 0);
  };

  const availableMonths = useMemo(() => {
    const months = new Set((store.transactions || []).map(t => t.date.substring(0, 7)));
    return Array.from(months).sort().reverse();
  }, [store.transactions]);

  const [selectedMonth, setSelectedMonth] = useState(availableMonths[0] || new Date().toISOString().substring(0, 7));

  const stats = useMemo(() => getReportStats(store, selectedMonth), [store, selectedMonth]);

  const handleGenerateInsights = async () => {
    if (!store.settings.geminiApiKey) {
      addToast('Gemini API key is missing. Please add it in the Profile tab.', 'error');
      return;
    }

    setIsGenerating(true);
    try {
      // Round stats before sending to AI
      const safeStats = {
        month: stats.monthStr,
        income: round0(stats.income),
        expense: round0(stats.expense),
        savingsRate: round1(stats.savingsRate),
        expenseChange: round1(stats.expenseChange),
        topCategories: stats.topCategories.map(c => ({ name: c.name, amount: round0(c.amount) })),
        overruns: stats.overruns.map(o => ({ category: o.category, over: round0(o.over) }))
      };

      const prompt = `You are a financial analyst. Review the following monthly stats for ${selectedMonth} and write a short 2-3 sentence narrative summarizing the performance, followed by exactly 3 bulleted action items.
      CRITICAL RULE: Use ONLY the numbers provided in this JSON. Do not invent or hallucinate any figures. NEVER show more than one decimal place.
      
      Data:
      ${JSON.stringify(safeStats)}
      
      Return ONLY valid JSON in this format:
      {
        "narrative": "string",
        "actionItems": ["string", "string", "string"]
      }`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${store.settings.geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, response_mime_type: "application/json" }
        })
      });

      if (!response.ok) throw new Error('Failed to generate insights');
      
      const data = await response.json();
      const textResponse = data.candidates[0].content.parts[0].text;
      const result = JSON.parse(textResponse.replace(/```json/g, '').replace(/```/g, '').trim());
      
      // Cleanup decimals just in case
      result.narrative = cleanUpAIDecimals(result.narrative);
      result.actionItems = result.actionItems.map(cleanUpAIDecimals);
      
      setAiNarrative(result);
    } catch (error) {
      addToast('Failed to generate insights.', 'error');
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  if (availableMonths.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
        <BarChart3 className="w-16 h-16 mb-4 opacity-50" />
        <h2 className="text-xl font-semibold">Reports</h2>
        <p className="mt-2">Add some transactions to generate reports.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-6 max-w-6xl mx-auto print:block print:space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:flex-row print:justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-blue-600 print:hidden" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white print:text-black">Monthly Report</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 print:text-gray-600">Detailed breakdown and AI insights.</p>
          </div>
        </div>
        <div className="flex items-center gap-3 print:hidden">
          <select
            value={selectedMonth}
            onChange={(e) => { setSelectedMonth(e.target.value); setAiNarrative(null); }}
            className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none"
          >
            {availableMonths.map(m => (
              <option key={m} value={m}>{new Date(m + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</option>
            ))}
          </select>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            <Printer className="w-4 h-4" /> Print PDF
          </button>
        </div>
        <div className="hidden print:block text-xl font-bold text-black">
          {new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:grid-cols-4">
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm print:border-gray-300 print:shadow-none">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 print:text-gray-600">Total Income</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white print:text-black mt-1">{formatCurrency(stats.income)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm print:border-gray-300 print:shadow-none">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 print:text-gray-600">Total Spent</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white print:text-black mt-1">{formatCurrency(stats.expense)}</p>
          <div className={`flex items-center gap-1 text-xs mt-1 font-medium ${stats.expenseChange > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {stats.expenseChange > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(stats.expenseChange).toFixed(1)}% vs last month
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm print:border-gray-300 print:shadow-none">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 print:text-gray-600">Savings Rate</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white print:text-black mt-1">{stats.savingsRate.toFixed(1)}%</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm print:border-gray-300 print:shadow-none">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 print:text-gray-600">Budget Overruns</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white print:text-black mt-1">{stats.overruns.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:grid-cols-3 print:gap-4">
        <div className="lg:col-span-2 space-y-6 print:space-y-4">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm print:border-gray-300 print:shadow-none">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white print:text-black mb-4">Expense Breakdown</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stats.categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {stats.categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }}
                    formatter={(value) => formatCurrency(value)}
                  />
                  <Legend layout="vertical" verticalAlign="middle" align="right" iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm print:border-gray-300 print:shadow-none">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white print:text-black mb-4">Top Spending Categories</h3>
            <div className="space-y-4">
              {stats.topCategories.map((cat, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="font-medium text-gray-700 dark:text-gray-300 print:text-black">{cat.name}</span>
                  <span className="font-bold text-gray-900 dark:text-white print:text-black">{formatCurrency(cat.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6 print:space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-xl border border-blue-200 dark:border-blue-800/50 print:border-gray-300 print:bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 print:text-black flex items-center gap-2">
                <Sparkles className="w-5 h-5" /> AI Insights
              </h3>
              {!aiNarrative && (
                <button
                  onClick={handleGenerateInsights}
                  disabled={isGenerating}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-2 print:hidden focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Generate'}
                </button>
              )}
            </div>
            
            {aiNarrative ? (
              <div className="space-y-4 text-sm text-blue-900 dark:text-blue-100 print:text-black">
                <p className="leading-relaxed">{aiNarrative.narrative}</p>
                <ul className="space-y-2 list-disc pl-4">
                  {aiNarrative.actionItems.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-blue-700/70 dark:text-blue-300/70 print:hidden">
                Click generate to get a personalized summary and action items based on this month's data.
              </p>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm print:border-gray-300 print:shadow-none">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white print:text-black mb-4">Budget Overruns</h3>
            {stats.overruns.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 print:text-gray-600">All budgets respected this month!</p>
            ) : (
              <div className="space-y-4">
                {stats.overruns.map((over, i) => (
                  <div key={i} className="flex flex-col gap-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-gray-700 dark:text-gray-300 print:text-black">{over.category}</span>
                      <span className="text-red-600 dark:text-red-400 font-bold">+{formatCurrency(over.over)}</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                      <div className="bg-red-500 h-1.5 rounded-full" style={{ width: '100%' }}></div>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 print:text-gray-600 text-right">Limit: {formatCurrency(over.limit)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}