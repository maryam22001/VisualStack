import React, { useState, useEffect, useRef, useCallback } from 'react';
import { IconPicker } from './IconPicker';
import type { IconResult } from './IconLibrary';
import type { VisualStackNode, VisualStackConnector } from './types/project';
import { snapToGrid } from './utils/geometry';
export interface Architecture2DProps {
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
  nodes?: VisualStackNode[];
  connectors?: VisualStackConnector[];
  onChange?: (data: {
    nodes: VisualStackNode[];
    connectors: VisualStackConnector[];
  }) => void;
}

const initialNodes: VisualStackNode[] = [
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
  },
  {
    id: 'node-broker',
    label: 'Event Streaming Broker',
    subtext: 'High-Throughput Bus',
    badge: 'Kafka / MQTT',
    iconUrl: 'https://api.iconify.design/logos/kafka.svg',
    color: '#d97706',
    x: 650,
    y: 110,
    width: 200,
    height: 90
  },
  {
    id: 'node-db',
    label: 'Primary Database',
    subtext: 'Relational & Analytical',
    badge: 'PostgreSQL HA',
    iconUrl: 'https://api.iconify.design/logos/postgresql.svg',
    color: '#0284c7',
    x: 650,
    y: 330,
    width: 200,
    height: 90
  },
  {
    id: 'node-worker',
    label: 'AI & Inference Worker',
    subtext: 'Async Pipeline Runner',
    badge: 'Python / PyTorch',
    iconUrl: 'https://api.iconify.design/logos/python.svg',
    color: '#9333ea',
    x: 940,
    y: 110,
    width: 200,
    height: 90
  }
];

const initialConnectors: VisualStackConnector[] = [
  { id: 'conn-1', from: 'node-client', to: 'node-api', label: 'REST / TLS', color: '#0284c7' },
  { id: 'conn-2', from: 'node-api', to: 'node-broker', label: 'Produce Event', color: '#d97706' },
  { id: 'conn-3', from: 'node-api', to: 'node-db', label: 'Read / Write', color: '#0284c7', dashed: true },
  { id: 'conn-4', from: 'node-broker', to: 'node-worker', label: 'Event Trigger', color: '#9333ea' }
];

export const Architecture2D: React.FC<Architecture2DProps> = ({
  theme = 'light',
  onToggleTheme,
  nodes: propNodes,
  connectors: propConnectors,
  onChange
}) => {
  const [nodes, setNodes] = useState<VisualStackNode[]>(propNodes || initialNodes);
  const [connectors, setConnectors] = useState<VisualStackConnector[]>(propConnectors || initialConnectors);

  // Viewport Pan / Zoom
  const [scale, setScale] = useState(0.9);
  const [pan, setPan] = useState({ x: 50, y: 50 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Dragging Nodes
  const [draggedNode, setDraggedNode] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);

  // Connection Wire tool
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Modals & Pickers
  const [editingNode, setEditingNode] = useState<VisualStackNode | null>(null);
  const [pickerNodeId, setPickerNodeId] = useState<string | null>(null);
  const connectorIdRef = useRef(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const isDark = theme === 'dark';

  const notifyChange = useCallback((nextNodes = nodes, nextConnectors = connectors) => {
    onChange?.({ nodes: nextNodes, connectors: nextConnectors });
  }, [onChange, nodes, connectors]);

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
// Listen for Escape key to cancel cable wiring or close modals
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) return;

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodeId) {
        e.preventDefault();
        const nextNodes = nodes.filter((n) => n.id !== selectedNodeId);
        const nextConnectors = connectors.filter((c) => c.from !== selectedNodeId && c.to !== selectedNodeId);
        notifyChange(nextNodes, nextConnectors);
        setSelectedNodeId(null);
      } else if (e.key === 'Escape') {
        setSelectedNodeId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, nodes, connectors, notifyChange]);

  
  const handleMouseDown = (e: React.MouseEvent) => {
    if (draggedNode || editingNode || connectingFrom) return;
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
    } else if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
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
      notifyChange(nextNodes, connectors);
    }
    setIsPanning(false);
    setDraggedNode(null);
  };

  const getNodeCenter = (id: string) => {
    const n = nodes.find((node) => node.id === id);
    if (!n) return { x: 0, y: 0 };
    return { x: n.x + n.width / 2, y: n.y + n.height / 2 };
  };

  const handleAddNode = () => {
    const id = `node-${Date.now()}`;
    const newNode: VisualStackNode = {
      id,
      label: 'New Microservice',
      subtext: 'Custom Component',
      badge: 'TCP / RPC',
      iconUrl: 'https://api.iconify.design/lucide/box.svg',
      color: '#0284c7',
      x: 350,
      y: 200,
      width: 190,
      height: 90
    };
    const nextNodes = [...nodes, newNode];
    setNodes(nextNodes);
    setEditingNode(newNode);
    notifyChange(nextNodes, connectors);
  };

  const handleConnectPortClick = (e: React.MouseEvent, nodeId: string) => {
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
            label: 'Data Sync',
            color: isDark ? '#38bdf8' : '#0284c7'
          }
        ];
        setConnectors(nextConnectors);
        notifyChange(nodes, nextConnectors);
      }
      setConnectingFrom(null);
    }
  };

  const handleDeleteConnector = (id: string) => {
    const nextConnectors = connectors.filter((c) => c.id !== id);
    setConnectors(nextConnectors);
    notifyChange(nodes, nextConnectors);
  };

  const handleDeleteNode = (id: string) => {
    const nextNodes = nodes.filter((n) => n.id !== id);
    const nextConnectors = connectors.filter((c) => c.from !== id && c.to !== id);
    setNodes(nextNodes);
    setConnectors(nextConnectors);
    setEditingNode(null);
    notifyChange(nextNodes, nextConnectors);
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
        background: isDark ? '#0b1120' : '#f8fafc',
        overflow: 'hidden',
        userSelect: 'none',
        cursor: isPanning ? 'grabbing' : connectingFrom ? 'crosshair' : 'default'
      }}
    >
      {/* Action Bar */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 20,
          display: 'flex',
          gap: '8px',
          zIndex: 30,
          background: isDark ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          padding: '6px 12px',
          borderRadius: '8px',
          border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}
      >
        <button
          onClick={handleAddNode}
          style={{
            padding: '6px 14px',
            background: '#0284c7',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            fontWeight: '600',
            fontSize: '12px',
            cursor: 'pointer'
          }}
        >
          + Add Architecture Node
        </button>

        {connectingFrom && (
          <button
            onClick={() => setConnectingFrom(null)}
            style={{
              padding: '6px 12px',
              background: '#ef4444',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: '600',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            Cancel Cable Wiring
          </button>
        )}
      </div>

      {/* Floating Zoom Controls */}
      <div
        style={{
          position: 'absolute',
          bottom: 20,
          right: 20,
          display: 'flex',
          gap: '6px',
          zIndex: 30,
          background: isDark ? 'rgba(30, 41, 59, 0.9)' : 'rgba(255, 255, 255, 0.9)',
          padding: '6px 10px',
          borderRadius: '8px',
          border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
          alignItems: 'center'
        }}
      >
        <button
          onClick={() => setScale((s) => Math.min(s * 1.15, 3.0))}
          style={{ width: '28px', height: '28px', borderRadius: '4px', border: 'none', background: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#fff' : '#000', cursor: 'pointer', fontWeight: 'bold' }}
        >
          +
        </button>
        <span style={{ fontSize: '12px', fontWeight: 'bold', color: isDark ? '#94a3b8' : '#64748b', minWidth: '40px', textAlign: 'center' }}>
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={() => setScale((s) => Math.max(s * 0.85, 0.3))}
          style={{ width: '28px', height: '28px', borderRadius: '4px', border: 'none', background: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#fff' : '#000', cursor: 'pointer', fontWeight: 'bold' }}
        >
          -
        </button>
        <button
          onClick={() => {
            setScale(0.9);
            setPan({ x: 50, y: 50 });
          }}
          style={{ padding: '0 8px', height: '28px', borderRadius: '4px', border: 'none', background: '#0284c7', color: '#fff', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          Reset
        </button>
        {onToggleTheme && (
          <button
            onClick={onToggleTheme}
            style={{ padding: '0 8px', height: '28px', borderRadius: '4px', border: 'none', background: isDark ? '#475569' : '#cbd5e1', color: isDark ? '#fff' : '#0f172a', fontSize: '11px', cursor: 'pointer' }}
          >
            {isDark ? '☀️' : '🌙'}
          </button>
        )}
      </div>

      {/* SVG Canvas */}
      <svg
        id="aegisot-2d-svg"
        style={{
          width: '100%',
          height: '100%',
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          transformOrigin: '0 0',
          overflow: 'visible'
        }}
      >
        <defs>
          <rect x="-5000" y="-5000" width="10000" height="10000" fill="url(#canvas-grid-2d)" />
          <pattern id="canvas-grid-2d" width="20" height="20" patternUnits="userSpaceOnUse">
    <circle cx="2" cy="2" r="1.2" fill={isDark ? '#334155' : '#cbd5e1'} opacity="0.6" />
  </pattern>
          <marker id="arrow-blue" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#0284c7" />
          </marker>
          <marker id="arrow-amber" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#d97706" />
          </marker>
          <marker id="arrow-purple" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#9333ea" />
          </marker>
        </defs>

        {/* Connectors */}
        {connectors.map((conn) => {
          const from = getNodeCenter(conn.from);
          const to = getNodeCenter(conn.to);
          const midX = (from.x + to.x) / 2;
          const pathD = `M ${from.x} ${from.y} L ${midX} ${from.y} L ${midX} ${to.y} L ${to.x} ${to.y}`;

          const marker =
            conn.color === '#d97706'
              ? 'url(#arrow-amber)'
              : conn.color === '#9333ea'
              ? 'url(#arrow-purple)'
              : 'url(#arrow-blue)';

          return (
            <g key={conn.id} onDoubleClick={() => handleDeleteConnector(conn.id)} style={{ cursor: 'pointer' }}>
              <path
                d={pathD}
                stroke={conn.color}
                strokeWidth="2.2"
                strokeDasharray={conn.dashed ? '6 4' : 'none'}
                fill="none"
                markerEnd={marker}
              />
              {conn.label && (
                <text
                  x={midX}
                  y={(from.y + to.y) / 2 - 6}
                  fontSize="11"
                  fill={isDark ? '#94a3b8' : '#475569'}
                  textAnchor="middle"
                  fontWeight="600"
                >
                  {conn.label}
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

        {/* Nodes */}
        {nodes.map((node) => {
          const isSelected = selectedNodeId === node.id;
          return (
            <g
              key={node.id}
              transform={`translate(${node.x}, ${node.y})`}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedNodeId(node.id);
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                setSelectedNodeId(node.id);
                const mouseX = (e.clientX - pan.x) / scale;
                const mouseY = (e.clientY - pan.y) / scale;
                setDraggedNode({ id: node.id, offsetX: mouseX - node.x, offsetY: mouseY - node.y });
              }}
              style={{ cursor: 'move' }}
            >
              <rect
                width={node.width}
                height={node.height}
                rx="10"
                fill={isDark ? '#1e293b' : '#ffffff'}
                stroke={isSelected ? '#f43f5e' : (node.color || '#0284c7')}
                strokeWidth={isSelected ? '3' : '2'}
              />
            <rect width="6" height={node.height} rx="3" fill={node.color || '#0284c7'} />

            {node.iconUrl && node.iconUrl.trim() !== '' ? (
  <image
    href={node.iconUrl}
    x="16"
    y="18"
    width="34"
    height="34"
    preserveAspectRatio="xMidYMid meet"
    onError={(e) => {
      (e.currentTarget as SVGImageElement).style.display = 'none';
    }}
  />
) : (
  <g>
    <circle cx="33" cy="35" r="16" fill={node.color || '#0284c7'} opacity={0.15} />
    <text
      x="33"
      y="40"
      fontSize="13"
      textAnchor="middle"
      fill={node.color || '#0284c7'}
      fontWeight="bold"
    >
      {node.label ? node.label.charAt(0).toUpperCase() : '●'}
    </text>
  </g>
)}

            <text
              x="58"
              y="32"
              fontSize="14"
              fontWeight="700"
              fontFamily="system-ui, sans-serif"
              fill={isDark ? '#f8fafc' : '#0f172a'}
            >
              {node.label}
            </text>
            <text
              x="58"
              y="48"
              fontSize="11"
              fontFamily="system-ui, sans-serif"
              fill={isDark ? '#94a3b8' : '#64748b'}
            >
              {node.subtext}
            </text>

            {node.badge && (
              <>
                <rect x="58" y="58" width={node.width - 70} height="20" rx="4" fill={isDark ? '#0f172a' : '#f1f5f9'} />
                <text
                  x={58 + (node.width - 70) / 2}
                  y="72"
                  fontSize="10"
                  fontWeight="600"
                  fontFamily="system-ui, sans-serif"
                  fill={node.color || '#0284c7'}
                  textAnchor="middle"
                >
                  {node.badge}
                </text>
              </>
            )}

            <circle
              cx={node.width}
              cy={node.height / 2}
              r="6"
              fill={connectingFrom === node.id ? '#ef4444' : '#0284c7'}
              stroke="#ffffff"
              strokeWidth="1.5"
              style={{ cursor: 'pointer' }}
              onClick={(e) => handleConnectPortClick(e, node.id)}
            />
          </g>
       );
        })}
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                  Node Title
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
                  Subtitle / Detail
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
                  Protocol / Badge
                </label>
                <input
                  type="text"
                  value={editingNode.badge || ''}
                  onChange={(e) => setEditingNode({ ...editingNode, badge: e.target.value })}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {editingNode.iconUrl && (
                    <img src={editingNode.iconUrl} alt="icon preview" style={{ width: 28, height: 28 }} />
                  )}
                  <button
                    type="button"
                    onClick={() => setPickerNodeId(editingNode.id)}
                    style={{
                      padding: '6px 12px',
                      background: '#0284c7',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '600'
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
                    notifyChange(nextNodes, connectors);
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
            notifyChange(nextNodes, connectors);
            setPickerNodeId(null);
          }}
        />
      )}
    </div>
  );
};