export interface VisualStackNode {
  id: string;
  clusterId?: string;
  label: string;
  subtext?: string;
  badge?: string;
  iconUrl?: string;
  color?: string;
  x: number;
  y: number;
  width: number;
  height: number;
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

export interface VisualStackConnector {
  id: string;
  from: string;
  to: string;
  label?: string;
  color: string;
  dashed?: boolean;
}

export interface VisualStackProject {
  id: string;
  title: string;
  updatedAt: string;
  activeTab: 'clean' | '2d' | '3d';
  cleanView: {
    clusters: VisualStackCluster[];
    nodes: VisualStackNode[];
    connectors: VisualStackConnector[];
  };
  detailed2DView: {
    nodes: VisualStackNode[];
    connectors: VisualStackConnector[];
  };
}