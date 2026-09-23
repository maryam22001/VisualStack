import React, { useState,useEffect, useRef } from 'react';
import { IconPicker } from './IconPicker';
import type { IconResult } from './IconLibrary';
import type { VisualStackCluster, VisualStackNode, VisualStackConnector } from './types/project';
import { snapToGrid } from './utils/geometry';
export interface CleanArchitectureProps {
  theme?: 'dark' | 'light';
  clusters?: VisualStackCluster[];
  nodes?: VisualStackNode[];
  connectors?: VisualStackConnector[];
  onChange?: (data: {
    clusters: VisualStackCluster[];
    nodes: VisualStackNode[];
    connectors: VisualStackConnector[];
  }) => void;
}

const defaultClusters: VisualStackCluster[] = [
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
  },
  {
    id: 'cluster-data',
    title: 'Data & Persistence Mesh',
    x: 830,
    y: 120,
    width: 280,
    height: 380,
    color: 'rgba(245, 158, 11, 0.05)',
    borderColor: '#fbbf24'
  }
];

const defaultNodes: VisualStackNode[] = [
  {
    id: 'n-gateway',
    clusterId: 'cluster-edge',
    label: 'API Gateway',
    subtext: 'Kong / Envoy Proxy',
    iconUrl: 'https://api.iconify.design/logos/nginx.svg',
    x: 160,
    y: 200,
    width: 68,
    height: 64
  },
  {
    id: 'n-auth',
    clusterId: 'cluster-edge',
    label: 'OAuth Identity',
    subtext: 'JWT / Keycloak',
    iconUrl: 'https://api.iconify.design/logos/jwt-icon.svg',
    x: 160,
    y: 350,
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
  },
  {
    id: 'n-broker',
    clusterId: 'cluster-platform',
    label: 'Message Broker',
    subtext: 'Kafka Cluster :9092',
    iconUrl: 'https://api.iconify.design/logos/kafka.svg',
    x: 630,
    y: 180,
    width: 68,
    height: 64
  },
  {
    id: 'n-worker',
    clusterId: 'cluster-platform',
    label: 'Pipeline Worker',
    subtext: 'Celery / Node Workers',
    iconUrl: 'https://api.iconify.design/logos/nodejs-icon.svg',
    x: 545,
    y: 360,
    width: 68,
    height: 64
  },
  {
    id: 'n-postgres',
    clusterId: 'cluster-data',
    label: 'Primary Postgres',
    subtext: 'WAL Replication',
    iconUrl: 'https://api.iconify.design/logos/postgresql.svg',
    x: 935,
    y: 200,
    width: 68,
    height: 64
  },
  {
    id: 'n-redis',
    clusterId: 'cluster-data',
    label: 'Redis Cache',
    subtext: 'Cluster State & Tokens',
    iconUrl: 'https://api.iconify.design/logos/redis.svg',
    x: 935,
    y: 350,
    width: 68,
    height: 64
  }
];

const defaultConnectors: VisualStackConnector[] = [
  { id: 'c-1', from: 'n-gateway', to: 'n-orchestrator', label: 'gRPC / HTTP', color: '#0284c7' },
  { id: 'c-2', from: 'n-gateway', to: 'n-auth', label: 'Verify', color: '#64748b', dashed: true },
  { id: 'c-3', from: 'n-orchestrator', to: 'n-broker', label: 'Produce Event', color: '#059669' },
  { id: 'c-4', from: 'n-broker', to: 'n-worker', label: 'Consume Jobs', color: '#d97706' },
  { id: 'c-5', from: 'n-orchestrator', to: 'n-postgres', label: 'ACID Persist', color: '#0284c7' },
  { id: 'c-6', from: 'n-orchestrator', to: 'n-redis', label: 'Session Cache', color: '#dc2626', dashed: true }
];

export const CleanArchitectureView: React.FC<CleanArchitectureProps> = ({
  theme = 'light',
  clusters: propClusters,
  nodes: propNodes,
  connectors: propConnectors,
  onChange
}) => {
  const [clusters, setClusters] = useState<VisualStackCluster[]>(propClusters || defaultClusters);
  const [nodes, setNodes] = useState<VisualStackNode[]>(propNodes || defaultNodes);
  const [connectors, setConnectors] = useState<VisualStackConnector[]>(propConnectors || defaultConnectors);

  // Viewport Pan / Zoom
  const [scale, setScale] = useState<number>(0.85);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 60, y: 40 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Dragging Nodes / Clusters
  const [draggedNode, setDraggedNode] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [draggedCluster, setDraggedCluster] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);

  // Connection Wire tool
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Modals & Universal Icon Picker
  const [editingNode, setEditingNode] = useState<VisualStackNode | null>(null);
  const [editingCluster, setEditingCluster] = useState<VisualStackCluster | null>(null);
  const [pickerNodeId, setPickerNodeId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const connectorIdRef = useRef(0);
  const isDark = theme === 'dark';

  const notifyChange = (
    nextClusters = clusters,
    nextNodes = nodes,
    nextConnectors = connectors
  ) => {
    onChange?.({
      clusters: nextClusters,
      nodes: nextNodes,
      connectors: nextConnectors
    });
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newScale = Math.min(Math.max(scale * zoomFactor, 0.3), 3.0);
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      setPan({
        x: mouseX - (mouseX - pan.x) * (newScale / scale),
        y: mouseY - (mouseY - pan.y) * (newScale / scale)
      });
    }
    setScale(newScale);
  };
// Listen for Escape key to cancel active wiring or close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (connectingFrom) {
          e.preventDefault();
          setConnectingFrom(null);
        } else if (editingNode) {
          setEditingNode(null);
        } else if (editingCluster) {
          setEditingCluster(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [connectingFrom, editingNode, editingCluster]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (draggedNode || draggedCluster || editingNode || editingCluster || connectingFrom) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const canvasX = (e.clientX - pan.x) / scale;
    const canvasY = (e.clientY - pan.y) / scale;
    setMousePos({ x: canvasX, y: canvasY });

    if (draggedNode) {
      setNodes((prev) =>
        prev.map((n) =>
          n.id === draggedNode.id
            ? { ...n, x: canvasX - draggedNode.offsetX, y: canvasY - draggedNode.offsetY }
            : n
        )
      );
    } else if (draggedCluster) {
      setClusters((prev) =>
        prev.map((c) =>
          c.id === draggedCluster.id
            ? { ...c, x: canvasX - draggedCluster.offsetX, y: canvasY - draggedCluster.offsetY }
            : c
        )
      );
    } else if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
  };

  const handleMouseUp = () => {
    if (draggedNode) {
      const nextNodes = nodes.map((n) =>
        n.id === draggedNode.id
          ? { ...n, x: snapToGrid(n.x), y: snapToGrid(n.y) }
          : n
      );
      setNodes(nextNodes);
      notifyChange(clusters, nextNodes, connectors);
    } else if (draggedCluster) {
      const nextClusters = clusters.map((c) =>
        c.id === draggedCluster.id
          ? { ...c, x: snapToGrid(c.x), y: snapToGrid(c.y) }
          : c
      );
      setClusters(nextClusters);
      notifyChange(nextClusters, nodes, connectors);
    }
    setIsPanning(false);
    setDraggedNode(null);
    setDraggedCluster(null);
  };

  const getNodeCenter = (id: string) => {
    const n = nodes.find((node) => node.id === id);
    if (!n) return { x: 0, y: 0 };
    return { x: n.x + n.width / 2, y: n.y + n.height / 2 };
  };

  const handleAddCluster = () => {
    const id = `cluster-${Date.now()}`;
    const newCluster: VisualStackCluster = {
      id,
      title: 'New Service Cluster',
      x: 350,
      y: 200,
      width: 320,
      height: 260,
      color: isDark ? 'rgba(56, 189, 248, 0.05)' : 'rgba(2, 132, 199, 0.05)',
      borderColor: isDark ? '#38bdf8' : '#0284c7'
    };
    const nextClusters = [...clusters, newCluster];
    setClusters(nextClusters);
    setEditingCluster(newCluster);
    notifyChange(nextClusters, nodes, connectors);
  };

  const handleAddNode = () => {
    const id = `node-${Date.now()}`;
    const newNode: VisualStackNode = {
      id,
      label: 'new-service',
      subtext: 'Service Module',
      iconUrl: 'https://api.iconify.design/lucide/server.svg',
      x: 450,
      y: 250,
      width: 68,
      height: 64
    };
    const nextNodes = [...nodes, newNode];
    setNodes(nextNodes);
    setEditingNode(newNode);
    notifyChange(clusters, nextNodes, connectors);
  };

  const handlePortClick = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    if (!connectingFrom) {
      setConnectingFrom(nodeId);
    } else {
      if (connectingFrom !== nodeId) {
        const nextConnectors = [
          ...connectors,
          {
            id: `conn-${connectorIdRef.current++}`,
            from: connectingFrom,
            to: nodeId,
            label: 'Data Link',
            color: isDark ? '#38bdf8' : '#0284c7'
          }
        ];
        setConnectors(nextConnectors);
        notifyChange(clusters, nodes, nextConnectors);
      }
      setConnectingFrom(null);
    }
  };

  const handleDeleteConnector = (id: string) => {
    const nextConnectors = connectors.filter((c) => c.id !== id);
    setConnectors(nextConnectors);
    notifyChange(clusters, nodes, nextConnectors);
  };

  const handleDeleteNode = (id: string) => {
    const nextNodes = nodes.filter((n) => n.id !== id);
    const nextConnectors = connectors.filter((c) => c.from !== id && c.to !== id);
    setNodes(nextNodes);
    setConnectors(nextConnectors);
    setEditingNode(null);
    notifyChange(clusters, nextNodes, nextConnectors);
  };

  const handleDeleteCluster = (id: string) => {
    const nextClusters = clusters.filter((c) => c.id !== id);
    setClusters(nextClusters);
    setEditingCluster(null);
    notifyChange(nextClusters, nodes, connectors);
  };

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        background: isDark ? '#0b1120' : '#ffffff',
        overflow: 'hidden',
        userSelect: 'none',
        cursor: isPanning ? 'grabbing' : connectingFrom ? 'crosshair' : 'default'
      }}
    >
      {/* Top Floating Control Bar */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 20,
          display: 'flex',
          gap: '8px',
          zIndex: 40,
          background: isDark ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          padding: '6px 12px',
          borderRadius: '8px',
          border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
        }}
      >
        <button
          onClick={handleAddCluster}
          style={{
            padding: '6px 12px',
            background: '#e0f2fe',
            color: '#0369a1',
            border: '1px solid #7dd3fc',
            borderRadius: '6px',
            fontWeight: '600',
            fontSize: '12px',
            cursor: 'pointer'
          }}
        >
          + Add Enclosure Pod
        </button>

        <button
          onClick={handleAddNode}
          style={{
            padding: '6px 12px',
            background: '#0284c7',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            fontWeight: '600',
            fontSize: '12px',
            cursor: 'pointer'
          }}
        >
          + Add Service Node
        </button>

        {connectingFrom && (
          <button
            onClick={() => setConnectingFrom(null)}
            style={{
              padding: '6px 12px',
              background: '#ef4444',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: '600',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            Cancel Cable
          </button>
        )}
      </div>

      {/* Floating Zoom Controls */}
      <div
        style={{
          position: 'absolute',
          bottom: 24,
          right: 24,
          background: isDark ? 'rgba(30, 41, 59, 0.9)' : 'rgba(255, 255, 255, 0.95)',
          border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
          borderRadius: '8px',
          padding: '6px 12px',
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          zIndex: 40
        }}
      >
        <button
          onClick={() => setScale((s) => Math.min(s * 1.15, 3.0))}
          style={{
            width: '28px',
            height: '28px',
            background: isDark ? '#334155' : '#e2e8f0',
            color: isDark ? '#fff' : '#0f172a',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          +
        </button>
        <span style={{ fontSize: '12px', fontWeight: 'bold', color: isDark ? '#94a3b8' : '#475569', minWidth: '40px', textAlign: 'center' }}>
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={() => setScale((s) => Math.max(s * 0.85, 0.3))}
          style={{
            width: '28px',
            height: '28px',
            background: isDark ? '#334155' : '#e2e8f0',
            color: isDark ? '#fff' : '#0f172a',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          -
        </button>
        <button
          onClick={() => {
            setScale(0.85);
            setPan({ x: 60, y: 40 });
          }}
          style={{
            padding: '0 10px',
            height: '28px',
            background: '#0284c7',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: 'bold'
          }}
        >
          Reset View
        </button>
      </div>

      {/* Main SVG Canvas */}
      <svg
        id="aegisot-clean-svg"
        style={{
          width: '100%',
          height: '100%',
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          transformOrigin: '0 0',
          overflow: 'visible'
        }}
      >
        <defs>
          {/* Background Grid */}
  <rect x="-5000" y="-5000" width="10000" height="10000" fill="url(#canvas-grid-dots)" />
          <pattern id="canvas-grid-dots" width="20" height="20" patternUnits="userSpaceOnUse">
    <circle cx="2" cy="2" r="1.2" fill={isDark ? '#334155' : '#cbd5e1'} opacity="0.6" />
  </pattern>
          <marker id="clean-arr-blue" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#0284c7" />
          </marker>
          <marker id="clean-arr-green" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#059669" />
          </marker>
          <marker id="clean-arr-amber" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#d97706" />
          </marker>
          <marker id="clean-arr-red" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#dc2626" />
          </marker>
          <marker id="clean-arr-gray" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#64748b" />
          </marker>
        </defs>

        {/* 1. Clusters */}
        {clusters.map((c) => (
          <g
            key={c.id}
            transform={`translate(${c.x}, ${c.y})`}
            onMouseDown={(e) => {
              e.stopPropagation();
              const mouseX = (e.clientX - pan.x) / scale;
              const mouseY = (e.clientY - pan.y) / scale;
              setDraggedCluster({ id: c.id, offsetX: mouseX - c.x, offsetY: mouseY - c.y });
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditingCluster(c);
            }}
            style={{ cursor: 'move' }}
          >
            <rect
              width={c.width}
              height={c.height}
              rx="18"
              fill={c.color || (isDark ? 'rgba(30, 41, 59, 0.4)' : '#f8fafc')}
              stroke={c.borderColor || (isDark ? '#38bdf8' : '#a9cce3')}
              strokeWidth="2"
            />
            <text
              x="20"
              y="32"
              fontSize="16"
              fontWeight="700"
              fontFamily="system-ui, -apple-system, sans-serif"
              fill={isDark ? '#e2e8f0' : '#1e293b'}
            >
              {c.title}
            </text>
          </g>
        ))}

        {/* 2. Connectors */}
        {connectors.map((line) => {
          const from = getNodeCenter(line.from);
          const to = getNodeCenter(line.to);
          const midX = (from.x + to.x) / 2;
          const pathD = `M ${from.x} ${from.y} L ${midX} ${from.y} L ${midX} ${to.y} L ${to.x} ${to.y}`;

          const marker =
            line.color === '#059669'
              ? 'url(#clean-arr-green)'
              : line.color === '#d97706'
              ? 'url(#clean-arr-amber)'
              : line.color === '#dc2626'
              ? 'url(#clean-arr-red)'
              : line.color === '#64748b'
              ? 'url(#clean-arr-gray)'
              : 'url(#clean-arr-blue)';

          return (
            <g key={line.id} onDoubleClick={() => handleDeleteConnector(line.id)} style={{ cursor: 'pointer' }}>
              <path
                d={pathD}
                stroke={line.color}
                strokeWidth="2"
                strokeDasharray={line.dashed ? '6 4' : 'none'}
                fill="none"
                markerEnd={marker}
              />
              {line.label && (
                <text
                  x={midX}
                  y={(from.y + to.y) / 2 - 6}
                  fontSize="11"
                  fill={isDark ? '#94a3b8' : '#475569'}
                  textAnchor="middle"
                  fontWeight="600"
                >
                  {line.label}
                </text>
              )}
            </g>
          );
        })}

        {/* Cable Drag Preview */}
        {connectingFrom && (
          <line
            x1={getNodeCenter(connectingFrom).x}
            y1={getNodeCenter(connectingFrom).y}
            x2={mousePos.x}
            y2={mousePos.y}
            stroke="#0284c7"
            strokeWidth="2"
            strokeDasharray="4 4"
          />
        )}

        {/* 3. Nodes */}
        {nodes.map((node) => (
          <g
            key={node.id}
            transform={`translate(${node.x}, ${node.y})`}
            onMouseDown={(e) => {
              e.stopPropagation();
              const mouseX = (e.clientX - pan.x) / scale;
              const mouseY = (e.clientY - pan.y) / scale;
              setDraggedNode({ id: node.id, offsetX: mouseX - node.x, offsetY: mouseY - node.y });
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditingNode(node);
            }}
            style={{ cursor: 'move' }}
          >
            <rect width={node.width} height={node.height + 36} fill="transparent" />

           {node.iconUrl && node.iconUrl.trim() !== '' ? (
  <image
    href={node.iconUrl}
    x={(node.width - 48) / 2}
    y={0}
    width={48}
    height={48}
    preserveAspectRatio="xMidYMid meet"
    onError={(e) => {
      // Hide broken image link if the CDN or URL fails
      (e.currentTarget as SVGImageElement).style.display = 'none';
    }}
  />
) : (
  <g>
    <circle cx={node.width / 2} cy={24} r={22} fill="#0284c7" opacity={0.15} />
    <text
      x={node.width / 2}
      y={29}
      fontSize="16"
      textAnchor="middle"
      fill="#0284c7"
      fontWeight="bold"
    >
      {node.label ? node.label.charAt(0).toUpperCase() : '■'}
    </text>
  </g>
)}

            <text
              x={node.width / 2}
              y={node.height + 14}
              fontSize="13"
              fontWeight="700"
              fontFamily="system-ui, -apple-system, sans-serif"
              fill={isDark ? '#f8fafc' : '#0f172a'}
              textAnchor="middle"
            >
              {node.label}
            </text>

            {node.subtext && (
              <text
                x={node.width / 2}
                y={node.height + 28}
                fontSize="11"
                fill={isDark ? '#94a3b8' : '#64748b'}
                textAnchor="middle"
              >
                {node.subtext}
              </text>
            )}

            <circle
              cx={node.width + 4}
              cy={24}
              r="6"
              fill={connectingFrom === node.id ? '#ef4444' : '#0284c7'}
              stroke="#ffffff"
              strokeWidth="1.5"
              style={{ cursor: 'pointer' }}
              onClick={(e) => handlePortClick(e, node.id)}
            />
          </g>
        ))}
      </svg>

      {/* Edit Node Modal */}
      {editingNode && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100
          }}
          onClick={() => setEditingNode(null)}
        >
          <div
            style={{
              background: isDark ? '#1e293b' : '#ffffff',
              color: isDark ? '#f8fafc' : '#0f172a',
              padding: '24px',
              borderRadius: '12px',
              width: '420px',
              border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 16px 0', fontSize: '17px', fontWeight: 'bold' }}>
              Edit Node: {editingNode.label}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                  Node Label
                </label>
                <input
                  type="text"
                  value={editingNode.label}
                  onChange={(e) => setEditingNode({ ...editingNode, label: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
                    background: isDark ? '#0f172a' : '#f8fafc',
                    color: isDark ? '#f8fafc' : '#0f172a'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                  Subtitle / Detail Text
                </label>
                <input
                  type="text"
                  value={editingNode.subtext || ''}
                  onChange={(e) => setEditingNode({ ...editingNode, subtext: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
                    background: isDark ? '#0f172a' : '#f8fafc',
                    color: isDark ? '#f8fafc' : '#0f172a'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                  Component Tool Icon
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {editingNode.iconUrl && (
                    <img src={editingNode.iconUrl} alt="icon" style={{ width: 36, height: 36, objectFit: 'contain' }} />
                  )}
                  <button
                    type="button"
                    onClick={() => setPickerNodeId(editingNode.id)}
                    style={{
                      padding: '8px 14px',
                      background: '#0284c7',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    🔍 Change Tool Icon (200k+)
                  </button>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '22px' }}>
              <button
                onClick={() => handleDeleteNode(editingNode.id)}
                style={{
                  padding: '7px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#ef4444',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Delete Node
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setEditingNode(null)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '6px',
                    border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
                    background: 'transparent',
                    color: isDark ? '#cbd5e1' : '#475569',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const nextNodes = nodes.map((n) => (n.id === editingNode.id ? editingNode : n));
                    setNodes(nextNodes);
                    setEditingNode(null);
                    notifyChange(clusters, nextNodes, connectors);
                  }}
                  style={{
                    padding: '7px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    background: '#0284c7',
                    color: '#fff',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Cluster Modal */}
      {editingCluster && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100
          }}
          onClick={() => setEditingCluster(null)}
        >
          <div
            style={{
              background: isDark ? '#1e293b' : '#ffffff',
              color: isDark ? '#f8fafc' : '#0f172a',
              padding: '24px',
              borderRadius: '12px',
              width: '380px',
              border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 16px 0', fontSize: '17px', fontWeight: 'bold' }}>
              Edit Enclosure Pod
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                  Pod Title
                </label>
                <input
                  type="text"
                  value={editingCluster.title}
                  onChange={(e) => setEditingCluster({ ...editingCluster, title: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
                    background: isDark ? '#0f172a' : '#f8fafc',
                    color: isDark ? '#f8fafc' : '#0f172a'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                    Width (px)
                  </label>
                  <input
                    type="number"
                    value={editingCluster.width}
                    onChange={(e) => setEditingCluster({ ...editingCluster, width: Number(e.target.value) })}
                    style={{
                      width: '100%',
                      padding: '8px',
                      borderRadius: '6px',
                      border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
                      background: isDark ? '#0f172a' : '#f8fafc',
                      color: isDark ? '#f8fafc' : '#0f172a'
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                    Height (px)
                  </label>
                  <input
                    type="number"
                    value={editingCluster.height}
                    onChange={(e) => setEditingCluster({ ...editingCluster, height: Number(e.target.value) })}
                    style={{
                      width: '100%',
                      padding: '8px',
                      borderRadius: '6px',
                      border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
                      background: isDark ? '#0f172a' : '#f8fafc',
                      color: isDark ? '#f8fafc' : '#0f172a'
                    }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '22px' }}>
              <button
                onClick={() => handleDeleteCluster(editingCluster.id)}
                style={{
                  padding: '7px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#ef4444',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Delete Pod
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setEditingCluster(null)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '6px',
                    border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
                    background: 'transparent',
                    color: isDark ? '#cbd5e1' : '#475569',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const nextClusters = clusters.map((c) => (c.id === editingCluster.id ? editingCluster : c));
                    setClusters(nextClusters);
                    setEditingCluster(null);
                    notifyChange(nextClusters, nodes, connectors);
                  }}
                  style={{
                    padding: '7px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    background: '#0284c7',
                    color: '#fff',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Universal Icon Picker Modal */}
      {pickerNodeId && (
        <IconPicker
          isOpen={Boolean(pickerNodeId)}
          theme={theme}
          onClose={() => setPickerNodeId(null)}
          onSelect={(icon: IconResult) => {
            const nextNodes = nodes.map((n) =>
              n.id === pickerNodeId ? { ...n, iconUrl: icon.url } : n
            );
            setNodes(nextNodes);
            if (editingNode && editingNode.id === pickerNodeId) {
              setEditingNode({ ...editingNode, iconUrl: icon.url });
            }
            notifyChange(clusters, nextNodes, connectors);
            setPickerNodeId(null);
          }}
        />
      )}
    </div>
  );
};