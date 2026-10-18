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
  const svgString = serializeSvgForExport(svgElement);
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  const img = new Image();
  try {
    img.src = url;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('The diagram SVG could not be rendered as an image.'));
    });

    const { width, height } = getSvgExportSize(svgElement);
    const scaleFactor = 2;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(width * scaleFactor);
    canvas.height = Math.ceil(height * scaleFactor);

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create a canvas for PNG export.');

    ctx.scale(scaleFactor, scaleFactor);
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => result ? resolve(result) : reject(new Error('PNG image generation failed.')), 'image/png');
    });

    if (copyToClipboard && navigator.clipboard && window.ClipboardItem) {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        alert('Diagram copied to clipboard as PNG!');
        return;
      } catch (err) {
        console.warn('Clipboard write failed, falling back to download:', err);
      }
    }

    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    try {
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
    } finally {
      link.remove();
      URL.revokeObjectURL(downloadUrl);
    }
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function serializeSvgForExport(svgElement: SVGElement): string {
  const clone = svgElement.cloneNode(true) as SVGElement;
  const { width, height } = getSvgExportSize(svgElement);
  const computed = window.getComputedStyle(svgElement);
  const transform = computed.transform === 'none' ? new DOMMatrix() : new DOMMatrix(computed.transform);

  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;

  if (!clone.hasAttribute('viewBox') && computed.transform !== 'none' && transform.a && transform.d) {
    const x = -transform.e / transform.a;
    const y = -transform.f / transform.d;
    clone.setAttribute('viewBox', `${x} ${y} ${width / transform.a} ${height / transform.d}`);
    clone.style.transform = 'none';
    clone.style.transformOrigin = '0 0';
  }

  return new XMLSerializer().serializeToString(clone);
}

function getSvgExportSize(svgElement: SVGElement): { width: number; height: number } {
  const rect = svgElement.getBoundingClientRect();
  const width = svgElement.clientWidth || Number(svgElement.getAttribute('width')) || rect.width;
  const height = svgElement.clientHeight || Number(svgElement.getAttribute('height')) || rect.height;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('The diagram has no measurable size to export.');
  }
  return { width, height };
}
const legacyStarterProject: VisualStackProject = {
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

export const defaultProject: VisualStackProject = {
  id: 'proj-default',
  title: 'Untitled Architecture',
  updatedAt: new Date().toISOString(),
  activeTab: 'clean',
  cleanView: { clusters: [], nodes: [], connectors: [] },
  detailed2DView: { nodes: [], connectors: [] }
};

function isUntouchedLegacyStarter(parsed: Partial<VisualStackProject>): boolean {
  if (
    parsed.id !== legacyStarterProject.id ||
    parsed.title !== legacyStarterProject.title ||
    parsed.activeTab !== legacyStarterProject.activeTab ||
    !parsed.cleanView ||
    !parsed.detailed2DView
  ) return false;

  const withoutTimestamp = <T extends { updatedAt?: string }>(project: T) => {
    const content = { ...project };
    delete content.updatedAt;
    return JSON.stringify(content);
  };
  const synchronizedLegacy = {
    ...legacyStarterProject,
    detailed2DView: {
      nodes: legacyStarterProject.cleanView.nodes,
      connectors: legacyStarterProject.cleanView.connectors
    }
  };

  return withoutTimestamp(parsed) === withoutTimestamp(legacyStarterProject) ||
    withoutTimestamp(parsed) === withoutTimestamp(synchronizedLegacy);
}

export function loadSavedProject(): VisualStackProject {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProject;
    const parsed = JSON.parse(raw);
    if (isUntouchedLegacyStarter(parsed)) return defaultProject;
    
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