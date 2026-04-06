import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const UserContext = createContext({
  user: null,
  token: null,
  loading: true,
  login: () => {},
  logout: () => {},
});

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('moneyguy_token'));
  const [loading, setLoading] = useState(true);

  // Validate existing token on mount
  useEffect(() => {
    if (!token) { setLoading(false); return; }
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => { setUser(data.user); })
      .catch(() => { setToken(null); localStorage.removeItem('moneyguy_token'); })
      .finally(() => setLoading(false));
  }, [token]);

  const login = useCallback((newToken, newUser) => {
    localStorage.setItem('moneyguy_token', newToken);
    localStorage.setItem('moneyguy_user_id', String(newUser.id));
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    if (token) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    localStorage.removeItem('moneyguy_token');
    localStorage.removeItem('moneyguy_user_id');
    setToken(null);
    setUser(null);
  }, [token]);

  return (
    <UserContext.Provider value={{ user, userId: user?.id, token, loading, login, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}

/**
 * Drop-in fetch replacement that injects auth token.
 */
export function apiFetch(url, options = {}) {
  const token = localStorage.getItem('moneyguy_token') || '';
  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${token}`,
    'X-User-Id': localStorage.getItem('moneyguy_user_id') || '1',
  };
  return fetch(url, { ...options, headers });
}
