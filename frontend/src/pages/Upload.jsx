import { useState, useRef } from 'react';

export default function Upload() {
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();

  const handleUpload = async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setResults(null);

    const formData = new FormData();
    for (const f of files) formData.append('files', f);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      setResults(data);
    } catch (err) {
      setResults({ error: err.message });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = ''; // reset so same file can be re-uploaded
    }
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
        Upload PDF bank statements (RBC Visa supported), CSV exports, or ZIP files containing multiple statements.
      </p>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current.click()}
        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
          dragOver ? 'border-emerald-500 bg-emerald-500/10' : 'border-gray-700 hover:border-gray-500'
        }`}
      >
        <div className="text-4xl mb-3">📄</div>
        <p className="text-gray-400">
          {uploading ? 'Processing...' : 'Drop files here or click to browse'}
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

      {/* Loading */}
      {uploading && (
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <div className="flex items-center gap-3">
            <div className="animate-spin w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full"></div>
            <span className="text-gray-300">Processing files...</span>
          </div>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 space-y-4">
          {results.error ? (
            <p className="text-red-400">{results.error}</p>
          ) : (
            <>
              <div className="flex items-center gap-2 text-emerald-400">
                <span>✓</span>
                <span className="font-medium">Imported {results.totalImported} transactions</span>
              </div>
              {results.results?.map((r, i) => (
                <div key={i} className="flex items-center justify-between text-sm border-t border-gray-800 pt-3">
                  <span className="text-gray-300">{r.filename}</span>
                  <div className="flex items-center gap-3">
                    {r.warning && <span className="text-amber-400 text-xs">{r.warning}</span>}
                    {r.error && <span className="text-red-400 text-xs">{r.error}</span>}
                    <span className={r.success ? 'text-emerald-400' : 'text-red-400'}>
                      {r.count} transactions
                    </span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
