// src/pages/Dashboard.jsx
import React, { useMemo } from 'react';
import { 
  LayoutDashboard, Activity, AlertTriangle, Calendar, 
  ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useStore } from '../store/StoreContext';
import { getHealthScore, getAnomalies, getCashFlowCalendar } from '../utils/financeMath';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b'];

export default function Dashboard() {
  const { store } = useStore();

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: store.settings.currency, maximumFractionDigits: 0 }).format(amount);
  };

  const { health, anomalies, cashFlow, categoryData, monthlyData } = useMemo(() => {
    const health = getHealthScore(store);
    const anomalies = getAnomalies(store);
    const cashFlow = getCashFlowCalendar(store);

    // Category Data (Last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentExpenses = store.transactions.filter(t => new Date(t.date) >= thirtyDaysAgo && t.type === 'expense');
    
    const catMap = {};
    recentExpenses.forEach(t => {
      catMap[t.category] = (catMap[t.category] || 0) + t.amount;
    });
    const categoryData = Object.entries(catMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Monthly Income vs Expense (Last 6 months)
    const monthMap = {};
    store.transactions.forEach(t => {
      const m = t.date.substring(0, 7);
      if (!monthMap[m]) monthMap[m] = { name: m, Income: 0, Expense: 0 };
      if (t.type === 'income') monthMap[m].Income += t.amount;
      if (t.type === 'expense') monthMap[m].Expense += t.amount;
    });
    const monthlyData = Object.values(monthMap).sort((a, b) => a.name.localeCompare(b.name)).slice(-6);

    return { health, anomalies, cashFlow, categoryData, monthlyData };
  }, [store.transactions, store.profile, store.budgets]);

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex items-center gap-3">
        <LayoutDashboard className="w-8 h-8 text-blue-600" />
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Your complete financial overview.</p>
        </div>
      </div>

      {/* Top Row: Health Score & Monthly Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Health Score */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" /> Financial Health Score
          </h3>
          <div className="flex items-center justify-center flex-1">
            <div className="relative flex items-center justify-center w-32 h-32">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="64" cy="64" r="60" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-gray-100 dark:text-gray-700" />
                <circle 
                  cx="64" cy="64" r="60" stroke="currentColor" strokeWidth="8" fill="transparent" 
                  strokeDasharray={377} strokeDashoffset={377 - (377 * health.score) / 100}
                  className={`${health.score >= 80 ? 'text-green-500' : health.score >= 50 ? 'text-amber-500' : 'text-red-500'} transition-all duration-1000`} 
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-gray-900 dark:text-white">{health.score}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">/ 100</span>
              </div>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {health.breakdown.map((item, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-400">{item.label}</span>
                <span className="font-medium text-gray-900 dark:text-white">{item.pts}/{item.max}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Income vs Expense Chart */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm lg:col-span-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Income vs Expense (6 Months)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val/1000}k`} />
                <Tooltip 
                  cursor={{fill: 'transparent'}}
                  contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }}
                  formatter={(value) => formatCurrency(value)}
                />
                <Legend iconType="circle" />
                <Bar dataKey="Income" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="Expense" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Middle Row: Category Pie & Anomalies */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Spending by Category */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Spending by Category (30 Days)</h3>
          {categoryData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-500">No data available</div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {categoryData.map((entry, index) => (
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
          )}
        </div>

        {/* Anomalies List */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm lg:col-span-2 flex flex-col">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" /> Anomalies & Alerts
          </h3>
          <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            {anomalies.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
                <AlertTriangle className="w-10 h-10 mb-2 opacity-20" />
                <p>No unusual charges detected recently.</p>
              </div>
            ) : (
              anomalies.map((anomaly, i) => (
                <div key={i} className="p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 rounded-lg flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-amber-900 dark:text-amber-300">{anomaly.type}</p>
                    <p className="text-sm text-amber-800 dark:text-amber-400/80">{anomaly.message}</p>
                    <p className="text-xs text-amber-700 dark:text-amber-500 mt-1">{anomaly.txn.date}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row: 30-Day Cash Flow */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-600" /> 30-Day Cash Flow Calendar
        </h3>
        {cashFlow.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No scheduled inflows or outflows detected for the next 30 days.</p>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4 snap-x">
            {cashFlow.map((day, i) => (
              <div key={i} className="min-w-[160px] p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 snap-start shrink-0">
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-3">
                  {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </p>
                <div className="space-y-2">
                  {day.events.map((ev, j) => (
                    <div key={j} className="flex items-center justify-between text-sm">
                      <span className="truncate max-w-[80px] text-gray-700 dark:text-gray-300" title={ev.name}>{ev.name}</span>
                      <span className={`font-medium flex items-center ${ev.type === 'inflow' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {ev.type === 'inflow' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {formatCurrency(ev.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}