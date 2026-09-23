import type { VisualStackProject } from '../types/project';

const STORAGE_KEY = 'visualstack_active_project';

export const defaultProject: VisualStackProject = {
  id: 'proj-default',
  title: 'Untitled Architecture',
  updatedAt: new Date().toISOString(),
  activeTab: 'clean',
  cleanView: {
    clusters: [
      {
        id: 'cluster-edge',
        title: 'Edge & Ingestion Zone',
        x: 80,
        y: 120,
        width: 250,
        height: 380,
        color: 'rgba(2, 132, 199, 0.05)',
        borderColor: '#38bdf8'
      },
      {
        id: 'cluster-platform',
        title: 'Core Platform & Services (HA)',
        x: 400,
        y: 80,
        width: 360,
        height: 440,
        color: 'rgba(16, 185, 129, 0.05)',
        borderColor: '#34d399'
      }
    ],
    nodes: [
      {
        id: 'n-gateway',
        clusterId: 'cluster-edge',
        label: 'API Gateway',
        subtext: 'Kong / Envoy',
        iconUrl: 'https://api.iconify.design/logos/nginx.svg',
        x: 160,
        y: 200,
        width: 68,
        height: 64
      },
      {
        id: 'n-orchestrator',
        clusterId: 'cluster-platform',
        label: 'App Orchestrator',
        subtext: 'FastAPI / Go Mesh',
        iconUrl: 'https://api.iconify.design/logos/fastapi.svg',
        x: 460,
        y: 180,
        width: 68,
        height: 64
      }
    ],
    connectors: [
      { id: 'c-1', from: 'n-gateway', to: 'n-orchestrator', label: 'gRPC / HTTP', color: '#0284c7' }
    ]
  },
  detailed2DView: {
    nodes: [
      {
        id: 'node-client',
        label: 'Client Web & Mobile',
        subtext: 'Frontend Gateway',
        badge: 'HTTPS / WSS',
        iconUrl: 'https://api.iconify.design/logos/react.svg',
        color: '#0284c7',
        x: 80,
        y: 220,
        width: 190,
        height: 90
      },
      {
        id: 'node-api',
        label: 'API Orchestrator',
        subtext: 'Core Application Service',
        badge: 'Node / Go REST',
        iconUrl: 'https://api.iconify.design/logos/nodejs-icon.svg',
        color: '#16a34a',
        x: 360,
        y: 220,
        width: 200,
        height: 90
      }
    ],
    connectors: [
      { id: 'conn-1', from: 'node-client', to: 'node-api', label: 'REST / TLS', color: '#0284c7' }
    ]
  }
};

export function loadSavedProject(): VisualStackProject {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProject;
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load project from localStorage:', err);
    return defaultProject;
  }
}

export function saveProjectToStorage(project: VisualStackProject): void {
  try {
    const updated = { ...project, updatedAt: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to save project to localStorage:', err);
  }
}

export function exportProjectAsJSON(project: VisualStackProject): void {
  const data = JSON.stringify(project, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${project.title.toLowerCase().replace(/\s+/g, '-') || 'design'}.visualstack.json`;
  a.click();
  URL.revokeObjectURL(url);
}