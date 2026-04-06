import { useState, useRef } from 'react';

export default function Upload() {
  const [queue, setQueue] = useState([]); // { file, status: 'pending'|'uploading'|'done'|'error', result, error }
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();
  const processingRef = useRef(false);

  const addFiles = (files) => {
    const newItems = Array.from(files).map(f => ({ id: Math.random(), file: f, status: 'pending', result: null, error: null }));
    setQueue(prev => {
      const updated = [...prev, ...newItems];
      // Kick off processing after state update
      setTimeout(() => processQueue(updated), 0);
      return updated;
    });
  };

  const processQueue = async (currentQueue) => {
    if (processingRef.current) return;
    processingRef.current = true;

    // Find pending items
    const pending = currentQueue.filter(i => i.status === 'pending');
    for (const item of pending) {
      // Mark uploading
      setQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: 'uploading' } : i));

      const formData = new FormData();
      formData.append('files', item.file);

      try {
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        if (!res.ok) throw new Error(`Server error ${res.status}`);
        const data = await res.json();
        setQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: 'done', result: data } : i));
      } catch (err) {
        setQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: 'error', error: err.message } : i));
      }
    }

    processingRef.current = false;

    // Check if more were added while we were processing
    setQueue(prev => {
      const stillPending = prev.filter(i => i.status === 'pending');
      if (stillPending.length > 0) {
        setTimeout(() => processQueue(prev), 0);
      }
      return prev;
    });
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  };

  const clearDone = () => setQueue(prev => prev.filter(i => i.status === 'pending' || i.status === 'uploading'));

  const isProcessing = queue.some(i => i.status === 'uploading');
  const doneCount = queue.filter(i => i.status === 'done').length;
  const totalImported = queue.filter(i => i.status === 'done').reduce((s, i) => s + (i.result?.imported ?? i.result?.totalImported ?? 0), 0);

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-200">Upload Statements</h2>
          <p className="text-sm text-gray-500 mt-0.5">PDF, CSV, or ZIP — drop multiple files, they'll process one by one</p>
        </div>
        {doneCount > 0 && (
          <button onClick={clearDone} className="text-xs text-gray-500 hover:text-gray-300">Clear done</button>
        )}
      </div>

      {/* Drop zone — always active */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current.click()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
          dragOver ? 'border-emerald-500 bg-emerald-500/10 scale-[1.01]' : 'border-gray-700 hover:border-gray-500 hover:bg-gray-900/30'
        }`}
      >
        <div className="text-3xl mb-2">📂</div>
        <p className="text-gray-400 text-sm">Drop files here or click to browse</p>
        <p className="text-xs text-gray-600 mt-1">PDF · CSV · ZIP — up to 50MB each · multiple files OK</p>
        <input ref={fileRef} type="file" multiple accept=".pdf,.csv,.zip"
          onChange={e => { addFiles(e.target.files); e.target.value = ''; }}
          className="hidden" />
      </div>

      {/* Queue */}
      {queue.length > 0 && (
        <div className="space-y-2">
          {queue.map(item => (
            <FileRow key={item.id} item={item} onRemove={() => setQueue(prev => prev.filter(i => i.id !== item.id))} />
          ))}
        </div>
      )}

      {/* Summary */}
      {doneCount > 0 && (
        <div className="bg-emerald-900/20 border border-emerald-800/40 rounded-xl px-5 py-3 text-sm text-emerald-400">
          ✓ {doneCount} file{doneCount !== 1 ? 's' : ''} processed · {totalImported} transactions imported
        </div>
      )}
    </div>
  );
}

function FileRow({ item, onRemove }) {
  const { file, status, result, error } = item;
  const r = result?.results?.[0] || result;
  const imported = result?.imported ?? result?.totalImported ?? 0;
  const dupes = result?.duplicates ?? 0;
  const flagged = result?.flagged ?? 0;

  return (
    <div className={`bg-gray-900 border rounded-xl px-4 py-3 flex items-center gap-3 transition-all ${
      status === 'done' ? 'border-emerald-800/40' :
      status === 'error' ? 'border-rose-800/40' :
      status === 'uploading' ? 'border-blue-800/40' :
      'border-gray-800'
    }`}>
      {/* Status icon */}
      <div className="flex-shrink-0 w-6 text-center">
        {status === 'pending'   && <span className="text-gray-600 text-sm">⏳</span>}
        {status === 'uploading' && <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto" />}
        {status === 'done'      && <span className="text-emerald-400 text-sm">✓</span>}
        {status === 'error'     && <span className="text-rose-400 text-sm">✗</span>}
      </div>

      {/* File info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-200 truncate">{file.name}</p>
        <p className="text-xs text-gray-600 mt-0.5">
          {status === 'pending'   && 'Waiting…'}
          {status === 'uploading' && <span className="text-blue-400 animate-pulse">Processing with AI…</span>}
          {status === 'done'      && (
            <span className="text-emerald-400">
              {imported} imported
              {dupes > 0 && <span className="text-gray-500"> · {dupes} dupes skipped</span>}
              {flagged > 0 && <span className="text-amber-400"> · {flagged} flagged</span>}
            </span>
          )}
          {status === 'error'     && <span className="text-rose-400">{error}</span>}
        </p>
      </div>

      {/* Remove button (only if not uploading) */}
      {status !== 'uploading' && (
        <button onClick={onRemove} className="text-gray-700 hover:text-gray-400 text-sm flex-shrink-0">✕</button>
      )}
    </div>
  );
}
