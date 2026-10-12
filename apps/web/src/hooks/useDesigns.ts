import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  apiAddMember,
  apiDeleteDesign,
  apiGetDesigns,
  apiGetMembers,
  apiGetWorkspaces,
  apiRemoveMember,
  apiSaveDesign,
  apiUpdateMemberRole,
  errorMessage,
  type ApiDesign,
  type Role,
  type UserSession,
  type WorkspaceMember,
  type WorkspaceSummary
} from '../api/client';
import {
  clearLocalDesigns,
  deleteDesign as deleteLocalDesign,
  loadDesigns as loadLocalDesigns,
  renameDesign as renameLocalDesign,
  upsertDesign as upsertLocalDesign,
  type SavedDesign
} from '../utils/designStorage';
import { defaultProject } from '../utils/storage';
import type { VisualStackProject } from '../types/project';

/**
 * One interface for the design gallery, two backends:
 *   - signed in  -> the API (workspaces, role-checked, shared with teammates)
 *   - guest      -> this browser's localStorage
 */

const RENAME_DEBOUNCE_MS = 600;
const activeWorkspaceKey = (userId: string) => `visualstack_active_workspace:${userId}`;

const emptyProject = (): VisualStackProject => ({
  ...defaultProject,
  cleanView: { clusters: [], nodes: [], connectors: [] },
  detailed2DView: { nodes: [], connectors: [] }
});

/** The server stores the whole project in graphData; tolerate empty/legacy shapes. */
function toSaved(d: ApiDesign): SavedDesign {
  const g = d.graphData as Partial<VisualStackProject> | null;
  const isProject = !!g && typeof g === 'object' && !!g.cleanView && !!g.detailed2DView && !!g.activeTab;
  const project = isProject ? (g as VisualStackProject) : emptyProject();
  return {
    id: d.id,
    title: d.title,
    updatedAt: Date.parse(d.updatedAt) || Date.now(),
    project: { ...project, id: d.id, title: d.title }
  };
}

interface CloudData {
  key: string;
  designs: SavedDesign[];
  members: WorkspaceMember[];
  error: string | null;
}

export interface DesignStore {
  /** 'cloud' = signed in (server), 'local' = guest (this browser). */
  mode: 'cloud' | 'local';
  workspaces: WorkspaceSummary[];
  activeWorkspace: WorkspaceSummary | null;
  switchWorkspace: (workspaceId: string) => void;
  designs: SavedDesign[];
  members: WorkspaceMember[];
  loading: boolean;
  error: string | null;
  role: Role | null;
  canEdit: boolean;
  isOwner: boolean;
  /** Designs saved in this browser before the server gallery (cloud mode only). */
  importableCount: number;
  reload: () => void;
  saveDesign: (project: VisualStackProject, currentId: string | null, theme: string) => Promise<SavedDesign>;
  renameDesign: (id: string, title: string) => void;
  deleteDesign: (id: string) => Promise<void>;
  importLocalDesigns: () => Promise<number>;
  addMember: (email: string, role: 'editor' | 'viewer') => Promise<void>;
  changeMemberRole: (userId: string, role: 'editor' | 'viewer') => Promise<void>;
  removeMember: (userId: string) => Promise<void>;
}

export function useDesigns(user: UserSession | null): DesignStore {
  const userId = user?.id ?? null;
  const mode: 'cloud' | 'local' = userId ? 'cloud' : 'local';

  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[] | null>(null);
  const [workspacesError, setWorkspacesError] = useState<string | null>(null);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [cloudData, setCloudData] = useState<CloudData | null>(null);
  const [localDesigns, setLocalDesigns] = useState<SavedDesign[]>(loadLocalDesigns);
  const renameTimers = useRef<Record<string, number>>({});

  // ----- workspaces the signed-in user belongs to -----
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    apiGetWorkspaces()
      .then((list) => {
        if (cancelled) return;
        setWorkspaces(list);
        setWorkspacesError(null);
      })
      .catch((err) => {
        if (!cancelled) setWorkspacesError(errorMessage(err, 'Could not load your workspaces'));
      });
    return () => {
      cancelled = true;
    };
  }, [userId, reloadToken]);

  // Derived (not stored) so a different user can never see the previous user's selection.
  const cloudWorkspaces = useMemo(() => (userId ? workspaces ?? [] : []), [userId, workspaces]);
  const activeWorkspace = useMemo<WorkspaceSummary | null>(() => {
    if (!userId) return null;
    let remembered: string | null = null;
    try {
      remembered = localStorage.getItem(activeWorkspaceKey(userId));
    } catch {
      /* storage unavailable */
    }
    const pick = (id: string | null | undefined) => cloudWorkspaces.find((w) => w.id === id);
    return pick(chosenId) ?? pick(remembered) ?? pick(user?.currentWorkspaceId) ?? cloudWorkspaces[0] ?? null;
  }, [userId, chosenId, cloudWorkspaces, user?.currentWorkspaceId]);

  const activeId = activeWorkspace?.id ?? null;
  const dataKey = activeId ? `${activeId}:${reloadToken}` : null;

  // ----- designs + members of the active workspace -----
  useEffect(() => {
    if (!dataKey || !activeId) return;
    let cancelled = false;
    Promise.all([apiGetDesigns(activeId), apiGetMembers(activeId)])
      .then(([designs, members]) => {
        if (!cancelled) setCloudData({ key: dataKey, designs: designs.map(toSaved), members, error: null });
      })
      .catch((err) => {
        if (!cancelled) {
          setCloudData({ key: dataKey, designs: [], members: [], error: errorMessage(err, 'Could not load designs') });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [dataKey, activeId]);

  const cloudReady = !!dataKey && cloudData?.key === dataKey;
  const designs = useMemo<SavedDesign[]>(
    () => (mode === 'cloud' ? (cloudReady && cloudData ? cloudData.designs : []) : localDesigns),
    [mode, cloudReady, cloudData, localDesigns]
  );
  const members = useMemo<WorkspaceMember[]>(
    () => (mode === 'cloud' && cloudReady && cloudData ? cloudData.members : []),
    [mode, cloudReady, cloudData]
  );
  const loading = mode === 'cloud' && !workspacesError && (workspaces === null || (!!dataKey && !cloudReady));
  const error = mode === 'cloud' ? workspacesError ?? (cloudReady ? cloudData!.error : null) : null;

  const role: Role | null = activeWorkspace?.role ?? null;
  const canEdit = mode === 'local' || role === 'owner' || role === 'editor';
  const isOwner = role === 'owner';

  const updateCloud = useCallback((fn: (d: CloudData) => CloudData) => {
    setCloudData((prev) => (prev ? fn(prev) : prev));
  }, []);

  const switchWorkspace = useCallback(
    (workspaceId: string) => {
      setChosenId(workspaceId);
      if (userId) {
        try {
          localStorage.setItem(activeWorkspaceKey(userId), workspaceId);
        } catch {
          /* ignore */
        }
      }
    },
    [userId]
  );

  const reload = useCallback(() => setReloadToken((t) => t + 1), []);

  const saveDesign = useCallback(
    async (project: VisualStackProject, currentId: string | null, theme: string): Promise<SavedDesign> => {
      const title = project.title || 'Untitled Architecture';

      if (mode === 'local') {
        const id = currentId || `design-${Date.now()}`;
        const saved: SavedDesign = { id, title, updatedAt: Date.now(), project: { ...project, id } };
        setLocalDesigns(upsertLocalDesign(saved));
        return saved;
      }

      if (!activeId) throw new Error('No workspace is selected.');
      // If the open design belongs to another workspace, save a new copy here instead of editing it there.
      const knownHere = currentId ? designs.some((d) => d.id === currentId) : false;
      const api = await apiSaveDesign({
        id: knownHere ? currentId! : undefined,
        workspaceId: activeId,
        title,
        viewMode: project.activeTab,
        theme,
        graphData: project
      });
      const saved = toSaved(api);
      updateCloud((d) => ({ ...d, designs: [saved, ...d.designs.filter((x) => x.id !== saved.id)] }));
      return saved;
    },
    [mode, activeId, designs, updateCloud]
  );

  const renameDesign = useCallback(
    (id: string, title: string) => {
      if (mode === 'local') {
        setLocalDesigns(renameLocalDesign(id, title));
        return;
      }
      // Update the list instantly, but only hit the server once typing pauses.
      updateCloud((d) => ({
        ...d,
        designs: d.designs.map((x) => (x.id === id ? { ...x, title, project: { ...x.project, title } } : x))
      }));
      window.clearTimeout(renameTimers.current[id]);
      renameTimers.current[id] = window.setTimeout(() => {
        if (!activeId || !title.trim()) return;
        apiSaveDesign({ id, workspaceId: activeId, title }).catch((err) => {
          updateCloud((d) => ({ ...d, error: errorMessage(err, 'Could not rename the design') }));
        });
      }, RENAME_DEBOUNCE_MS);
    },
    [mode, activeId, updateCloud]
  );

  const deleteDesign = useCallback(
    async (id: string) => {
      if (mode === 'local') {
        setLocalDesigns(deleteLocalDesign(id));
        return;
      }
      await apiDeleteDesign(id);
      updateCloud((d) => ({ ...d, designs: d.designs.filter((x) => x.id !== id) }));
    },
    [mode, updateCloud]
  );

  const importLocalDesigns = useCallback(async (): Promise<number> => {
    if (mode !== 'cloud' || !activeId) return 0;
    const local = loadLocalDesigns();
    for (const d of local) {
      await apiSaveDesign({
        workspaceId: activeId,
        title: d.title,
        viewMode: d.project.activeTab,
        theme: 'light',
        graphData: d.project
      });
    }
    clearLocalDesigns();
    setLocalDesigns([]);
    reload();
    return local.length;
  }, [mode, activeId, reload]);

  const addMember = useCallback(
    async (email: string, memberRole: 'editor' | 'viewer') => {
      if (!activeId) return;
      const m = await apiAddMember(activeId, email, memberRole);
      updateCloud((d) => ({ ...d, members: [...d.members, m] }));
    },
    [activeId, updateCloud]
  );

  const changeMemberRole = useCallback(
    async (memberId: string, memberRole: 'editor' | 'viewer') => {
      if (!activeId) return;
      const m = await apiUpdateMemberRole(activeId, memberId, memberRole);
      updateCloud((d) => ({ ...d, members: d.members.map((x) => (x.userId === memberId ? m : x)) }));
    },
    [activeId, updateCloud]
  );

  const removeMember = useCallback(
    async (memberId: string) => {
      if (!activeId) return;
      await apiRemoveMember(activeId, memberId);
      if (memberId === userId) {
        // I left this workspace: drop it from my list and fall back to another one.
        setWorkspaces((prev) => (prev ? prev.filter((w) => w.id !== activeId) : prev));
        setChosenId(null);
      } else {
        updateCloud((d) => ({ ...d, members: d.members.filter((x) => x.userId !== memberId) }));
      }
    },
    [activeId, userId, updateCloud]
  );

  return {
    mode,
    workspaces: cloudWorkspaces,
    activeWorkspace,
    switchWorkspace,
    designs,
    members,
    loading,
    error,
    role,
    canEdit,
    isOwner,
    importableCount: mode === 'cloud' ? localDesigns.length : 0,
    reload,
    saveDesign,
    renameDesign,
    deleteDesign,
    importLocalDesigns,
    addMember,
    changeMemberRole,
    removeMember
  };
}
