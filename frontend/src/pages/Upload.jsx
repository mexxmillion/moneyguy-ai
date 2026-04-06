import { useState, useRef } from 'react';

const STAGES = [
  { key: 'reading', label: 'Reading file…' },
  { key: 'extracting', label: 'Extracting transactions with AI…' },
  { key: 'saving', label: 'Saving to database…' },
  { key: 'done', label: 'Done!' },
];

export default function Upload() {
  const [uploading, setUploading] = useState(false);
  const [stage, setStage] = useState(0);
  const [results, setResults] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef();
  const abortRef = useRef(null);

  const reset = () => {
    setResults(null);
    setError(null);
    setUploading(false);
    setStage(0);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleUpload = async (files) => {
    if (!files || files.length === 0) return;
    reset();
    setUploading(true);
    setStage(0);

    const formData = new FormData();
    for (const f of files) formData.append('files', f);

    const controller = new AbortController();
    abortRef.current = controller;

    // Fake stage progression so user sees something happening
    setStage(1); // extracting
    const stageTimer = setTimeout(() => setStage(2), 8000); // saving after 8s

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(stageTimer);
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      setStage(3);
      setResults(data);
    } catch (err) {
      clearTimeout(stageTimer);
      if (err.name === 'AbortError') {
        setError('Upload cancelled.');
      } else {
        setError(err.message);
      }
    } finally {
      setUploading(false);
      abortRef.current = null;
    }
  };

  const cancel = () => {
    abortRef.current?.abort();
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleUpload(e.dataTransfer.files);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-lg font-semibold text-gray-200">Upload Statements</h2>
      <p className="text-sm text-gray-500">
        PDF bank statements, CSV exports, or ZIP files. AI extracts and categorizes automatically.
      </p>

      {/* Drop zone — always visible so you can queue another file */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => !uploading && fileRef.current.click()}
        className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
          uploading
            ? 'border-gray-800 cursor-not-allowed opacity-50'
            : dragOver
            ? 'border-emerald-500 bg-emerald-500/10 cursor-pointer'
            : 'border-gray-700 hover:border-gray-500 cursor-pointer'
        }`}
      >
        <div className="text-4xl mb-3">{uploading ? '⏳' : '📄'}</div>
        <p className="text-gray-400">
          {uploading ? STAGES[stage]?.label : 'Drop files here or click to browse'}
        </p>
        <p className="text-xs text-gray-600 mt-2">PDF, CSV, ZIP — up to 50MB</p>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept=".pdf,.csv,.zip"
          onChange={e => handleUpload(e.target.files)}
          className="hidden"
        />
      </div>

      {/* Progress */}
      {uploading && (
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="animate-spin w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full flex-shrink-0" />
              <span className="text-gray-300 text-sm">{STAGES[stage]?.label}</span>
            </div>
            <button onClick={cancel} className="text-xs text-gray-600 hover:text-rose-400 transition-colors">
              Cancel
            </button>
          </div>
          {/* Stage bar */}
          <div className="flex gap-1.5">
            {STAGES.slice(1, 4).map((s, i) => (
              <div key={s.key} className={`h-1 flex-1 rounded-full transition-all ${i + 1 <= stage ? 'bg-emerald-500' : 'bg-gray-800'}`} />
            ))}
          </div>
          <p className="text-xs text-gray-600">AI parsing can take 15–45 seconds for large PDFs. Hang tight.</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-rose-900/20 border border-rose-800/40 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <p className="text-rose-400 text-sm">⚠ {error}</p>
            <button onClick={reset} className="text-xs text-gray-500 hover:text-white">Try again</button>
          </div>
        </div>
      )}

      {/* Results */}
      {results && !uploading && (
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-400">
              <span>✓</span>
              <span className="font-medium">
                {results.totalImported ?? results.imported ?? 0} transactions imported
              </span>
            </div>
            <button onClick={reset} className="text-xs text-gray-500 hover:text-white">Upload another</button>
          </div>

          {results.results?.map((r, i) => (
            <div key={i} className="border-t border-gray-800 pt-3 space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-300 truncate flex-1 mr-3">{r.filename}</span>
                <span className={r.success ? 'text-emerald-400' : 'text-rose-400'}>
                  {r.success ? `✓ ${r.count} transactions` : '✗ Failed'}
                </span>
              </div>
              {(r.duplicates > 0 || r.flagged > 0) && (
                <p className="text-xs text-gray-600">
                  {r.duplicates > 0 && `${r.duplicates} duplicates skipped`}
                  {r.duplicates > 0 && r.flagged > 0 && ' · '}
                  {r.flagged > 0 && <span className="text-amber-500">{r.flagged} flagged for review</span>}
                </p>
              )}
              {r.warning && <p className="text-xs text-amber-400">{r.warning}</p>}
              {r.error && <p className="text-xs text-rose-400">{r.error}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
