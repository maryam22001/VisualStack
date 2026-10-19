import { useState, useEffect, useRef, type ComponentType } from 'react';
import * as IsoflowModule from 'isoflow';
import type { Model } from 'isoflow';
import { Architecture2D } from './views/Architecture2D';
import { CleanArchitectureView } from './views/CleanArchitectureView';
import {
  loadSavedProject,
  saveProjectToStorage,
  exportProjectAsJSON,
  encodeProjectToHash,
  decodeProjectFromHash,
  exportSvgToPng,
  serializeSvgForExport
} from './utils/storage';
import { useProjectHistory } from './hooks/useProjectHistory';
import { convertProjectToIsoflowData } from './utils/isoflowAdapter';
import { DesignGalleryModal } from './components/DesignGalleryModal';
import { JsonToDesignModal } from './components/JsonToDesignModal';
import { useAuth } from './hooks/useAuth';
import { useDesigns } from './hooks/useDesigns';
import { errorMessage } from './api/client';
import { AuthScreens, type AuthScreenType } from './pages/AuthScreens';
import type { VisualStackProject } from './types/project';
import './App.css';

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

function synchronizeProjectViews(project: VisualStackProject): VisualStackProject {
  const useCleanView = project.cleanView.nodes.length > 0;
  const nodes = useCleanView ? project.cleanView.nodes : project.detailed2DView.nodes;
  const connectors = useCleanView ? project.cleanView.connectors : project.detailed2DView.connectors;
  return {
    ...project,
    cleanView: { ...project.cleanView, nodes, connectors },
    detailed2DView: { nodes, connectors }
  };
}

function getActiveDiagramSvg(tab: VisualStackProject['activeTab']): SVGElement | null {
  if (tab === 'clean') return document.querySelector<SVGElement>('#aegisot-clean-svg');
  if (tab === '2d') return document.querySelector<SVGElement>('#aegisot-2d-svg');
  return Array.from(document.querySelectorAll<SVGElement>('main svg')).reduce<SVGElement | null>((largest, svg) => {
    const bounds = svg.getBoundingClientRect();
    if (!largest) return svg;
    const largestBounds = largest.getBoundingClientRect();
    return bounds.width * bounds.height > largestBounds.width * largestBounds.height ? svg : largest;
  }, null);
}

export default function App() {
  // Auth comes from the server session (HTTP-only cookie, re-checked via GET /api/auth/me),
  // not from localStorage. See hooks/useAuth.tsx.
  const { user, isLoading: authLoading, logout, logoutEverywhere } = useAuth();
  // Set by "Continue without an account" on the sign-in screen.
  // Delete this state (and the guest button in AuthScreens) to make login mandatory.
  const [guestMode, setGuestMode] = useState(false);

  const [initialProject] = useState(() =>
    synchronizeProjectViews(decodeProjectFromHash() || loadSavedProject())
  );

  const {
    project,
    updateProject,
    setProjectDirect,
    undo,
    redo,
    canUndo,
    canRedo
  } = useProjectHistory(initialProject);

  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  const isFirstRender = useRef(true);

  // Gallery: server-backed for signed-in users (workspaces + roles), localStorage for guests.
  const store = useDesigns(user);
  const [currentDesignId, setCurrentDesignId] = useState<string | null>(null);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isJsonToDesignOpen, setIsJsonToDesignOpen] = useState(false);

  // When the signed-in identity changes (sign-out, expired session, a different user) reset
  // everything tied to the previous one, so the next session never inherits an open modal or
  // another account's "current design". (React's recommended "reset state on prop change" pattern.)
  const identity = user?.id ?? null;
  const [seenIdentity, setSeenIdentity] = useState(identity);
  if (seenIdentity !== identity) {
    setSeenIdentity(identity);
    setIsGalleryOpen(false);
    setIsJsonToDesignOpen(false);
    setCurrentDesignId(null);
  }

  // Workspace shown in the header (created for the user at sign-up)
  const workspaceName = store.activeWorkspace?.name || user?.currentWorkspaceName || (user ? 'My Workspace' : 'Guest');

  // Debounced auto-save to storage
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

  // Global Keyboard Shortcuts (Undo, Redo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          (activeEl as HTMLElement).isContentEditable);

      if (isInput) return;

      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      if (isCtrlOrCmd && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if (isCtrlOrCmd && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        e.stopPropagation();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [undo, redo]);

  // Wait for the first session check so a refresh never flashes the sign-in screen.
  if (authLoading) {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'grid', placeItems: 'center', background: '#f8fafc', color: '#64748b', fontSize: 14 }}>
        Loading…
      </div>
    );
  }

  // Signed out -> sign in / sign up / verify / forgot password.
  // Signing in updates the auth context, which re-renders this component into the studio.
  if (!user && !guestMode) {
    return (
      <AuthScreens
        initialScreen="login"
        onNavigate={(screen: AuthScreenType) => {
          if (screen === 'studio') setGuestMode(true);
        }}
      />
    );
  }

  // --- STUDIO CANVAS ACTIONS ---
  const updateTitle = (newTitle: string) => {
    updateProject((prev) => ({ ...prev, title: newTitle }));
  };

  const handleCopyShareLink = () => {
    const hash = encodeProjectToHash(project);
    const fullUrl = `${window.location.origin}${window.location.pathname}${hash}`;
    navigator.clipboard.writeText(fullUrl).then(() => {
      alert('Shareable link copied to clipboard!');
    });
  };

  const handleExportPng = (copyToClipboard = false) => {
    let filename = `${project.title.toLowerCase().replace(/\s+/g, '-')}-clean.png`;

    if (project.activeTab === '2d') {
      filename = `${project.title.toLowerCase().replace(/\s+/g, '-')}-2d.png`;
    } else if (project.activeTab === '3d') {
      filename = `${project.title.toLowerCase().replace(/\s+/g, '-')}-3d.png`;
    }

    const svgEl = getActiveDiagramSvg(project.activeTab);
    if (!svgEl) {
      alert('No SVG element detected for export.');
      return;
    }

    void exportSvgToPng(svgEl, filename, copyToClipboard).catch((err: unknown) => {
      console.error('PNG export failed:', err);
      alert(err instanceof Error ? err.message : 'PNG export failed.');
    });
  };

  const exportCurrentSvg = () => {
    let filename = `${project.title.toLowerCase().replace(/\s+/g, '-')}-clean.svg`;

    if (project.activeTab === '2d') {
      filename = `${project.title.toLowerCase().replace(/\s+/g, '-')}-2d.svg`;
    } else if (project.activeTab === '3d') {
      filename = `${project.title.toLowerCase().replace(/\s+/g, '-')}-3d.svg`;
    }

    const svgEl = getActiveDiagramSvg(project.activeTab);
    if (!svgEl) {
      alert('No SVG element detected for export.');
      return;
    }

    const source = serializeSvgForExport(svgEl);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = filename;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleIsoflowModelUpdated = (model: Model) => {
    const view = model.views[0];
    if (!view) return;
    const viewItems = new Map(view.items.map((item) => [item.id, item]));
    const existingNodes = new Map(project.cleanView.nodes.map((node) => [node.id, node]));
    const nodes = model.items.map((item) => {
      const existing = existingNodes.get(item.id);
      const position = viewItems.get(item.id)?.tile;
      const iconUrl = model.icons.find((icon) => icon.id === item.icon)?.url;
      let subtext = item.description;
      const specsSuffix = existing?.specs?.length ? ` · ${existing.specs.join(' · ')}` : '';
      while (subtext && specsSuffix && subtext.endsWith(specsSuffix)) {
        subtext = subtext.slice(0, -specsSuffix.length);
      }
      return {
        ...existing,
        id: item.id,
        label: item.name,
        subtext,
        iconUrl: item.icon && item.icon !== 'icon-server' ? iconUrl || existing?.iconUrl : existing?.iconUrl || iconUrl,
        x: position ? position.x * 120 : existing?.x ?? 0,
        y: position ? position.y * 120 : existing?.y ?? 0,
        width: existing?.width ?? 190,
        height: existing?.height ?? 90
      };
    });
    const existingConnectors = new Map(project.cleanView.connectors.map((connector) => [connector.id, connector]));
    const connectors = (view.connectors ?? []).flatMap((connector) => {
      const from = connector.anchors[0]?.ref.item;
      const to = connector.anchors[1]?.ref.item;
      if (!from || !to) return [];
      const existing = existingConnectors.get(connector.id);
      return [{
        id: connector.id,
        from,
        to,
        label: connector.description ?? existing?.label,
        bend: existing?.bend,
        color: model.colors.find((color) => color.id === connector.color)?.value ?? existing?.color ?? '#0284c7',
        dashed: connector.style !== 'SOLID'
      }];
    });

    updateProject((previous) => {
      if (
        JSON.stringify(previous.cleanView.nodes) === JSON.stringify(nodes) &&
        JSON.stringify(previous.cleanView.connectors) === JSON.stringify(connectors)
      ) return previous;
      return {
        ...previous,
        cleanView: { ...previous.cleanView, nodes, connectors },
        detailed2DView: { nodes, connectors }
      };
    });
  };

  const handleJsonDesign = (imported: VisualStackProject) => {
    const synchronized = synchronizeProjectViews(imported);
    setProjectDirect(synchronized);
    setCurrentDesignId(null);
    saveProjectToStorage(synchronized);
    setIsJsonToDesignOpen(false);
  };

  const handleSaveDesign = async () => {
    if (!store.canEdit) {
      alert('You have view-only access to this workspace, so this design cannot be saved here.');
      return;
    }
    setIsSaving(true);
    try {
      const saved = await store.saveDesign(project, currentDesignId, theme);
      setCurrentDesignId(saved.id);
      alert(
        store.mode === 'cloud'
          ? `"${saved.title}" saved to ${workspaceName}.`
          : `"${saved.title}" saved in this browser. Sign in to keep it in your workspace.`
      );
    } catch (err) {
      alert(`Could not save the design: ${errorMessage(err)}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    if (confirm('Log out from VisualStack?')) {
      await logout(); // clears the cookie on the server, then the local session
      setGuestMode(false);
    }
  };

  const isDark = theme === 'dark';

  return (
    <div
      className="vs-app"
      style={{
        width: '100%',
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        background: isDark ? '#0f172a' : '#f8fafc',
        color: isDark ? '#f8fafc' : '#0f172a',
        overflow: 'hidden'
      }}
    >
      {/* Top Application Header */}
      <header
        className="vs-app-header"
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
        {/* Left Section: Brand, Workspace & Editable Title */}
        <div className="vs-app-header__brand" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="vs-app-header__logo">
            <svg viewBox="0 0 100 100" aria-hidden="true">
              <polygon points="50 10, 90 32, 50 54, 10 32" fill="#38bdf8" />
              <polygon points="10 32, 50 54, 50 92, 10 70" fill="#0284c7" />
              <polygon points="90 32, 50 54, 50 92, 90 70" fill="#075985" />
            </svg>
            VisualStack
          </span>
          <span style={{ color: isDark ? '#475569' : '#cbd5e1' }}>/</span>
          <span
            style={{
              fontSize: '11px',
              background: isDark ? '#0f172a' : '#e0f2fe',
              color: '#0284c7',
              padding: '4px 8px',
              borderRadius: '6px',
              fontWeight: '700',
              whiteSpace: 'nowrap'
            }}
          >
            🏢 {workspaceName}
          </span>
          {store.workspaces.length > 1 && (
            <select
              aria-label="Switch workspace"
              value={store.activeWorkspace?.id ?? ''}
              onChange={(e) => {
                store.switchWorkspace(e.target.value);
                setCurrentDesignId(null);
              }}
              style={{
                fontSize: '11px',
                padding: '4px 6px',
                borderRadius: '6px',
                border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
                background: isDark ? '#0f172a' : '#ffffff',
                color: isDark ? '#f8fafc' : '#0f172a'
              }}
            >
              {store.workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          )}
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
              maxWidth: '160px'
            }}
          />
          <span style={{ fontSize: '11px', color: saveStatus === 'saving' ? '#d97706' : '#16a34a' }}>
            {saveStatus === 'saving' ? '● Saving...' : '✓ Saved'}
          </span>
        </div>

        {/* Center Section: Tabs & Undo/Redo */}
        <div className="vs-app-header__tabs" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
        </div>

        {/* Right Section: Workspace, Save, Gallery & Exports */}
        <div className="vs-app-header__actions" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={handleSaveDesign}
            disabled={isSaving || !store.canEdit}
            title={store.canEdit ? 'Save this design' : 'View-only access: ask the owner for edit rights'}
            style={{
              background: '#0284c7',
              color: '#fff',
              border: 'none',
              padding: '6px 10px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: isSaving || !store.canEdit ? 'not-allowed' : 'pointer',
              opacity: isSaving || !store.canEdit ? 0.55 : 1
            }}
          >
            {isSaving ? 'Saving…' : '💾 Save'}
          </button>

          <button
            onClick={() => setIsGalleryOpen(true)}
            style={{
              background: isDark ? '#334155' : '#e2e8f0',
              color: isDark ? '#f8fafc' : '#0f172a',
              border: 'none',
              padding: '6px 10px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            📁 Gallery ({store.designs.length})
          </button>

          <button
            onClick={handleCopyShareLink}
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
            🔗 Share
          </button>

          <button
            type="button"
            className="vs-app-export__trigger"
            aria-haspopup="dialog"
            aria-expanded={isJsonToDesignOpen}
            onClick={() => setIsJsonToDesignOpen(true)}
          >
            JSON to design
          </button>

          <div className="vs-app-export">
            <button
              type="button"
              className="vs-app-export__trigger"
              aria-haspopup="menu"
              aria-expanded={isExportMenuOpen}
              onClick={() => setIsExportMenuOpen((open) => !open)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 17v3h14v-3" /></svg>
              Export
              <svg className="vs-app-export__chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>
            </button>
            {isExportMenuOpen && (
              <div className="vs-app-export__menu" role="menu" aria-label="Export format">
                <button role="menuitem" onClick={() => { setIsExportMenuOpen(false); handleExportPng(false); }}>PNG image</button>
                <button role="menuitem" onClick={() => { setIsExportMenuOpen(false); exportCurrentSvg(); }}>SVG vector</button>
                <button role="menuitem" onClick={() => { setIsExportMenuOpen(false); exportProjectAsJSON(project); }}>JSON project</button>
              </div>
            )}
          </div>

          <button
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            style={{
              background: isDark ? '#334155' : '#e2e8f0',
              color: isDark ? '#f8fafc' : '#0f172a',
              border: 'none',
              padding: '6px 8px',
              borderRadius: '6px',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            {isDark ? '☀️' : '🌙'}
          </button>

          <button
            onClick={handleSignOut}
            title={user ? `Signed in as ${user.fullName}` : 'Guest session'}
            style={{
              background: 'transparent',
              border: `1px solid #ef4444`,
              color: '#ef4444',
              padding: '5px 8px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: '600',
              cursor: 'pointer',
              marginLeft: '4px'
            }}
          >
            Log Out
          </button>
        </div>
      </header>

      {/* Main Studio Workspace */}
      <main className="vs-app-workspace" style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {project.activeTab === 'clean' && (
          <CleanArchitectureView
            theme={theme}
            clusters={project.cleanView?.clusters ?? []}
            nodes={project.cleanView?.nodes ?? []}
            connectors={project.cleanView?.connectors ?? []}
            onChange={(data) =>
              updateProject((prev) => ({
                ...prev,
                cleanView: data,
                detailed2DView: { nodes: data.nodes, connectors: data.connectors }
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
                cleanView: { ...prev.cleanView, nodes: data.nodes, connectors: data.connectors },
                detailed2DView: data
              }))
            }
          />
        )}
        {project.activeTab === '3d' && (
          <div style={{ width: '100%', height: '100%' }}>
            <IsoflowComponent
              key="isoflow-tab"
              initialData={convertProjectToIsoflowData(project)}
              editorMode="EDITABLE"
              width="100%"
              height="100%"
              onModelUpdated={handleIsoflowModelUpdated}
            />
          </div>
        )}
      </main>

      {/* Workspace Hub: shared designs + team */}
      <DesignGalleryModal
        isOpen={isGalleryOpen}
        theme={theme}
        store={store}
        user={user}
        currentDesignId={currentDesignId}
        onClose={() => setIsGalleryOpen(false)}
        onSelectDesign={(d) => {
          setProjectDirect(synchronizeProjectViews(d.project));
          setCurrentDesignId(d.id);
          setIsGalleryOpen(false);
        }}
        onRenameDesign={(id, newTitle) => {
          store.renameDesign(id, newTitle);
          // keep the open canvas in step so the next Save does not undo the rename
          if (id === currentDesignId) updateTitle(newTitle);
        }}
        onDeleteDesign={(id) => {
          if (confirm('Delete this design? This cannot be undone.')) {
            store
              .deleteDesign(id)
              .then(() => {
                if (currentDesignId === id) setCurrentDesignId(null);
              })
              .catch((err) => alert(`Could not delete the design: ${errorMessage(err)}`));
          }
        }}
        onSignOutEverywhere={() => {
          if (confirm('Sign out of VisualStack on every device, including this one?')) {
            void logoutEverywhere();
            setGuestMode(false);
          }
        }}
      />
      {isJsonToDesignOpen && (
        <JsonToDesignModal
          theme={theme}
          onClose={() => setIsJsonToDesignOpen(false)}
          onConvert={handleJsonDesign}
        />
      )}
    </div>
  );
}