import { useEffect, useRef, useState } from 'react';
import type { VisualStackProject } from '../types/project';
import { errorMessage } from '../api/client';
import { parseJsonToDesign } from '../utils/jsonToDesign';

interface JsonToDesignModalProps {
  theme: 'dark' | 'light';
  onClose: () => void;
  onConvert: (project: VisualStackProject) => void;
}

const detailedTemplate = `{
  "architecture": "Secure Web Application",
  "clusters": [
    {
      "id": "application-layer",
      "title": "Application & Data Layer",
      "x": 300,
      "y": 70,
      "width": 700,
      "height": 340
    }
  ],
  "components": [
    {
      "id": "client",
      "name": "Web Client",
      "type": "Frontend",
      "technology": "React",
      "version": "18",
      "description": "Renders the user interface and sends requests to the API.",
      "specs": ["Authentication: OAuth 2.0", "Hosting: CDN"]
    },
    {
      "id": "gateway",
      "name": "API Gateway",
      "type": "Router / Proxy",
      "clusterId": "application-layer",
      "technology": "Nginx",
      "description": "Routes requests, validates tokens, and applies rate limits.",
      "protocol": "HTTPS",
      "specs": ["Rate limit: 100 requests/min", "TLS: 1.3"]
    },
    {
      "id": "api",
      "name": "Application API",
      "type": "Backend Service",
      "clusterId": "application-layer",
      "technology": "Node.js",
      "description": "Applies business rules and coordinates data access.",
      "specs": ["Runtime: Node.js 20", "Scaling: 3-10 replicas"]
    },
    {
      "id": "database",
      "name": "Primary Database",
      "type": "Database",
      "clusterId": "application-layer",
      "technology": "PostgreSQL",
      "description": "Stores application records with automated backups.",
      "specs": ["Storage: encrypted", "Backup: daily"]
    }
  ],
  "connections": [
    { "from": "client", "to": "gateway", "label": "HTTPS", "style": "SOLID" },
    { "from": "gateway", "to": "api", "label": "REST / JSON", "style": "SOLID" },
    { "from": "api", "to": "database", "label": "SQL", "style": "DOTTED" }
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

        <div className="vs-json-design__guide">
          <div className="vs-json-design__template-action">
            <div>
              <strong>Start from a detailed template</strong>
              <span style={{ color: muted }}>Includes components, technologies, specifications, and labeled connections.</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setJsonText(detailedTemplate);
                setFileName('');
                setError('');
              }}
            >
              Insert template
            </button>
          </div>
          <details>
            <summary>JSON guide: fields and connection rules</summary>
            <ul>
              <li><code>architecture</code> (or <code>title</code>) names the design.</li>
              <li>Use <code>components</code> or <code>nodes</code>; each component should have a unique <code>id</code> and a readable <code>name</code>.</li>
              <li>Add <code>type</code>, <code>technology</code>, <code>version</code>, <code>description</code>, <code>protocol</code>, and <code>specs</code> to make cards more informative.</li>
              <li>Optionally group components with a <code>clusters</code> array and matching <code>clusterId</code>; use <code>x</code>, <code>y</code>, <code>width</code>, and <code>height</code> to control placement and size.</li>
              <li>Connections use <code>from</code>/<code>to</code> or <code>source</code>/<code>target</code>. Values must match component IDs or unique component names.</li>
              <li>Use <code>label</code> to name a connection and <code>style</code> as <code>SOLID</code> or <code>DOTTED</code>. Specs can be text or <code>{'{ "label": "Availability", "value": "99.9%" }'}</code> objects.</li>
            </ul>
          </details>
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
          onChange={(event) => { setJsonText(event.target.value); setFileName(''); setError(''); }}
          placeholder="Insert the detailed template above, type JSON, or upload a .json file."
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
