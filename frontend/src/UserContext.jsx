import { createContext, useContext, useState, useEffect } from 'react';

const UserContext = createContext({ userId: 1, user: null, users: [], setUserId: () => {} });

export function UserProvider({ children }) {
  const [users, setUsers] = useState([]);
  const [userId, setUserIdRaw] = useState(() => {
    const stored = localStorage.getItem('moneyguy_user_id');
    return stored ? parseInt(stored) : 1;
  });

  useEffect(() => {
    fetch('/api/users').then(r => r.json()).then(setUsers).catch(() => {});
  }, []);

  const setUserId = (id) => {
    setUserIdRaw(id);
    localStorage.setItem('moneyguy_user_id', String(id));
  };

  const user = users.find(u => u.id === userId) || null;

  return (
    <UserContext.Provider value={{ userId, user, users, setUserId }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}

/**
 * Drop-in fetch replacement that injects X-User-Id header.
 */
export function apiFetch(url, options = {}) {
  const userId = localStorage.getItem('moneyguy_user_id') || '1';
  const headers = { ...options.headers, 'X-User-Id': userId };
  return fetch(url, { ...options, headers });
}
