'use client';

import { useState, useRef } from 'react';
import AppShell from '@/components/AppShell';

export default function ClientUpload() {
  const [queue, setQueue] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();
  const processing = useRef(false);

  const addFiles = (files) => {
    const items = Array.from(files).map(f => ({ id: Math.random(), file: f, status: 'pending', result: null, error: null }));
    setQueue(prev => {
      const updated = [...prev, ...items];
      setTimeout(() => processQueue(updated), 0);
      return updated;
    });
  };

  const processQueue = async (q) => {
    if (processing.current) return;
    processing.current = true;
    for (const item of q.filter(i => i.status === 'pending')) {
      setQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: 'uploading' } : i));
      const fd = new FormData();
      fd.append('files', item.file);
      try {
        const res = await fetch('/api/upload', { method: 'POST', body: fd });
        if (!res.ok) throw new Error(`Server ${res.status}`);
        const data = await res.json();
        setQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: 'done', result: data } : i));
      } catch (err) {
        setQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: 'error', error: err.message } : i));
      }
    }
    processing.current = false;
    setQueue(prev => {
      if (prev.some(i => i.status === 'pending')) setTimeout(() => processQueue(prev), 0);
      return prev;
    });
  };

  const doneCount = queue.filter(i => i.status === 'done').length;
  const totalImported = queue.filter(i => i.status === 'done').reduce((s, i) => s + (i.result?.imported ?? 0), 0);

  return (
    <AppShell title="Inbound" subtitle="Upload PDF, CSV, or ZIP statements. We'll parse, deduplicate, and categorise automatically.">
      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
        onClick={() => fileRef.current.click()}
        className={`surface-card relative overflow-hidden cursor-pointer rounded-[2rem] p-16 text-center transition-all ${dragOver ? 'ring-2 ring-[var(--primary)] bg-blue-50/60' : 'hover:bg-[var(--surface-muted)]'}`}
      >
        <div className="absolute -right-20 -bottom-20 h-64 w-64 rounded-full bg-[var(--primary)] opacity-5 blur-3xl" />
        <div className="relative">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--surface-soft)]">
            <span className="text-4xl">📥</span>
          </div>
          <h3 className="text-2xl font-bold">Drop your statements here</h3>
          <p className="mt-3 text-[var(--muted)]">Upload <strong>CSV, PDF,</strong> or <strong>ZIP</strong> files — we'll handle categorisation.</p>
          <p className="mt-2 text-xs text-[var(--muted)]">Up to 50MB · Multiple files OK</p>
        </div>
        <input ref={fileRef} type="file" multiple accept=".pdf,.csv,.zip" onChange={e => { addFiles(e.target.files); e.target.value = ''; }} className="hidden" />
      </div>

      {/* Queue */}
      {queue.length > 0 && (
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Import queue</h3>
            {doneCount > 0 && <button onClick={() => setQueue(q => q.filter(i => i.status !== 'done'))} className="text-sm text-[var(--muted)] hover:text-[var(--text)]">Clear done</button>}
          </div>
          {queue.map(item => {
            const { file, status, result, error } = item;
            const imported = result?.imported ?? result?.totalImported ?? 0;
            const dupes = result?.duplicates ?? 0;
            const flagged = result?.flagged ?? 0;
            return (
              <div key={item.id} className={`surface-card flex items-center gap-4 rounded-2xl px-5 py-4 ${status==='done'?'border-green-300/60':status==='error'?'border-red-300/60':status==='uploading'?'border-blue-300/60':''}`}>
                <div className="flex-shrink-0 w-8 text-center">
                  {status==='pending' && <span className="text-[var(--muted)]">⏳</span>}
                  {status==='uploading' && <div className="mx-auto h-5 w-5 rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin" />}
                  {status==='done' && <span className="text-[var(--secondary)] font-bold text-lg">✓</span>}
                  {status==='error' && <span className="text-[var(--tertiary)] font-bold">✗</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="truncate font-semibold text-sm">{file.name}</div>
                  <div className="mt-0.5 text-xs text-[var(--muted)]">
                    {status==='pending' && 'Waiting…'}
                    {status==='uploading' && <span className="text-[var(--primary)] animate-pulse">Processing with AI…</span>}
                    {status==='done' && <span className="text-[var(--secondary)]">{imported} imported{dupes>0?` · ${dupes} dupes skipped`:''}{ flagged>0?` · ${flagged} flagged`:''}</span>}
                    {status==='error' && <span className="text-[var(--tertiary)]">{error}</span>}
                  </div>
                </div>
                {status !== 'uploading' && <button onClick={() => setQueue(q => q.filter(i => i.id !== item.id))} className="text-[var(--muted)] hover:text-[var(--text)]">✕</button>}
              </div>
            );
          })}
        </div>
      )}

      {doneCount > 0 && (
        <div className="mt-4 rounded-2xl bg-green-50 border border-green-200 px-5 py-3 text-sm font-medium text-green-700">
          ✓ {doneCount} file{doneCount!==1?'s':''} processed · {totalImported} transactions imported
        </div>
      )}
    </AppShell>
  );
}
