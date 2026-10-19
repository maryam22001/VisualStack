import type { VisualStackProject } from '../types/project';

const fallbackIcon = {
  id: 'icon-server',
  name: 'Server',
  url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><polygon points="50 15, 85 35, 50 55, 15 35" fill="%230284c7"/><polygon points="15 35, 50 55, 50 85, 15 65" fill="%230369a1"/><polygon points="85 35, 50 55, 50 85, 85 65" fill="%23075985"/></svg>',
  isIsometric: true
};

export const isoflowColors = [
  { id: 'c-blue', value: '#0284c7' },
  { id: 'c-green', value: '#10b981' },
  { id: 'c-amber', value: '#f59e0b' },
  { id: 'c-gray', value: '#64748b' }
];

export const ISOFLOW_TILE_SCALE = 100;

function shortDescription(description: string): string {
  const trimmed = description.trim();
  return trimmed.length > 64 ? `${trimmed.slice(0, 61).trimEnd()}…` : trimmed;
}

function platformColor(color: string): string {
  const match = /^#([\da-f]{6})$/i.exec(color);
  if (!match) return '#dbeafe';
  const channels = [0, 2, 4].map((offset) => parseInt(match[1].slice(offset, offset + 2), 16));
  return `#${channels.map((channel) => Math.round(channel + (255 - channel) * 0.82).toString(16).padStart(2, '0')).join('')}`;
}

export function convertProjectToIsoflowData(project: VisualStackProject) {
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
  const rawClusters = project?.cleanView?.clusters ?? [];

  const iconByUrl = new Map<string, string>();
  const icons = [fallbackIcon];
  const items = rawNodes.map((node, index) => {
    const iconUrl = node.iconUrl?.trim();
    let iconId = fallbackIcon.id;
    if (iconUrl) {
      iconId = iconByUrl.get(iconUrl) ?? `icon-component-${iconByUrl.size}`;
      if (!iconByUrl.has(iconUrl)) {
        iconByUrl.set(iconUrl, iconId);
        icons.push({ id: iconId, name: node.label || `Component ${index + 1}`, url: iconUrl, isIsometric: true });
      }
    }
    return {
      id: String(node.id || `node-${index}`),
      name: String(node.label || `Node ${index + 1}`),
      description: shortDescription(node.specs?.[0] || node.subtext || ''),
      icon: iconId
    };
  });
  const validIdSet = new Set(items.map((item) => item.id));

  const occupiedTiles = new Set<string>();
  const sceneItems = items.map((item, index) => {
    const node = rawNodes[index];
    const baseX = Math.round(node.x / ISOFLOW_TILE_SCALE);
    const baseY = Math.round(node.y / ISOFLOW_TILE_SCALE);
    let tileX = baseX;
    let tileY = baseY;
    while (occupiedTiles.has(`${tileX},${tileY}`)) {
      let radius = 1;
      let candidate: [number, number] | undefined;
      while (!candidate) {
        const perimeter: [number, number][] = [];
        for (let offset = -radius; offset <= radius; offset += 1) {
          perimeter.push(
            [baseX + offset, baseY - radius],
            [baseX + offset, baseY + radius]
          );
          if (offset !== -radius && offset !== radius) {
            perimeter.push([baseX - radius, baseY + offset], [baseX + radius, baseY + offset]);
          }
        }
        candidate = perimeter.find(([x, y]) => !occupiedTiles.has(`${x},${y}`));
        radius += 1;
      }
      [tileX, tileY] = candidate;
    }
    occupiedTiles.add(`${tileX},${tileY}`);
    return { id: item.id, tile: { x: tileX, y: tileY } };
  });

  const connectors = rawConnectors
    .filter((connector) => connector && validIdSet.has(String(connector.from)) && validIdSet.has(String(connector.to)) && connector.from !== connector.to)
    .map((connector, index) => ({
      id: String(connector.id || `iso-conn-${index}`),
      color: isoflowColors.find((color) => color.value === connector.color)?.id ?? 'c-blue',
      description: connector.label,
      style: connector.dashed ? ('DOTTED' as const) : ('SOLID' as const),
      anchors: [
        { id: `anchor-start-${index}`, ref: { item: String(connector.from) } },
        { id: `anchor-end-${index}`, ref: { item: String(connector.to) } }
      ]
    }));

  const rectangles = rawClusters.map((cluster) => ({
    cluster,
    color: platformColor(cluster.borderColor || '#0284c7')
  }));
  const colors = [...isoflowColors];
  const colorIds = new Map(colors.map((color) => [color.value.toLowerCase(), color.id]));
  const viewRectangles = rectangles.map(({ cluster, color }) => {
    let colorId = colorIds.get(color.toLowerCase());
    if (!colorId) {
      colorId = `c-zone-${colorIds.size}`;
      colorIds.set(color.toLowerCase(), colorId);
      colors.push({ id: colorId, value: color });
    }
    return {
      id: String(cluster.id),
      from: {
        x: Math.floor(cluster.x / ISOFLOW_TILE_SCALE) - 1,
        y: Math.floor(cluster.y / ISOFLOW_TILE_SCALE) - 1
      },
      to: {
        x: Math.ceil((cluster.x + cluster.width) / ISOFLOW_TILE_SCALE) + 1,
        y: Math.ceil((cluster.y + cluster.height) / ISOFLOW_TILE_SCALE) + 1
      },
      color: colorId
    };
  });

  return {
    title: project?.title || 'VisualStack Architecture',
    fitToView: true,
    icons,
    colors,
    items,
    views: [
      {
        id: 'main-view',
        name: 'Architecture View',
        items: sceneItems,
        connectors,
        rectangles: viewRectangles
      }
    ]
  };
}
