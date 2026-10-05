export interface VisualStackNode {
  id: string;
  label: string;
  subtext?: string;
  iconUrl?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  clusterId?: string;
  badge?: string;
  color?: string;
}

export interface VisualStackConnector {
  id: string;
  from: string;
  to: string;
  label?: string;
  color?: string;
  dashed?: boolean;
}

export interface VisualStackCluster {
  id: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  borderColor?: string;
}

export interface VisualStackProject {
  id?: string;
  title: string;
  activeTab: 'clean' | '2d' | '3d';
  clusters: VisualStackCluster[];
  nodes: VisualStackNode[];
  connectors: VisualStackConnector[];
}