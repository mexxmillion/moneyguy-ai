import { apiFetch, useUser } from '../UserContext';
import { useState, useEffect } from 'react';

function PinSection() {
  const { userId } = useUser();
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [status, setStatus] = useState(null);

  async function handleChangePin() {
    setStatus(null);
    if (newPin.length < 4) { setStatus({ type: 'error', message: 'PIN must be at least 4 characters' }); return; }
    if (newPin !== confirmPin) { setStatus({ type: 'error', message: 'PINs do not match' }); return; }
    try {
      const res = await fetch('/api/auth/set-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, pin: newPin, current_pin: currentPin }),
      });
      const data = await res.json();
      if (!res.ok) { setStatus({ type: 'error', message: data.error }); return; }
      setStatus({ type: 'success', message: 'PIN changed successfully' });
      setCurrentPin(''); setNewPin(''); setConfirmPin('');
    } catch {
      setStatus({ type: 'error', message: 'Connection error' });
    }
  }

  return (
    <div className="bg-gray-800 rounded-xl p-5 mb-6">
      <h2 className="text-lg font-semibold text-white mb-4">Change PIN</h2>
      <div className="space-y-3 max-w-xs">
        <input type="password" placeholder="Current PIN" value={currentPin} onChange={e => setCurrentPin(e.target.value)}
          className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 border border-gray-600 placeholder-gray-500" />
        <input type="password" placeholder="New PIN" value={newPin} onChange={e => setNewPin(e.target.value)}
          className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 border border-gray-600 placeholder-gray-500" />
        <input type="password" placeholder="Confirm New PIN" value={confirmPin} onChange={e => setConfirmPin(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleChangePin()}
          className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 border border-gray-600 placeholder-gray-500" />
        <button onClick={handleChangePin} disabled={!currentPin || !newPin || !confirmPin}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium">
          Update PIN
        </button>
      </div>
      {status && (
        <div className={`mt-3 text-sm px-3 py-2 rounded-lg max-w-xs ${status.type === 'error' ? 'bg-red-900 text-red-300' : 'bg-green-900 text-green-300'}`}>
          {status.message}
        </div>
      )}
      <p className="text-gray-500 text-xs mt-3">You can also change your PIN via Telegram: /changepin &lt;old&gt; &lt;new&gt;</p>
    </div>
  );
}

export default function Settings() {
  const [stats, setStats] = useState(null);
  const [pin, setPin] = useState('');
  const [scope, setScope] = useState('transactions');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    apiFetch('/api/admin/stats').then(r => r.json()).then(setStats);
  }, []);

  async function handleReset() {
    setLoading(true);
    setStatus(null);
    try {
      const res = await apiFetch('/api/admin/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, scope })
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus({ type: 'error', message: data.error });
      } else {
        setStatus({ type: 'success', message: data.message });
        setPin('');
        setConfirmOpen(false);
        // Refresh stats
        apiFetch('/api/admin/stats').then(r => r.json()).then(setStats);
      }
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    }
    setLoading(false);
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Settings</h1>

      {/* DB Stats */}
      {stats && (
        <div className="bg-gray-800 rounded-xl p-5 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Database</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-700 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-400">{stats.transactions}</div>
              <div className="text-gray-400 text-sm mt-1">Transactions</div>
            </div>
            <div className="bg-gray-700 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-400">{stats.statements}</div>
              <div className="text-gray-400 text-sm mt-1">Statements</div>
            </div>
            <div className="bg-gray-700 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-purple-400">{stats.accounts}</div>
              <div className="text-gray-400 text-sm mt-1">Accounts</div>
            </div>
          </div>
          {stats.dateRange.from && (
            <p className="text-gray-400 text-sm mt-3">
              Date range: {stats.dateRange.from} → {stats.dateRange.to}
            </p>
          )}
        </div>
      )}

      {/* Change PIN */}
      <PinSection />

      {/* Danger Zone */}
      <div className="bg-gray-800 rounded-xl p-5 border border-red-800">
        <h2 className="text-lg font-semibold text-red-400 mb-1">⚠️ Danger Zone</h2>
        <p className="text-gray-400 text-sm mb-4">This action cannot be undone. Enter your PIN to confirm.</p>

        <div className="mb-4">
          <label className="text-gray-300 text-sm block mb-1">What to delete</label>
          <select
            value={scope}
            onChange={e => setScope(e.target.value)}
            className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 border border-gray-600"
          >
            <option value="transactions">Transactions & Statements only (keep accounts)</option>
            <option value="all">Everything (full reset)</option>
          </select>
        </div>

        {!confirmOpen ? (
          <button
            onClick={() => setConfirmOpen(true)}
            className="bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            Reset Database...
          </button>
        ) : (
          <div className="space-y-3">
            <input
              type="password"
              placeholder="Enter PIN"
              value={pin}
              onChange={e => setPin(e.target.value)}
              className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 border border-gray-600 placeholder-gray-500"
              onKeyDown={e => e.key === 'Enter' && handleReset()}
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={handleReset}
                disabled={loading || !pin}
                className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                {loading ? 'Deleting...' : 'Confirm Reset'}
              </button>
              <button
                onClick={() => { setConfirmOpen(false); setPin(''); setStatus(null); }}
                className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {status && (
          <div className={`mt-3 text-sm px-3 py-2 rounded-lg ${status.type === 'error' ? 'bg-red-900 text-red-300' : 'bg-green-900 text-green-300'}`}>
            {status.message}
          </div>
        )}
      </div>
    </div>
  );
}
