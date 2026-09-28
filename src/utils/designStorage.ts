/** implementing the Profile & Design Gallery plus Add Collaborator directly on top of your existing project state in App.tsx, without touching the internal hooks of the canvas views.   
 * 
 */
/**Expanding the design structure to include an author profile, saved projects, and a collaborator list (with avatars and permission roles): */
// src/utils/designStorage.ts
import type { VisualStackProject } from '../types/project';

export interface Collaborator {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'editor' | 'viewer';
  avatarUrl?: string;
}

export interface UserProfile {
  name: string;
  email: string;
  avatarUrl: string;
}

export interface SavedDesign {
  id: string;
  title: string;
  updatedAt: number;
  collaborators: Collaborator[];
  project: VisualStackProject;
}

const DESIGNS_KEY = 'visualstack:designs';
const PROFILE_KEY = 'visualstack:profile';

export const defaultProfile: UserProfile = {
  name: 'Lead Architect',
  email: 'architect@visualstack.dev',
  avatarUrl: 'https://api.iconify.design/lucide/user-check.svg'
};

export const loadProfile = (): UserProfile => {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw) : defaultProfile;
  } catch {
    return defaultProfile;
  }
};

export const saveProfile = (profile: UserProfile): void => {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
};

export const loadDesigns = (): SavedDesign[] => {
  try {
    const raw = localStorage.getItem(DESIGNS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const upsertDesign = (design: SavedDesign): SavedDesign[] => {
  const designs = loadDesigns();
  const index = designs.findIndex((d) => d.id === design.id);
  if (index >= 0) {
    designs[index] = design;
  } else {
    designs.unshift(design);
  }
  localStorage.setItem(DESIGNS_KEY, JSON.stringify(designs));
  return designs;
};

export const renameDesign = (id: string, title: string): SavedDesign[] => {
  const designs = loadDesigns().map((d) =>
    d.id === id ? { ...d, title, updatedAt: Date.now(), project: { ...d.project, title } } : d
  );
  localStorage.setItem(DESIGNS_KEY, JSON.stringify(designs));
  return designs;
};

export const addCollaboratorToDesign = (
  designId: string,
  collaborator: Omit<Collaborator, 'id'>
): SavedDesign[] => {
  const designs = loadDesigns().map((d) => {
    if (d.id === designId) {
      const newCollab: Collaborator = {
        ...collaborator,
        id: `collab-${window.crypto?.randomUUID ? window.crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 7)}`
      };
      return {
        ...d,
        updatedAt: Date.now(),
        collaborators: [...(d.collaborators || []), newCollab]
      };
    }
    return d;
  });
  localStorage.setItem(DESIGNS_KEY, JSON.stringify(designs));
  return designs;
};

export const removeCollaborator = (designId: string, collaboratorId: string): SavedDesign[] => {
  const designs = loadDesigns().map((d) => {
    if (d.id === designId) {
      return {
        ...d,
        collaborators: (d.collaborators || []).filter((c) => c.id !== collaboratorId)
      };
    }
    return d;
  });
  localStorage.setItem(DESIGNS_KEY, JSON.stringify(designs));
  return designs;
};

export const deleteDesign = (id: string): SavedDesign[] => {
  const designs = loadDesigns().filter((d) => d.id !== id);
  localStorage.setItem(DESIGNS_KEY, JSON.stringify(designs));
  return designs;
};