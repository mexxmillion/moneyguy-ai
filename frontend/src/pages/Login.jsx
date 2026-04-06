import { useState, useEffect } from 'react';

export default function Login({ onLogin }) {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [pin, setPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [mode, setMode] = useState('select'); // select | login | setup

  useEffect(() => {
    fetch('/api/auth/users')
      .then(r => r.json())
      .then(setUsers)
      .catch(() => setError('Cannot connect to server'));
  }, []);

  function selectUser(user) {
    setSelectedUser(user);
    setPin('');
    setNewPin('');
    setConfirmPin('');
    setError('');
    setMode(user.has_pin ? 'login' : 'setup');
  }

  function goBack() {
    setMode('select');
    setSelectedUser(null);
    setError('');
    setPin('');
    setNewPin('');
    setConfirmPin('');
  }

  async function handleLogin() {
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: selectedUser.id, pin }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      onLogin(data.token, data.user);
    } catch {
      setError('Connection error');
    }
  }

  async function handleSetPin() {
    setError('');
    if (newPin.length < 4) { setError('PIN must be at least 4 digits'); return; }
    if (newPin !== confirmPin) { setError('PINs don\'t match'); return; }
    try {
      const res = await fetch('/api/auth/set-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: selectedUser.id, pin: newPin }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: selectedUser.id, pin: newPin }),
      });
      const loginData = await loginRes.json();
      if (!loginRes.ok) { setError(loginData.error); return; }
      onLogin(loginData.token, loginData.user);
    } catch {
      setError('Connection error');
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl p-8 w-full max-w-sm border border-gray-800 shadow-2xl">
        <h1 className="text-2xl font-bold text-emerald-400 text-center mb-6">MoneyGuy 2.0</h1>

        {/* Step 1: Pick your user */}
        {mode === 'select' && (
          <>
            <p className="text-gray-400 text-center text-sm mb-5">Who's this?</p>
            <div className="space-y-3">
              {users.map(u => (
                <button
                  key={u.id}
                  onClick={() => selectUser(u)}
                  className="w-full flex items-center gap-4 bg-gray-800 hover:bg-gray-700 rounded-xl p-4 transition-colors"
                >
                  <span className="text-3xl">{u.emoji}</span>
                  <span className="text-white text-lg font-medium">{u.name}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Step 2a: Enter existing PIN */}
        {mode === 'login' && selectedUser && (
          <>
            <div className="text-center mb-5">
              <span className="text-4xl">{selectedUser.emoji}</span>
              <p className="text-white font-medium mt-2">{selectedUser.name}</p>
            </div>
            <input
              type="password"
              inputMode="numeric"
              placeholder="PIN"
              value={pin}
              onChange={e => setPin(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && pin && handleLogin()}
              className="w-full bg-gray-800 text-white text-center text-2xl tracking-[0.5em] rounded-xl px-4 py-4 border border-gray-700 focus:border-emerald-500 focus:outline-none mb-4 placeholder:text-gray-600 placeholder:tracking-normal placeholder:text-base"
              autoFocus
            />
            <button
              onClick={handleLogin}
              disabled={!pin}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors mb-3"
            >
              Log In
            </button>
            <button onClick={goBack} className="w-full text-gray-500 hover:text-gray-300 text-sm py-2">
              Not you? Go back
            </button>
          </>
        )}

        {/* Step 2b: First-time PIN setup */}
        {mode === 'setup' && selectedUser && (
          <>
            <div className="text-center mb-4">
              <span className="text-4xl">{selectedUser.emoji}</span>
              <p className="text-white font-medium mt-2">{selectedUser.name}</p>
            </div>
            <div className="bg-emerald-900/30 border border-emerald-800 rounded-lg px-4 py-3 mb-5">
              <p className="text-emerald-300 text-sm font-medium mb-1">First time here!</p>
              <p className="text-emerald-400/70 text-xs">Pick a PIN you'll use to log in. At least 4 digits. You can also set this via Telegram with /setpin.</p>
            </div>
            <input
              type="password"
              inputMode="numeric"
              placeholder="Choose PIN"
              value={newPin}
              onChange={e => setNewPin(e.target.value)}
              className="w-full bg-gray-800 text-white text-center text-2xl tracking-[0.5em] rounded-xl px-4 py-4 border border-gray-700 focus:border-emerald-500 focus:outline-none mb-3 placeholder:text-gray-600 placeholder:tracking-normal placeholder:text-base"
              autoFocus
            />
            <input
              type="password"
              inputMode="numeric"
              placeholder="Confirm PIN"
              value={confirmPin}
              onChange={e => setConfirmPin(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && newPin && confirmPin && handleSetPin()}
              className="w-full bg-gray-800 text-white text-center text-2xl tracking-[0.5em] rounded-xl px-4 py-4 border border-gray-700 focus:border-emerald-500 focus:outline-none mb-4 placeholder:text-gray-600 placeholder:tracking-normal placeholder:text-base"
            />
            <button
              onClick={handleSetPin}
              disabled={!newPin || !confirmPin}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors mb-3"
            >
              Set PIN & Log In
            </button>
            <button onClick={goBack} className="w-full text-gray-500 hover:text-gray-300 text-sm py-2">
              Not you? Go back
            </button>
          </>
        )}

        {error && (
          <div className="mt-4 text-sm text-red-400 bg-red-400/10 rounded-lg px-3 py-2 text-center">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
