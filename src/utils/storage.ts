import type { VisualStackProject } from '../types/project';

const STORAGE_KEY = 'visualstack_active_project';


// --- URL State Sharing ---

export function encodeProjectToHash(project: VisualStackProject): string {
  try {
    const jsonString = JSON.stringify(project);
    // Base64 encode safe for UTF-8
    const encoded = btoa(encodeURIComponent(jsonString));
    return `#share=${encoded}`;
  } catch (err) {
    console.error('Failed to encode project to URL hash:', err);
    return '';
  }
}

export function decodeProjectFromHash(): VisualStackProject | null {
  try {
    const hash = window.location.hash;
    if (!hash.startsWith('#share=')) return null;

    const base64Data = hash.replace('#share=', '');
    const jsonString = decodeURIComponent(atob(base64Data));
    const parsed = JSON.parse(jsonString);

    if (parsed && typeof parsed === 'object' && (parsed.cleanView || parsed.detailed2DView)) {
      return parsed as VisualStackProject;
    }
  } catch (err) {
    console.error('Failed to parse project from URL hash:', err);
  }
  return null;
}

// --- High-Resolution PNG & Clipboard Export ---

export async function exportSvgToPng(
  svgElement: SVGElement,
  filename: string,
  copyToClipboard = false
): Promise<void> {
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svgElement);
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  const img = new Image();
  img.src = url;

  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });

  // Calculate canvas dimensions from SVG bounding box or attributes
  const bbox = svgElement.getBoundingClientRect();
  const width = Math.max(bbox.width, 1200);
  const height = Math.max(bbox.height, 800);

  // 2x scale for sharp, retina-quality renders
  const scaleFactor = 2;
  const canvas = document.createElement('canvas');
  canvas.width = width * scaleFactor;
  canvas.height = height * scaleFactor;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.scale(scaleFactor, scaleFactor);
  ctx.drawImage(img, 0, 0, width, height);
  URL.revokeObjectURL(url);

  canvas.toBlob(async (blob) => {
    if (!blob) return;

    if (copyToClipboard && navigator.clipboard && window.ClipboardItem) {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        alert('Diagram copied to clipboard as PNG!');
        return;
      } catch (err) {
        console.warn('Clipboard write failed, falling back to download:', err);
      }
    }

    // Direct download fallback / default
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);
  }, 'image/png');
}
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
    const parsed = JSON.parse(raw);
    
    // Ensure all critical sections exist to prevent property access crashes
    return {
      id: parsed.id || defaultProject.id,
      title: parsed.title || defaultProject.title,
      updatedAt: parsed.updatedAt || defaultProject.updatedAt,
      activeTab: parsed.activeTab || 'clean',
      cleanView: {
        clusters: Array.isArray(parsed.cleanView?.clusters) ? parsed.cleanView.clusters : defaultProject.cleanView.clusters,
        nodes: Array.isArray(parsed.cleanView?.nodes) ? parsed.cleanView.nodes : defaultProject.cleanView.nodes,
        connectors: Array.isArray(parsed.cleanView?.connectors) ? parsed.cleanView.connectors : defaultProject.cleanView.connectors
      },
      detailed2DView: {
        nodes: Array.isArray(parsed.detailed2DView?.nodes) ? parsed.detailed2DView.nodes : defaultProject.detailed2DView.nodes,
        connectors: Array.isArray(parsed.detailed2DView?.connectors) ? parsed.detailed2DView.connectors : defaultProject.detailed2DView.connectors
      }
    };
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