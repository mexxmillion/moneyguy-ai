import { useState } from 'react';
import Dashboard from './pages/Dashboard';
import Accounts from './pages/Accounts';
import Upload from './pages/Upload';
import Transactions from './pages/Transactions';
import AIChat from './pages/AIChat';
import Categories from './pages/Categories';
import Settings from './pages/Settings';
import Budgets from './pages/Budgets';
import Trends from './pages/Trends';
import Review from './pages/Review';
import Login from './pages/Login';
import ErrorBoundary from './components/ErrorBoundary';
import { UserProvider, useUser, apiFetch } from './UserContext';

const tabs = [
  { id: 'dashboard', label: 'Overview', icon: '📊' },
  { id: 'accounts', label: 'Accounts', icon: '🏦' },
  { id: 'transactions', label: 'Transactions', icon: '💰' },
  { id: 'upload', label: 'Upload', icon: '📁' },
  { id: 'ai', label: 'AI Query', icon: '🤖' },
  { id: 'trends', label: 'Trends', icon: '📈' },
  { id: 'review', label: 'Review', icon: '⚠️' },
  { id: 'budgets', label: 'Budgets', icon: '🎯' },
  { id: 'categories', label: 'Categories', icon: '🏷️' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

export default function App() {
  return (
    <UserProvider>
      <AppInner />
    </UserProvider>
  );
}

function AppInner() {
  const { user, loading, login, logout } = useUser();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [transactionsFilters, setTransactionsFilters] = useState({});
  const [reviewCount, setReviewCount] = useState(0);

  // Load review count on mount / user switch
  useState(() => {
    if (user) {
      apiFetch('/api/transactions/review').then(r => r.json()).then(d => setReviewCount(d.count || 0)).catch(() => {});
    }
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={login} />;
  }

  const openTransactions = (accountId) => {
    setTransactionsFilters(accountId ? { account_id: String(accountId) } : {});
    setActiveTab('transactions');
  };

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-emerald-400">MoneyGuy 2.0</h1>
          <span className="text-sm text-gray-400 bg-gray-800 px-3 py-1 rounded-full">
            {user.emoji} {user.name}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <nav className="flex gap-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-emerald-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <span className="mr-1.5">{tab.icon}</span>
                {tab.label}
                {tab.id === 'review' && reviewCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-amber-500 text-black text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {reviewCount}
                  </span>
                )}
              </button>
            ))}
          </nav>
          <button
            onClick={logout}
            className="ml-3 text-gray-500 hover:text-red-400 text-sm px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors"
            title="Log out"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="p-6 max-w-[1400px] mx-auto">
        <ErrorBoundary key={activeTab}>
          {activeTab === 'dashboard' && (
            <Dashboard
              onOpenAccounts={() => setActiveTab('accounts')}
              onOpenTransactions={openTransactions}
            />
          )}
          {activeTab === 'accounts' && <Accounts onOpenTransactions={openTransactions} />}
          {activeTab === 'upload' && <Upload />}
          {activeTab === 'transactions' && <Transactions initialFilters={transactionsFilters} />}
          {activeTab === 'ai' && <AIChat />}
          {activeTab === 'trends' && <Trends />}
          {activeTab === 'review' && <Review onBadgeCount={setReviewCount} />}
          {activeTab === 'budgets' && <Budgets />}
          {activeTab === 'categories' && <Categories />}
          {activeTab === 'settings' && <Settings />}
        </ErrorBoundary>
      </main>
    </div>
  );
}
