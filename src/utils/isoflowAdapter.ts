import type { VisualStackProject } from '../types/project';
import { fallbackIcons } from '../stackData';

export const isoflowColors = [
  { id: 'c-blue', value: '#0284c7' },
  { id: 'c-green', value: '#10b981' },
  { id: 'c-amber', value: '#f59e0b' },
  { id: 'c-gray', value: '#64748b' }
];

export function convertProjectToIsoflowData(project: VisualStackProject) {
  // 1. Pick nodes from active or populated view
  const rawNodes =
    project.cleanView?.nodes && project.cleanView.nodes.length > 0
      ? project.cleanView.nodes
      : project.detailed2DView?.nodes ?? [];

  const rawConnectors =
    project.cleanView?.connectors && project.cleanView.connectors.length > 0
      ? project.cleanView.connectors
      : project.detailed2DView?.connectors ?? [];

  // Guarantee valid fallback icons exist
  const guaranteedIcons =
    fallbackIcons && fallbackIcons.length > 0
      ? fallbackIcons
      : [
          {
            id: 'icon-server',
            name: 'Server',
            url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><polygon points="50 15, 85 35, 50 55, 15 35" fill="%230284c7"/><polygon points="15 35, 50 55, 50 85, 15 65" fill="%230369a1"/><polygon points="85 35, 50 55, 50 85, 85 65" fill="%23075985"/></svg>',
            isIsometric: true
          }
        ];

  const defaultIconId = guaranteedIcons[0].id;

  // 2. Global item catalog definition
  const validItems = rawNodes.map((n, idx) => ({
    id: n.id || `node-${idx}`,
    name: n.label || `Node ${idx + 1}`,
    icon: defaultIconId
  }));

  const validItemIds = new Set(validItems.map((item) => item.id));

  // 3. Grid positioning with collision prevention
  // Isoflow throws an error if two items share the exact same tile coordinate
  const occupiedTiles = new Set<string>();
  const sceneItems = rawNodes.map((n, idx) => {
    const itemId = n.id || `node-${idx}`;
    
    // Scale pixel coords to Isoflow isometric grid units
    let tileX = Math.round((n.x || 0) / 120);
    const tileY = Math.round((n.y || 0) / 120);

    // If tile is occupied, shift tileX until an empty tile is found
    while (occupiedTiles.has(`${tileX},${tileY}`)) {
      tileX += 1;
    }
    occupiedTiles.add(`${tileX},${tileY}`);

    return {
      id: itemId,
      tile: {
        x: tileX,
        y: tileY
      }
    };
  });

  // 4. Validate connectors
  // Anchors MUST reference existing valid item IDs
  const validConnectors = rawConnectors
    .filter((c) => validItemIds.has(c.from) && validItemIds.has(c.to) && c.from !== c.to)
    .map((c, idx) => ({
      id: `iso-conn-${idx}`,
      color: 'c-blue',
      style: c.dashed ? ('DOTTED' as const) : ('SOLID' as const),
      anchors: [
        { ref: { item: c.from } },
        { ref: { item: c.to } }
      ]
    }));

  return {
    title: project.title || 'VisualStack Architecture',
    fitToScreen: true,
    icons: guaranteedIcons,
    colors: isoflowColors,
    items: validItems,
    views: [
      {
        id: 'main-view',
        name: 'Isometric Architecture',
        items: sceneItems,
        connectors: validConnectors
      }
    ]
  };
}