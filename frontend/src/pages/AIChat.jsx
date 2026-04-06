import { useState, useRef, useEffect } from 'react';

export default function AIChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const submit = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const question = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: question }]);
    setLoading(true);

    try {
      const res = await fetch('/api/ai/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();

      if (data.error && !data.sql) {
        setMessages(prev => [...prev, { role: 'error', content: data.error }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', ...data }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'error', content: err.message }]);
    } finally {
      setLoading(false);
    }
  };

  const suggestions = [
    'How much did I spend on groceries in Feb 2026?',
    'What are my top 5 biggest purchases?',
    'Show all T&T purchases over $30',
    'Total spending by category this month',
    'Which merchant do I visit most?',
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <h2 className="text-lg font-semibold text-gray-200">AI Finance Assistant</h2>
      <p className="text-sm text-gray-500">Ask questions about your spending in natural language.</p>

      {/* Suggestions */}
      {messages.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s, i) => (
            <button key={i} onClick={() => { setInput(s); }}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs text-gray-400 border border-gray-700">
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
        {messages.map((msg, i) => (
          <div key={i}>
            {msg.role === 'user' && (
              <div className="flex justify-end">
                <div className="bg-emerald-600/20 border border-emerald-600/30 rounded-xl px-4 py-2.5 max-w-[80%]">
                  <p className="text-sm text-emerald-300">{msg.content}</p>
                </div>
              </div>
            )}
            {msg.role === 'error' && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2.5">
                <p className="text-sm text-red-400">{msg.content}</p>
              </div>
            )}
            {msg.role === 'assistant' && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
                {/* Summary */}
                <p className="text-sm text-gray-200">{msg.summary}</p>

                {/* SQL */}
                {msg.sql && (
                  <details className="text-xs">
                    <summary className="text-gray-500 cursor-pointer hover:text-gray-400">View SQL query</summary>
                    <pre className="mt-2 bg-gray-950 rounded-lg p-3 text-emerald-400 overflow-x-auto">{msg.sql}</pre>
                  </details>
                )}

                {/* Explanation */}
                {msg.explanation && (
                  <p className="text-xs text-gray-500 italic">{msg.explanation}</p>
                )}

                {/* Results table */}
                {msg.rows && msg.rows.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-500 border-b border-gray-800">
                          {Object.keys(msg.rows[0]).map(k => (
                            <th key={k} className="p-1.5 text-left font-medium">{k}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {msg.rows.slice(0, 50).map((row, ri) => (
                          <tr key={ri} className="border-b border-gray-800/50">
                            {Object.values(row).map((v, vi) => (
                              <td key={vi} className="p-1.5 text-gray-300">
                                {typeof v === 'number' ? v.toLocaleString() : String(v ?? '')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {msg.rowCount > 50 && (
                      <p className="text-xs text-gray-500 mt-2">Showing 50 of {msg.rowCount} results</p>
                    )}
                  </div>
                )}

                {msg.error && (
                  <p className="text-xs text-red-400">Query error: {msg.error}</p>
                )}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="animate-spin w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full"></div>
              <span className="text-sm text-gray-400">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={submit} className="flex gap-3">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask about your spending..."
          className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white focus:border-emerald-500 focus:outline-none"
          disabled={loading}
        />
        <button type="submit" disabled={loading || !input.trim()}
          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-xl text-sm font-medium text-white">
          Ask
        </button>
      </form>
    </div>
  );
}
