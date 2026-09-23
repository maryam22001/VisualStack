import { useState, useEffect, useRef, type ComponentType } from 'react';
import * as IsoflowModule from 'isoflow';
import { Architecture2D } from './Architecture2D';
import { CleanArchitectureView } from './CleanArchitectureView';
import { initialData } from './stackData';
import { loadSavedProject, saveProjectToStorage, exportProjectAsJSON } from './utils/storage';
import type { VisualStackProject } from './types/project';

// Safely resolve Isoflow component export across Vite ESM/CJS boundaries
const getIsoflowComponent = (): ComponentType<Record<string, unknown>> => {
  const mod = IsoflowModule as Record<string, unknown>;
  if (typeof mod.Isoflow === 'function') return mod.Isoflow as ComponentType<Record<string, unknown>>;
  if (typeof mod.default === 'function') return mod.default as ComponentType<Record<string, unknown>>;
  const def = mod.default as Record<string, unknown> | undefined;
  if (def && typeof def.default === 'function') return def.default as ComponentType<Record<string, unknown>>;
  if (def && typeof def.Isoflow === 'function') return def.Isoflow as ComponentType<Record<string, unknown>>;
  // Safe fallback component if module failed to extract
  return () => (
    <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
      Isoflow 3D viewer is loading or unavailable.
    </div>
  );
};

const IsoflowComponent = getIsoflowComponent();

export default function App() {
  const [project, setProject] = useState<VisualStackProject>(loadSavedProject);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-save on changes without synchronous setState inside the effect body
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const timer = setTimeout(() => {
      saveProjectToStorage(project);
      setSaveStatus('saved');
    }, 600);

    return () => clearTimeout(timer);
  }, [project]);

  const updateProject = (updater: (prev: VisualStackProject) => VisualStackProject) => {
    setSaveStatus('saving');
    setProject(updater);
  };
    

  const updateTitle = (newTitle: string) => {
    setProject((prev) => ({ ...prev, title: newTitle }));
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.title && (parsed.cleanView || parsed.detailed2DView)) {
          setProject(parsed);
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
      {/* Top Application Header */}
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
        {/* Brand & Editable Design Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span style={{ fontSize: '18px', fontWeight: '800', color: '#0284c7' }}>
            VisualStack
          </span>
          <span style={{ color: isDark ? '#475569' : '#cbd5e1' }}>/</span>
          <input
            type="text"
            value={project.title}
            onChange={(e) => updateTitle(e.target.value)}
            title="Click to rename design"
            style={{
              fontSize: '14px',
              fontWeight: '600',
              padding: '4px 8px',
              borderRadius: '6px',
              border: '1px solid transparent',
              background: 'transparent',
              color: isDark ? '#f8fafc' : '#0f172a',
              outline: 'none',
              maxWidth: '220px'
            }}
            onFocus={(e) => (e.target.style.borderColor = '#0284c7')}
            onBlur={(e) => (e.target.style.borderColor = 'transparent')}
          />
          <span style={{ fontSize: '11px', color: saveStatus === 'saving' ? '#d97706' : '#16a34a', fontWeight: '500' }}>
            {saveStatus === 'saving' ? '● Saving...' : '✓ Saved'}
          </span>
        </div>

        {/* View Mode Switcher */}
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
              onClick={() => setProject((prev) => ({ ...prev, activeTab: tab }))}
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

        {/* Storage Actions, Theme & Export */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="file"
            ref={fileInputRef}
            accept=".json"
            onChange={handleImportJSON}
            style={{ display: 'none' }}
          />

          <button
            onClick={() => fileInputRef.current?.click()}
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
            Import JSON
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
            Save JSON
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

          <button
            onClick={exportCurrentSvg}
            style={{
              background: '#10b981',
              color: '#ffffff',
              border: 'none',
              padding: '6px 14px',
              borderRadius: '6px',
              fontWeight: '600',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            Export SVG
          </button>
        </div>
      </header>

      {/* Main Canvas Workspace */}
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
            <IsoflowComponent initialData={initialData} editorMode="EDITABLE" width="100%" height="100%" />
          </div>
        )}
      </main>
    </div>
  );
}