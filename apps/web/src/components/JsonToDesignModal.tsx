import { useEffect, useRef, useState } from 'react';
import type { VisualStackProject } from '../types/project';
import { errorMessage } from '../api/client';
import { parseJsonToDesign } from '../utils/jsonToDesign';

interface JsonToDesignModalProps {
  theme: 'dark' | 'light';
  onClose: () => void;
  onConvert: (project: VisualStackProject) => void;
}

const exampleJson = `{
  "title": "My Architecture",
  "nodes": [
    { "id": "web", "name": "Web App", "type": "Frontend" },
    { "id": "api", "name": "API", "type": "Backend" }
  ],
  "connections": [
    { "source": "web", "target": "api", "label": "HTTPS" }
  ]
}`;

export function JsonToDesignModal({ theme, onClose, onConvert }: JsonToDesignModalProps) {
  const isDark = theme === 'dark';
  const [mode, setMode] = useState<'write' | 'upload'>('write');
  const [jsonText, setJsonText] = useState('');
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const contents = await file.text();
      setJsonText(contents);
      setFileName(file.name);
      setError('');
    } catch (err) {
      setError(`Could not read the selected file: ${errorMessage(err)}`);
    }
  };

  const handleConvert = () => {
    try {
      const design = parseJsonToDesign(JSON.parse(jsonText));
      onConvert(design);
    } catch (err) {
      setError(err instanceof SyntaxError ? 'This is not valid JSON. Check the text and try again.' : errorMessage(err, 'Could not turn this JSON into a design.'));
    }
  };

  const surface = isDark ? '#0f172a' : '#ffffff';
  const foreground = isDark ? '#e2e8f0' : '#0f172a';
  const muted = isDark ? '#94a3b8' : '#64748b';
  const line = isDark ? '#334155' : '#dbe3eb';

  return (
    <div
      className="vs-json-design__backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="vs-json-design"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vs-json-design-title"
        style={{ background: surface, color: foreground, borderColor: line }}
      >
        <header className="vs-json-design__header">
          <div>
            <h2 id="vs-json-design-title">Turn JSON into a design</h2>
            <p style={{ color: muted }}>Write or upload a project description in JSON, then create a synchronized architecture.</p>
          </div>
          <button type="button" className="vs-json-design__close" aria-label="Close" onClick={onClose}>×</button>
        </header>

        <div className="vs-json-design__modes" role="tablist" aria-label="Choose how to provide JSON">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'write'}
            className={mode === 'write' ? 'is-active' : ''}
            onClick={() => { setMode('write'); setError(''); }}
          >
            Write JSON
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'upload'}
            className={mode === 'upload' ? 'is-active' : ''}
            onClick={() => { setMode('upload'); setError(''); }}
          >
            Upload JSON
          </button>
        </div>

        {mode === 'upload' && (
          <div className="vs-json-design__upload">
            <input ref={fileInputRef} type="file" accept=".json,application/json" onChange={handleFileChange} hidden />
            <button type="button" onClick={() => fileInputRef.current?.click()}>Choose a .json file</button>
            <span style={{ color: muted }}>{fileName || 'The file contents will appear below for review.'}</span>
          </div>
        )}

        <label className="vs-json-design__label" htmlFor="vs-json-design-input">
          Project JSON
        </label>
        <textarea
          id="vs-json-design-input"
          value={jsonText}
          onChange={(event) => { setJsonText(event.target.value); setError(''); }}
          placeholder={exampleJson}
          spellCheck={false}
          style={{ background: isDark ? '#020617' : '#f8fafc', color: foreground, borderColor: line }}
        />
        {error && <p className="vs-json-design__error" role="alert">{error}</p>}

        <footer className="vs-json-design__footer">
          <span style={{ color: muted }}>The result updates Clean, Detailed 2D, and 3D views.</span>
          <div>
            <button type="button" className="vs-json-design__cancel" onClick={onClose}>Cancel</button>
            <button type="button" className="vs-json-design__convert" onClick={handleConvert} disabled={!jsonText.trim()}>
              Turn into a design
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
