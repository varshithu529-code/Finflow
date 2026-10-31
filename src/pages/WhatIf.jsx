// src/pages/WhatIf.jsx
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { HelpCircle, Sparkles, Loader2, ArrowRight, TrendingUp, TrendingDown, Target, Mic } from 'lucide-react';
import { useStore } from '../store/StoreContext';
import { CATEGORIES, getBaselineStats, applyAdjustments, calculateGoalProjections } from '../utils/financeMath';

const EXAMPLES = [
  "What if I cut dining by 30%",
  "What if rent goes up by 5000",
  "What if I get a 10% raise",
  "What if I stop spending on Entertainment"
];

export default function WhatIf() {
  const { store, addToast } = useStore();
  const [scenario, setScenario] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState(null);
  
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef(null);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: store.settings.currency, maximumFractionDigits: 0 }).format(amount);
  };

  const baseline = useMemo(() => getBaselineStats(store), [store.transactions, store.profile]);
  const baseGoals = useMemo(() => calculateGoalProjections(store.goals, baseline.surplus), [store.goals, baseline.surplus]);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setScenario(prev => prev ? `${prev} ${transcript}` : transcript);
      };
      
      recognition.onerror = (event) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
      };
      
      recognition.onend = () => {
        setIsListening(false);
      };
      
      recognitionRef.current = recognition;
    }
  }, []);

  const toggleListening = (e) => {
    e.preventDefault();
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const handleAnalyze = async () => {
    if (!scenario.trim()) return;
    if (!store.settings.geminiApiKey) {
      addToast('Gemini API key is missing. Please add it in the Profile tab.', 'error');
      return;
    }

    setIsAnalyzing(true);
    try {
      const prompt = `Convert the user's financial scenario into structured adjustments.
Return ONLY a valid JSON array of objects.
Each object must have exactly these keys:
- "type": "income" or "expense"
- "category": string (If expense, use one of: ${CATEGORIES.join(', ')}. If general/all expenses, use "All")
- "value": number (positive for increase, negative for decrease)
- "unit": "percent" or "absolute"

Scenario: "${scenario}"`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${store.settings.geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, response_mime_type: "application/json" }
        })
      });

      if (!response.ok) throw new Error('Failed to analyze scenario');
      
      const data = await response.json();
      const textResponse = data.candidates[0].content.parts[0].text;
      const adjustments = JSON.parse(textResponse.replace(/```json/g, '').replace(/```/g, '').trim());
      
      // Run deterministic math
      const newStats = applyAdjustments(baseline, adjustments);
      const newGoals = calculateGoalProjections(store.goals, newStats.surplus);

      setResults({
        adjustments,
        newStats,
        newGoals
      });
    } catch (error) {
      addToast('Failed to parse scenario. Try rephrasing.', 'error');
      console.error(error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="h-full flex flex-col space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <HelpCircle className="w-8 h-8 text-blue-600" />
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">What-If Scenarios</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Model financial decisions and see the impact on your goals.</p>
        </div>
      </div>

      {/* Input Section */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="relative mb-4">
          <textarea
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
            placeholder="Describe a scenario... e.g., 'What if I cut dining by 30% and get a 10% raise?'"
            className="w-full h-24 p-4 pr-12 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
          />
          {speechSupported && (
            <button
              type="button"
              onClick={toggleListening}
              className={`absolute bottom-4 right-4 p-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isListening 
                  ? 'text-red-500 bg-red-50 dark:bg-red-900/30 animate-pulse' 
                  : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30'
              }`}
              title={isListening ? "Stop listening" : "Start dictation"}
            >
              <Mic className="w-5 h-5" />
            </button>
          )}
        </div>
        
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex, i) => (
              <button
                key={i}
                onClick={() => setScenario(ex)}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-xs font-medium rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {ex}
              </button>
            ))}
          </div>
          <button
            onClick={handleAnalyze}
            disabled={!scenario.trim() || isAnalyzing}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
          >
            {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Analyze Scenario
          </button>
        </div>
      </div>

      {/* Results Section */}
      {results && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Surplus Impact */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Impact on Monthly Surplus</h3>
            <div className="flex items-center justify-center gap-8">
              <div className="text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Current Surplus</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(baseline.surplus)}</p>
              </div>
              <ArrowRight className="w-6 h-6 text-gray-400" />
              <div className="text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">New Surplus</p>
                <p className={`text-2xl font-bold ${results.newStats.surplus > baseline.surplus ? 'text-green-600 dark:text-green-400' : results.newStats.surplus < baseline.surplus ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                  {formatCurrency(results.newStats.surplus)}
                </p>
              </div>
            </div>
          </div>

          {/* Goals Impact */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-600" /> Impact on Goals
            </h3>
            
            {baseGoals.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No goals set. Add goals to see how scenarios affect them.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-900/50">
                    <tr>
                      <th className="p-4 font-medium text-gray-500 dark:text-gray-400 rounded-tl-lg">Goal</th>
                      <th className="p-4 font-medium text-gray-500 dark:text-gray-400">Current Projection</th>
                      <th className="p-4 font-medium text-gray-500 dark:text-gray-400">New Projection</th>
                      <th className="p-4 font-medium text-gray-500 dark:text-gray-400 rounded-tr-lg">Difference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {baseGoals.map(oldGoal => {
                      const newGoal = results.newGoals.find(g => g.id === oldGoal.id);
                      const oldMonths = oldGoal.projectedMonths;
                      const newMonths = newGoal.projectedMonths;
                      
                      let diffBadge = null;
                      if (oldMonths === Infinity && newMonths !== Infinity) {
                        diffBadge = <span className="flex items-center gap-1 text-green-600 dark:text-green-400 font-medium"><TrendingUp className="w-4 h-4" /> Now achievable!</span>;
                      } else if (oldMonths !== Infinity && newMonths === Infinity) {
                        diffBadge = <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-medium"><TrendingDown className="w-4 h-4" /> No longer achievable</span>;
                      } else if (oldMonths !== Infinity && newMonths !== Infinity) {
                        const diff = newMonths - oldMonths;
                        if (diff < -0.1) {
                          diffBadge = <span className="flex items-center gap-1 text-green-600 dark:text-green-400 font-medium"><TrendingUp className="w-4 h-4" /> {Math.abs(diff).toFixed(1)} months sooner</span>;
                        } else if (diff > 0.1) {
                          diffBadge = <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-medium"><TrendingDown className="w-4 h-4" /> {diff.toFixed(1)} months later</span>;
                        } else {
                          diffBadge = <span className="text-gray-500 dark:text-gray-400">No change</span>;
                        }
                      } else {
                        diffBadge = <span className="text-gray-500 dark:text-gray-400">Still unachievable</span>;
                      }

                      return (
                        <tr key={oldGoal.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                          <td className="p-4 font-medium text-gray-900 dark:text-white">{oldGoal.name}</td>
                          <td className="p-4 text-gray-600 dark:text-gray-300">{oldGoal.projectedDate}</td>
                          <td className="p-4 font-medium text-gray-900 dark:text-white">{newGoal.projectedDate}</td>
                          <td className="p-4">{diffBadge}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}