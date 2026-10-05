import { useState, useEffect, useRef, useMemo, type ComponentType } from 'react';
import * as IsoflowModule from 'isoflow';
import { Architecture2D } from './views/Architecture2D';
import { CleanArchitectureView } from './views/CleanArchitectureView';
import {
  loadSavedProject,
  saveProjectToStorage,
  exportProjectAsJSON,
  encodeProjectToHash,
  decodeProjectFromHash,
  exportSvgToPng
} from './utils/storage';
import { useProjectHistory } from './hooks/useProjectHistory';
import { convertProjectToIsoflowData } from './utils/isoflowAdapter';
import {
  loadDesigns,
  upsertDesign,
  renameDesign,
  deleteDesign,
  addCollaboratorToDesign,
  removeCollaborator,
  loadProfile,
  saveProfile,
  type SavedDesign,
  type UserProfile
} from './utils/designStorage';
import { DesignGalleryModal } from './components/DesignGalleryModal';
import {
  getSessionUser,
  setSessionUser,
  getAllWorkspaces,
  type UserAccount
} from './utils/authStorage';
import { AuthScreens, type AuthScreenType } from './pages/AuthScreens';

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
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => getSessionUser());

  // Determine active view: studio or auth onboarding funnel
  const [activeScreen, setActiveScreen] = useState<'studio' | 'login' | 'signup' | 'verify' | 'create-workspace'>(() => {
    const user = getSessionUser();
    if (!user) return 'login';
    if (!user.isEmailVerified) return 'verify';
    if (!user.currentWorkspaceId || user.workspaces.length === 0) return 'create-workspace';
    return 'studio';
  });

  const {
    project,
    updateProject,
    setProjectDirect,
    undo,
    redo,
    canUndo,
    canRedo
  } = useProjectHistory(decodeProjectFromHash() || loadSavedProject());

  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isFirstRender = useRef(true);

  // Gallery & Profile state
  const [designs, setDesigns] = useState<SavedDesign[]>(() => loadDesigns());
  const [profile, setProfile] = useState<UserProfile>(() => loadProfile());
  const [currentDesignId, setCurrentDesignId] = useState<string | null>(null);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);

  // Active workspace calculation
  const currentWorkspace = useMemo(() => {
    if (!currentUser?.currentWorkspaceId) return null;
    return getAllWorkspaces().find((w) => w.id === currentUser.currentWorkspaceId);
  }, [currentUser]);

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

  // If user is unauthenticated, unverified, or lacks a workspace, show onboarding screen
  if (activeScreen !== 'studio') {
    return (
      <AuthScreens
        initialScreen={activeScreen}
        currentUser={currentUser}
        onNavigate={(screen: AuthScreenType) => setActiveScreen(screen)}
        onLoginSuccess={(updated: any) => {
          setCurrentUser(updated);
          setSessionUser(updated);
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

  const handleSaveDesign = () => {
    const id = currentDesignId || `design-${Date.now()}`;
    const newDesign: SavedDesign = {
      id,
      title: project.title || 'Untitled Architecture',
      updatedAt: Date.now(),
      collaborators: designs.find((d) => d.id === id)?.collaborators || [],
      project: { ...project, id }
    };

    const updated = upsertDesign(newDesign);
    setDesigns(updated);
    setCurrentDesignId(id);
    alert(`Design "${project.title}" saved successfully to your gallery!`);
  };

  const handleSignOut = () => {
    if (confirm('Log out from VisualStack?')) {
      setSessionUser(null);
      setCurrentUser(null);
      setActiveScreen('login');
    }
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
        {/* Left Section: Brand, Workspace & Editable Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '18px', fontWeight: '800', color: '#0284c7' }}>
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
              fontWeight: '700'
            }}
          >
            🏢 {currentWorkspace?.name || 'Workspace'}
          </span>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input
            type="file"
            ref={fileInputRef}
            accept=".json"
            onChange={handleImportJSON}
            style={{ display: 'none' }}
          />

          <button
            onClick={handleSaveDesign}
            style={{
              background: '#0284c7',
              color: '#fff',
              border: 'none',
              padding: '6px 10px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            💾 Save
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
            📁 Gallery ({designs.length})
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
            onClick={() => handleExportPng(false)}
            style={{
              background: '#10b981',
              color: '#fff',
              border: 'none',
              padding: '6px 10px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            PNG
          </button>

          <button
            onClick={exportCurrentSvg}
            style={{
              background: 'transparent',
              border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
              color: isDark ? '#cbd5e1' : '#475569',
              padding: '6px 8px',
              borderRadius: '6px',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            SVG
          </button>

          <button
            onClick={() => exportProjectAsJSON(project)}
            style={{
              background: 'transparent',
              border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
              color: isDark ? '#cbd5e1' : '#475569',
              padding: '6px 8px',
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
            title={`Signed in as ${currentUser?.name}`}
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
              key="isoflow-tab"
              initialData={convertProjectToIsoflowData(project)}
              editorMode="EDITABLE"
              width="100%"
              height="100%"
            />
          </div>
        )}
      </main>

      {/* Design Gallery & Collaborators Modal */}
      <DesignGalleryModal
        isOpen={isGalleryOpen}
        theme={theme}
        profile={profile}
        designs={designs}
        currentDesignId={currentDesignId}
        onClose={() => setIsGalleryOpen(false)}
        onSelectDesign={(d) => {
          setProjectDirect(d.project);
          setCurrentDesignId(d.id);
          setIsGalleryOpen(false);
        }}
        onRenameDesign={(id, newTitle) => setDesigns(renameDesign(id, newTitle))}
        onDeleteDesign={(id) => {
          if (confirm('Delete this design from the gallery?')) {
            setDesigns(deleteDesign(id));
            if (currentDesignId === id) setCurrentDesignId(null);
          }
        }}
        onAddCollaborator={(designId, collab) => {
          setDesigns(addCollaboratorToDesign(designId, collab));
        }}
        onRemoveCollaborator={(designId, collabId) => {
          setDesigns(removeCollaborator(designId, collabId));
        }}
        onSaveProfile={(updatedProfile) => {
          saveProfile(updatedProfile);
          setProfile(updatedProfile);
        }}
      />
    </div>
  );
}