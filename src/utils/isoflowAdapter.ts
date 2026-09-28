import type { VisualStackProject } from '../types/project';

// Valid fallback icons formatted specifically for Isoflow
const defaultIsoflowIcons = [
  {
    id: 'icon-server',
    name: 'Server',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><polygon points="50 15, 85 35, 50 55, 15 35" fill="%230284c7"/><polygon points="15 35, 50 55, 50 85, 15 65" fill="%230369a1"/><polygon points="85 35, 50 55, 50 85, 85 65" fill="%23075985"/></svg>',
    isIsometric: true
  }
];

export const isoflowColors = [
  { id: 'c-blue', value: '#0284c7' },
  { id: 'c-green', value: '#10b981' },
  { id: 'c-amber', value: '#f59e0b' },
  { id: 'c-gray', value: '#64748b' }
];

export function convertProjectToIsoflowData(project: VisualStackProject) {
  // Extract nodes and connectors safely
  const rawNodes = Array.isArray(project?.cleanView?.nodes) && project.cleanView.nodes.length > 0
    ? project.cleanView.nodes
    : Array.isArray(project?.detailed2DView?.nodes)
    ? project.detailed2DView.nodes
    : [];

  const rawConnectors = Array.isArray(project?.cleanView?.connectors) && project.cleanView.connectors.length > 0
    ? project.cleanView.connectors
    : Array.isArray(project?.detailed2DView?.connectors)
    ? project.detailed2DView.connectors
    : [];

  // 1. Build Item Catalog
  const items = rawNodes.map((n, idx) => ({
    id: String(n.id || `node-${idx}`),
    name: String(n.label || `Node ${idx + 1}`),
    icon: 'icon-server'
  }));

  const validIdSet = new Set(items.map((i) => i.id));

  // 2. Build Scene Items with Collision Prevention
  const occupiedTiles = new Set<string>();
  const sceneItems = items.map((item, idx) => {
    const rawNode = rawNodes[idx];
    let tileX = Math.round((rawNode?.x || idx * 120) / 120);
    let tileY = Math.round((rawNode?.y || 0) / 120);

    // Prevent identical tile overlap
    while (occupiedTiles.has(`${tileX},${tileY}`)) {
      tileX += 1;
    }
    occupiedTiles.add(`${tileX},${tileY}`);

    return {
      id: item.id,
      tile: {
        x: tileX,
        y: tileY
      }
    };
  });

  // 3. Build Strict Connectors with Isoflow Anchor IDs
  const connectors = rawConnectors
    .filter((c) => c && validIdSet.has(String(c.from)) && validIdSet.has(String(c.to)) && c.from !== c.to)
    .map((c, idx) => ({
      id: String(c.id || `iso-conn-${idx}`),
      color: 'c-blue',
      style: c.dashed ? ('DOTTED' as const) : ('SOLID' as const),
      anchors: [
        {
          id: `anchor-start-${idx}`,
          ref: { item: String(c.from) }
        },
        {
          id: `anchor-end-${idx}`,
          ref: { item: String(c.to) }
        }
      ]
    }));

  return {
    title: project?.title || 'VisualStack Architecture',
    fitToScreen: true,
    icons: defaultIsoflowIcons,
    colors: isoflowColors,
    items,
    views: [
      {
        id: 'main-view',
        name: 'Architecture View',
        items: sceneItems,
        connectors
      }
    ]
  };
}