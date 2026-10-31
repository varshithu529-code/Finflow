// README.md
# FinFlow 🚀

FinFlow is a personal finance coach with a living money model. It runs entirely in your browser, persisting data to `localStorage`, and uses the Gemini API to parse messy inputs, generate insights, and act as a financial copilot.

## Features
- **Dashboard**: Financial health score, 30-day cash flow calendar, anomaly detection, and committed vs. free money breakdown.
- **Transactions**: Import via CSV, paste SMS, or upload a PDF/Image. Uses a 3-layer categorization engine (Learned Rules -> Keywords -> Gemini AI).
- **Subscriptions**: Deterministic code detects recurring payments and flags price increases or unused subscriptions.
- **Budgets & Goals**: Track spending limits and allocate monthly surplus to goals by priority.
- **What-If Scenarios**: Type natural language scenarios (e.g., "What if I cut dining by 30%") and see the projected impact on your surplus and goal completion dates.
- **Copilot Chat**: A slide-out AI assistant that knows your real financial numbers and answers questions, protected by a strict two-layer guardrail against giving specific investment advice.
- **Privacy First**: All financial data stays in your browser's `localStorage`. Only explicitly requested AI tasks (like parsing an SMS or asking Copilot a question) are sent to the Gemini API.

## Tech Stack
- **React 18** (Vite)
- **Tailwind CSS** (Styling, Dark Mode, Responsive Design)
- **Recharts** (Data Visualization)
- **Lucide React** (Icons)
- **Gemini 3.5 Flash** (AI Parsing, Insights, and Chat)

## Setup Instructions

1. **Install Dependencies**
   ```bash
   npm install