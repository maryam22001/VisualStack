/**
 * Local (browser-only) design storage.
 *
 * Signed-in users save to the server (see hooks/useDesigns.ts). This module is used for:
 *  - guests ("Continue without an account"), who keep their gallery in this browser, and
 *  - importing designs saved here BEFORE the server gallery existed.
 */
import type { VisualStackProject } from '../types/project';

export interface SavedDesign {
  id: string;
  title: string;
  updatedAt: number;
  project: VisualStackProject;
}

export const LOCAL_DESIGNS_KEY = 'visualstack:designs';

export const loadDesigns = (): SavedDesign[] => {
  try {
    const raw = localStorage.getItem(LOCAL_DESIGNS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const persist = (designs: SavedDesign[]): SavedDesign[] => {
  localStorage.setItem(LOCAL_DESIGNS_KEY, JSON.stringify(designs));
  return designs;
};

export const upsertDesign = (design: SavedDesign): SavedDesign[] => {
  const designs = loadDesigns();
  const index = designs.findIndex((d) => d.id === design.id);
  if (index >= 0) designs[index] = design;
  else designs.unshift(design);
  return persist(designs);
};

export const renameDesign = (id: string, title: string): SavedDesign[] =>
  persist(
    loadDesigns().map((d) =>
      d.id === id ? { ...d, title, updatedAt: Date.now(), project: { ...d.project, title } } : d
    )
  );

export const deleteDesign = (id: string): SavedDesign[] => persist(loadDesigns().filter((d) => d.id !== id));

export const clearLocalDesigns = (): void => {
  localStorage.removeItem(LOCAL_DESIGNS_KEY);
};
