'use client';

import { useState, useRef, useEffect } from 'react';
import AppShell from '@/components/AppShell';

const SUGGESTIONS = [
  'How much did I spend on groceries in Feb 2026?',
  'What are my top 5 biggest purchases?',
  'Show all T&T purchases over $30',
  'Total spending by category this month',
  'Which merchant do I visit most?',
];

export default function ClientAI() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef();

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const submit = async (e) => {
    e?.preventDefault();
    if (!input.trim() || loading) return;
    const question = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: question }]);
    setLoading(true);
    try {
      const res = await fetch('/api/ai/query', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question }) });
      const data = await res.json();
      if (data.error && !data.sql) setMessages(prev => [...prev, { role: 'error', content: data.error }]);
      else setMessages(prev => [...prev, { role: 'assistant', ...data }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'error', content: err.message }]);
    }
    setLoading(false);
  };

  return (
    <AppShell title="Intelligence for your financial future." subtitle="Ask anything about your money in natural language.">
      {/* Hero search + suggestions */}
      {messages.length === 0 && (
        <div className="flex flex-col items-center py-8 text-center">
          <div className="mt-6 flex flex-wrap justify-center gap-3 max-w-2xl">
            {SUGGESTIONS.map((s, i) => (
              <button key={i} onClick={() => setInput(s)}
                className="rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-5 py-2.5 text-sm font-medium text-[var(--muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--text)] transition-colors">
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="space-y-4 max-h-[56vh] overflow-y-auto mb-6 pr-1">
        {messages.map((msg, i) => (
          <div key={i}>
            {msg.role === 'user' && (
              <div className="flex justify-end">
                <div className="primary-gradient rounded-[1.25rem] rounded-tr-sm px-5 py-3 max-w-[80%] text-white shadow-lg shadow-blue-200/50">
                  <p className="text-sm font-medium">{msg.content}</p>
                </div>
              </div>
            )}
            {msg.role === 'error' && (
              <div className="rounded-[1.25rem] border border-red-200 bg-red-50 px-5 py-4">
                <p className="text-sm text-red-600">{msg.content}</p>
              </div>
            )}
            {msg.role === 'assistant' && (
              <div className="surface-card rounded-[1.5rem] p-6 space-y-4">
                <p className="text-sm leading-relaxed">{msg.summary}</p>
                {msg.sql && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-[var(--muted)] hover:text-[var(--text)]">View SQL query</summary>
                    <pre className="mt-2 rounded-xl bg-[var(--surface-muted)] p-3 text-[var(--primary)] overflow-x-auto text-xs">{msg.sql}</pre>
                  </details>
                )}
                {msg.explanation && <p className="text-xs text-[var(--muted)] italic">{msg.explanation}</p>}
                {msg.rows && msg.rows.length > 0 && (
                  <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
                    <table className="w-full text-xs">
                      <thead className="bg-[var(--surface-muted)]">
                        <tr>{Object.keys(msg.rows[0]).map(k => <th key={k} className="px-3 py-2 text-left font-semibold text-[var(--muted)]">{k}</th>)}</tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {msg.rows.slice(0, 50).map((row, ri) => (
                          <tr key={ri} className="hover:bg-[var(--surface-muted)]">
                            {Object.values(row).map((v, vi) => <td key={vi} className="px-3 py-2">{typeof v === 'number' ? v.toLocaleString() : String(v ?? '')}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {msg.rowCount > 50 && <p className="px-3 py-2 text-xs text-[var(--muted)]">Showing 50 of {msg.rowCount} results</p>}
                  </div>
                )}
                {msg.error && <p className="text-xs text-red-600">Query error: {msg.error}</p>}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="surface-card rounded-[1.5rem] p-5">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin" />
              <span className="text-sm text-[var(--muted)]">Thinking…</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={submit} className="flex gap-3 sticky bottom-0 bg-[var(--background)] py-2">
        <div className="flex-1 relative surface-card rounded-full overflow-hidden flex items-center">
          <span className="ml-4 text-[var(--primary)] text-xl">✦</span>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask anything about your money…"
            disabled={loading}
            className="flex-1 bg-transparent px-4 py-4 text-sm focus:outline-none"
          />
        </div>
        <button type="submit" disabled={loading || !input.trim()}
          className="primary-gradient rounded-full px-7 py-4 text-sm font-bold text-white shadow-lg shadow-blue-200/50 disabled:opacity-40 transition-opacity">
          SEND
        </button>
      </form>
    </AppShell>
  );
}
