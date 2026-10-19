import type {
  VisualStackCluster,
  VisualStackConnector,
  VisualStackNode,
  VisualStackProject
} from '../types/project';
import { defaultProject } from './storage';

type JsonObject = Record<string, unknown>;

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

const readNumber = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const readSpecs = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((spec) => {
    if (typeof spec === 'string' && spec.trim()) return [spec.trim()];
    if (isObject(spec)) {
      const label = readString(spec.label) ?? readString(spec.name) ?? readString(spec.key);
      const detail = readString(spec.value) ?? readString(spec.description);
      if (label && detail) return [`${label}: ${detail}`];
      const text = label ?? detail;
      if (text) return [text];
    }
    return [];
  });
};

function parseVisualStackProject(value: JsonObject): VisualStackProject | null {
  const hasProjectView = 'cleanView' in value || 'detailed2DView' in value;
  if (!hasProjectView) return null;

  const clean = isObject(value.cleanView) ? value.cleanView : {};
  const detailed = isObject(value.detailed2DView) ? value.detailed2DView : {};
  const rawClusters = clean.clusters ?? [];
  const rawCleanNodes = clean.nodes ?? [];
  const rawCleanConnectors = clean.connectors ?? [];
  const rawDetailedNodes = detailed.nodes ?? [];
  const rawDetailedConnectors = detailed.connectors ?? [];

  if (![rawClusters, rawCleanNodes, rawCleanConnectors, rawDetailedNodes, rawDetailedConnectors].every(Array.isArray)) {
    throw new Error('VisualStack projects must contain arrays for nodes, enclosures, and connections.');
  }

  const clusters = rawClusters as VisualStackCluster[];
  const cleanNodes = rawCleanNodes as VisualStackNode[];
  const cleanConnectors = rawCleanConnectors as VisualStackConnector[];
  const detailedNodes = rawDetailedNodes as VisualStackNode[];
  const detailedConnectors = rawDetailedConnectors as VisualStackConnector[];

  return {
    ...defaultProject,
    ...value,
    id: readString(value.id) ?? defaultProject.id,
    title: readString(value.title) ?? 'Imported Architecture',
    updatedAt: readString(value.updatedAt) ?? new Date().toISOString(),
    activeTab: value.activeTab === '2d' || value.activeTab === '3d' ? value.activeTab : 'clean',
    cleanView: {
      clusters,
      nodes: cleanNodes.length ? cleanNodes : detailedNodes,
      connectors: cleanConnectors.length ? cleanConnectors : detailedConnectors
    },
    detailed2DView: {
      nodes: detailedNodes.length ? detailedNodes : cleanNodes,
      connectors: detailedConnectors.length ? detailedConnectors : cleanConnectors
    }
  };
}

function firstArray(source: JsonObject, keys: string[]): unknown[] | undefined {
  for (const key of keys) {
    if (Array.isArray(source[key])) return source[key];
  }
  return undefined;
}

export function parseJsonToDesign(value: unknown): VisualStackProject {
  if (!isObject(value)) {
    throw new Error('The JSON root must be an object containing components or a VisualStack project.');
  }

  const project = parseVisualStackProject(value);
  if (project) return project;

  const rawNodes = firstArray(value, ['nodes', 'components', 'services', 'items']);
  if (!rawNodes) {
    throw new Error('No components found. Add a "nodes", "components", "services", or "items" array.');
  }
  if (!rawNodes.length) throw new Error('Add at least one component to the JSON before importing.');

  const rawClusters = firstArray(value, ['clusters', 'enclosures', 'groups', 'zones']) ?? [];
  const clusters: VisualStackCluster[] = rawClusters.map((rawCluster, index) => {
    if (!isObject(rawCluster)) throw new Error(`Enclosure ${index + 1} must be an object.`);
    const id = readString(rawCluster.id) ?? `enclosure-${index + 1}`;
    return {
      id,
      title: readString(rawCluster.title) ?? readString(rawCluster.name) ?? `Enclosure ${index + 1}`,
      x: readNumber(rawCluster.x, 100 + index * 300),
      y: readNumber(rawCluster.y, 100),
      width: Math.max(120, readNumber(rawCluster.width, 280)),
      height: Math.max(100, readNumber(rawCluster.height, 220)),
      color: readString(rawCluster.color) ?? 'rgba(2, 132, 199, 0.05)',
      borderColor: readString(rawCluster.borderColor) ?? '#0284c7'
    };
  });
  const clusterIds = new Set(clusters.map((cluster) => cluster.id));

  const nodes: VisualStackNode[] = rawNodes.map((rawNode, index) => {
    if (!isObject(rawNode)) throw new Error(`Component ${index + 1} must be an object.`);
    const id = readString(rawNode.id) ?? readString(rawNode.key) ?? `component-${index + 1}`;
    const clusterId = readString(rawNode.clusterId) ?? readString(rawNode.groupId) ?? readString(rawNode.zoneId);
    if (clusterId && !clusterIds.has(clusterId)) {
      throw new Error(`Component "${readString(rawNode.label) ?? readString(rawNode.name) ?? id}" references an unknown enclosure "${clusterId}".`);
    }
    const column = index % 4;
    const row = Math.floor(index / 4);
    return {
      id,
      ...(clusterId ? { clusterId } : {}),
      label: readString(rawNode.label) ?? readString(rawNode.name) ?? readString(rawNode.title) ?? `Component ${index + 1}`,
      subtext: readString(rawNode.subtext) ?? readString(rawNode.description) ?? readString(rawNode.purpose),
      badge: readString(rawNode.badge) ?? readString(rawNode.category) ?? readString(rawNode.type),
      iconUrl: readString(rawNode.iconUrl) ?? readString(rawNode.icon),
      color: readString(rawNode.color) ?? '#0284c7',
      specs: [
        ...readSpecs(rawNode.specs ?? rawNode.details ?? rawNode.attributes),
        ...([
          ['Technology', rawNode.technology],
          ['Version', rawNode.version],
          ['Protocol', rawNode.protocol]
        ] as const).flatMap(([name, detail]) => {
          const value = readString(detail);
          return value ? [`${name}: ${value}`] : [];
        })
      ],
      x: readNumber(rawNode.x, 100 + column * 230),
      y: readNumber(rawNode.y, 120 + row * 150),
      width: Math.max(80, readNumber(rawNode.width, 190)),
      height: Math.max(64, readNumber(rawNode.height, 90))
    };
  });

  const nodeIds = new Set(nodes.map((node) => node.id));
  if (nodeIds.size !== nodes.length) throw new Error('Component ids must be unique.');
  if (new Set(clusters.map((cluster) => cluster.id)).size !== clusters.length) {
    throw new Error('Enclosure ids must be unique.');
  }

  const nodeIdsByReference = new Map<string, Set<string>>();
  rawNodes.forEach((rawNode, index) => {
    if (!isObject(rawNode)) return;
    const nodeId = nodes[index].id;
    const references = [
      rawNode.id,
      rawNode.key,
      rawNode.name,
      rawNode.label,
      rawNode.title
    ].map(readString).filter((reference): reference is string => reference !== undefined);
    for (const reference of references) {
      const normalized = reference.toLowerCase();
      const matches = nodeIdsByReference.get(normalized) ?? new Set<string>();
      matches.add(nodeId);
      nodeIdsByReference.set(normalized, matches);
    }
  });

  const resolveNodeReference = (reference: string, connectionIndex: number, endpoint: string): string => {
    if (nodeIds.has(reference)) return reference;
    const matches = nodeIdsByReference.get(reference.toLowerCase());
    const match = matches?.values().next();
    if (matches?.size === 1 && match?.value) return match.value;
    if (matches && matches.size > 1) {
      throw new Error(`Connection ${connectionIndex} has an ambiguous ${endpoint} reference "${reference}". Use a unique component id.`);
    }
    throw new Error(`Connection ${connectionIndex} references a component "${reference}" that does not exist.`);
  };

  const rawConnectors = firstArray(value, ['connectors', 'connections', 'edges', 'links']) ?? [];
  const connectors: VisualStackConnector[] = rawConnectors.map((rawConnector, index) => {
    if (!isObject(rawConnector)) throw new Error(`Connection ${index + 1} must be an object.`);
    const from = readString(rawConnector.from) ?? readString(rawConnector.source);
    const to = readString(rawConnector.to) ?? readString(rawConnector.target);
    if (!from || !to) throw new Error(`Connection ${index + 1} needs "from"/"to" or "source"/"target" component ids.`);
    const resolvedFrom = resolveNodeReference(from, index + 1, 'source');
    const resolvedTo = resolveNodeReference(to, index + 1, 'target');
    const rawDashed = rawConnector.dashed ?? String(rawConnector.style).toLowerCase() === 'dotted';
    return {
      id: readString(rawConnector.id) ?? `connection-${index + 1}`,
      from: resolvedFrom,
      to: resolvedTo,
      label: readString(rawConnector.label) ?? readString(rawConnector.name) ?? readString(rawConnector.description),
      color: readString(rawConnector.color) ?? '#0284c7',
      dashed: typeof rawDashed === 'boolean' ? rawDashed : String(rawConnector.style).toLowerCase() === 'dotted'
    };
  });
  if (new Set(connectors.map((connector) => connector.id)).size !== connectors.length) {
    throw new Error('Connection ids must be unique.');
  }

  const title = readString(value.title) ?? readString(value.name) ?? readString(value.architecture) ?? 'Imported Architecture';
  return {
    ...defaultProject,
    id: `proj-${window.crypto?.randomUUID ? window.crypto.randomUUID() : Date.now().toString(36)}`,
    title,
    updatedAt: new Date().toISOString(),
    activeTab: 'clean',
    cleanView: { clusters, nodes, connectors },
    detailed2DView: { nodes, connectors }
  };
}
