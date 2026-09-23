import { useState, useEffect, useRef, type ComponentType } from 'react';
import * as IsoflowModule from 'isoflow';
import { Architecture2D } from './Architecture2D';
import { CleanArchitectureView } from './CleanArchitectureView';
import {
  loadSavedProject,
  saveProjectToStorage,
  exportProjectAsJSON,
  encodeProjectToHash,
  decodeProjectFromHash,
  exportSvgToPng
} from './utils/storage';
import type { VisualStackProject } from './types/project';
import { convertProjectToIsoflowData } from './utils/isoflowAdapter';
import { useProjectHistory } from './utils/useProjectHistory';

// Safely resolve Isoflow component export across Vite ESM/CJS boundaries
const getIsoflowComponent = (): ComponentType<Record<string, unknown>> => {
  const mod = IsoflowModule as Record<string, unknown>;
  if (typeof mod.Isoflow === 'function') return mod.Isoflow as ComponentType<Record<string, unknown>>;
  if (typeof mod.default === 'function') return mod.default as ComponentType<Record<string, unknown>>;
  const def = mod.default as Record<string, unknown> | undefined;
  if (def && typeof def.default === 'function') return def.default as ComponentType<Record<string, unknown>>;
  return () => <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Isoflow unavailable</div>;
};

const IsoflowComponent = getIsoflowComponent();

export default function App() {
  // Load from URL hash if available; otherwise fall back to localStorage
  const initialProjectState = () => {
  const fromUrl = decodeProjectFromHash();
  if (fromUrl) return fromUrl;
  return loadSavedProject();
};

const {
  project,
  updateProject: historyUpdateProject,
  setProjectDirect,
  undo,
  redo,
  canUndo,
  canRedo
} = useProjectHistory(initialProjectState());
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-save & sync state
// Global Shortcut listener for Undo (Ctrl+Z) & Redo (Ctrl+Y / Ctrl+Shift+Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        activeEl?.getAttribute('contenteditable') === 'true';

      if (isInput) return;

      const isModifier = e.ctrlKey || e.metaKey;

      if (isModifier && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if (isModifier && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [undo, redo]);

  const updateProject = (updater: (prev: VisualStackProject) => VisualStackProject) => {
    setSaveStatus('saving');
    historyUpdateProject(updater);
  };

  const updateTitle = (newTitle: string) => {
    updateProject((prev) => ({ ...prev, title: newTitle }));
  };

  // Copy shareable link
  const handleCopyShareLink = () => {
    const hash = encodeProjectToHash(project);
    const fullUrl = `${window.location.origin}${window.location.pathname}${hash}`;
    navigator.clipboard.writeText(fullUrl).then(() => {
      alert('Shareable link copied to clipboard!');
    });
  };

  // PNG Export Handler
  const handleExportPng = (copyToClipboard = false) => {
    let selector = '#aegisot-clean-svg';
    let filename = `${project.title.toLowerCase().replace(/\s+/g, '-')}-clean.png`;

    if (project.activeTab === '2d') {
      selector = '#aegisot-2d-svg';
      filename = `${project.title.toLowerCase().replace(/\s+/g, '-')}-2d.png`;
    } else if (project.activeTab === '3d') {
      selector = 'svg';
      filename = `${project.title.toLowerCase().replace(/\s+/g, '-')}-3d.png`;
    }

    const svgEl = document.querySelector(selector) as SVGElement | null;
    if (!svgEl) {
      alert('No SVG element detected for export.');
      return;
    }

    exportSvgToPng(svgEl, filename, copyToClipboard);
  };

  const exportCurrentSvg = () => {
    let selector = '#aegisot-clean-svg';
    let filename = `${project.title.toLowerCase().replace(/\s+/g, '-')}-clean.svg`;

    if (project.activeTab === '2d') {
      selector = '#aegisot-2d-svg';
      filename = `${project.title.toLowerCase().replace(/\s+/g, '-')}-2d.svg`;
    } else if (project.activeTab === '3d') {
      selector = 'svg';
      filename = `${project.title.toLowerCase().replace(/\s+/g, '-')}-3d.svg`;
    }

    const svgEl = document.querySelector(selector) as SVGElement | null;
    if (!svgEl) {
      alert('No SVG element detected for export.');
      return;
    }

    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svgEl);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = filename;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);
  };

 const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const parsed = JSON.parse(event.target?.result as string);
      if (parsed.title && (parsed.cleanView || parsed.detailed2DView)) {
        setProjectDirect(parsed);
        saveProjectToStorage(parsed);
      } else {
        alert('Invalid VisualStack design file format.');
      }
    } catch {
      alert('Failed to parse JSON file.');
    }
  };
  reader.readAsText(file);
};
  const isDark = theme === 'dark';

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: isDark ? '#0f172a' : '#f8fafc',
        color: isDark ? '#f8fafc' : '#0f172a',
        overflow: 'hidden'
      }}
    >
      {/* Top Header */}
      <header
        style={{
          height: '56px',
          background: isDark ? '#1e293b' : '#ffffff',
          borderBottom: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          zIndex: 100,
          flexShrink: 0
        }}
      >
        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '18px', fontWeight: '800', color: '#0284c7' }}>
            VisualStack
          </span>
          <span style={{ color: isDark ? '#475569' : '#cbd5e1' }}>/</span>
          <input
            type="text"
            value={project.title}
            onChange={(e) => updateTitle(e.target.value)}
            style={{
              fontSize: '14px',
              fontWeight: '600',
              padding: '4px 8px',
              borderRadius: '6px',
              border: '1px solid transparent',
              background: 'transparent',
              color: isDark ? '#f8fafc' : '#0f172a',
              outline: 'none',
              maxWidth: '200px'
            }}
          />
          <span style={{ fontSize: '11px', color: saveStatus === 'saving' ? '#d97706' : '#16a34a' }}>
            {saveStatus === 'saving' ? '● Saving...' : '✓ Saved'}
          </span>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: 'flex',
            background: isDark ? '#0f172a' : '#f1f5f9',
            padding: '3px',
            borderRadius: '8px',
            border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
            gap: '4px'
          }}
        >
          {(['clean', '2d', '3d'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => updateProject((prev) => ({ ...prev, activeTab: tab }))}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '12px',
                background: project.activeTab === tab ? '#0284c7' : 'transparent',
                color: project.activeTab === tab ? '#ffffff' : isDark ? '#94a3b8' : '#64748b'
              }}
            >
              {tab === 'clean' ? 'Clean Diagram' : tab === '2d' ? 'Detailed 2D View' : '3D Isometric'}
            </button>
          ))}
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="file"
            ref={fileInputRef}
            accept=".json"
            onChange={handleImportJSON}
            style={{ display: 'none' }}
          />

          <button
            onClick={handleCopyShareLink}
            style={{
              background: '#0284c7',
              color: '#fff',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            🔗 Share Link
          </button>

          <button
            onClick={() => handleExportPng(false)}
            style={{
              background: '#10b981',
              color: '#fff',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Export PNG
          </button>

          <button
            onClick={() => handleExportPng(true)}
            title="Copy high-res image to clipboard"
            style={{
              background: isDark ? '#334155' : '#e2e8f0',
              color: isDark ? '#f8fafc' : '#0f172a',
              border: 'none',
              padding: '6px 10px',
              borderRadius: '6px',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            📋 Copy Image
          </button>

          <button
            onClick={exportCurrentSvg}
            style={{
              background: 'transparent',
              border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
              color: isDark ? '#cbd5e1' : '#475569',
              padding: '6px 10px',
              borderRadius: '6px',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            Export SVG
          </button>

          <button
            onClick={() => exportProjectAsJSON(project)}
            style={{
              background: 'transparent',
              border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
              color: isDark ? '#cbd5e1' : '#475569',
              padding: '6px 10px',
              borderRadius: '6px',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            JSON
          </button>

          <button
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            style={{
              background: isDark ? '#334155' : '#e2e8f0',
              color: isDark ? '#f8fafc' : '#0f172a',
              border: 'none',
              padding: '6px 10px',
              borderRadius: '6px',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            {isDark ? '☀️' : '🌙'}
          </button>
        </div>
        {/* Undo / Redo HUD */}
<div style={{ display: 'flex', gap: '4px' }}>
  <button
    onClick={undo}
    disabled={!canUndo}
    title="Undo (Ctrl + Z)"
    style={{
      background: isDark ? '#334155' : '#e2e8f0',
      color: isDark ? '#f8fafc' : '#0f172a',
      border: 'none',
      borderRadius: '6px',
      padding: '6px 10px',
      fontSize: '12px',
      fontWeight: 'bold',
      cursor: canUndo ? 'pointer' : 'not-allowed',
      opacity: canUndo ? 1 : 0.4
    }}
  >
    ↩
  </button>
  <button
    onClick={redo}
    disabled={!canRedo}
    title="Redo (Ctrl + Y)"
    style={{
      background: isDark ? '#334155' : '#e2e8f0',
      color: isDark ? '#f8fafc' : '#0f172a',
      border: 'none',
      borderRadius: '6px',
      padding: '6px 10px',
      fontSize: '12px',
      fontWeight: 'bold',
      cursor: canRedo ? 'pointer' : 'not-allowed',
      opacity: canRedo ? 1 : 0.4
    }}
  >
    ↪
  </button>
</div>
      </header>

      {/* Main Workspace */}
      <main style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {project.activeTab === 'clean' && (
          <CleanArchitectureView
            theme={theme}
            clusters={project.cleanView?.clusters ?? []}
            nodes={project.cleanView?.nodes ?? []}
            connectors={project.cleanView?.connectors ?? []}
            onChange={(data) =>
              updateProject((prev) => ({
                ...prev,
                cleanView: data
              }))
            }
          />
        )}
        {project.activeTab === '2d' && (
          <Architecture2D
            theme={theme}
            nodes={project.detailed2DView?.nodes ?? []}
            connectors={project.detailed2DView?.connectors ?? []}
            onChange={(data) =>
              updateProject((prev) => ({
                ...prev,
                detailed2DView: data
              }))
            }
          />
        )}
       {project.activeTab === '3d' && (
          <div style={{ width: '100%', height: '100%' }}>
            <IsoflowComponent
              key={`${project.updatedAt}-${project.cleanView.nodes.length}`}
              initialData={convertProjectToIsoflowData(project)}
              editorMode="EDITABLE"
              width="100%"
              height="100%"
            />
          </div>
        )}
      </main>
    </div>
  );
}