import React, { useMemo, useState } from 'react';
import './ComponentSidebar.css';

export interface ArchitectureComponent {
  name: string;
  category: string;
  iconUrl: string;
  color: string;
  technicalDetails?: string[];
}

const components: ArchitectureComponent[] = [
  { name: 'AWS', category: 'Cloud', iconUrl: 'https://api.iconify.design/logos/aws.svg', color: '#f59e0b' },
  { name: 'Nginx', category: 'Networking', iconUrl: 'https://api.iconify.design/logos/nginx.svg', color: '#16a34a', technicalDetails: ['Protocol: HTTP / HTTPS', 'Ports: 80 / 443', 'Role: Reverse proxy'] },
  { name: 'FastAPI', category: 'Backend', iconUrl: 'https://api.iconify.design/logos/fastapi.svg', color: '#0f766e', technicalDetails: ['Runtime: ASGI / Python', 'API: REST / OpenAPI', 'Protocol: HTTP'] },
  { name: 'Kubernetes', category: 'Cloud', iconUrl: 'https://api.iconify.design/logos/kubernetes.svg', color: '#2563eb', technicalDetails: ['Orchestration: Containers', 'Scaling: Deployments', 'Networking: Services'] },
  { name: 'PostgreSQL', category: 'Database', iconUrl: 'https://api.iconify.design/logos/postgresql.svg', color: '#2563eb', technicalDetails: ['Protocol: PostgreSQL wire', 'Port: 5432', 'Model: Relational'] },
  { name: 'Redis', category: 'Database', iconUrl: 'https://api.iconify.design/logos/redis.svg', color: '#dc2626', technicalDetails: ['Protocol: RESP', 'Port: 6379', 'Model: In-memory key/value'] },
  { name: 'Envoy', category: 'Networking', iconUrl: 'https://api.iconify.design/logos/envoy.svg', color: '#7c3aed', technicalDetails: ['Role: L7 proxy', 'Protocols: HTTP / gRPC', 'Features: Load balancing'] },
  { name: 'Kafka', category: 'Messaging', iconUrl: 'https://api.iconify.design/logos/kafka.svg', color: '#475569', technicalDetails: ['Protocol: Kafka wire', 'Port: 9092', 'Model: Distributed event log'] }
];

interface ComponentSidebarProps {
  theme: 'dark' | 'light';
  offsetTop?: number;
  onAddNode: (component: ArchitectureComponent) => void;
  onAddEnclosure?: () => void;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  width?: number;
  onWidthChange?: (width: number) => void;
}

export const ComponentSidebar: React.FC<ComponentSidebarProps> = ({
  theme,
  offsetTop = 0,
  onAddNode,
  onAddEnclosure,
  expanded,
  onExpandedChange,
  width = 210,
  onWidthChange
}) => {
  const [query, setQuery] = useState('');
  const isDark = theme === 'dark';
  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return search
      ? components.filter((item) => `${item.name} ${item.category}`.toLowerCase().includes(search))
      : components;
  }, [query]);

  return (
    <aside
      className={`vs-component-sidebar${isDark ? ' vs-component-sidebar--dark' : ''}${expanded ? '' : ' vs-component-sidebar--collapsed'}`}
      style={{ top: offsetTop, width: expanded ? Math.min(width, window.innerWidth * 0.7) : undefined }}
      aria-label="Component library"
      onMouseDown={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      {expanded ? (
        <>
          <label className="vs-component-sidebar__search">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></svg>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search components..." aria-label="Search components" />
          </label>
          {onAddEnclosure && (
            <section className="vs-component-sidebar__section">
              <h2>Layout &amp; Zones</h2>
              <button className="vs-component-sidebar__add" onClick={onAddEnclosure}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                Add enclosure
              </button>
            </section>
          )}
          <section className="vs-component-sidebar__section">
            <h2>{query ? 'Search results' : 'Components'}</h2>
            {filtered.length ? (
              <div className="vs-component-sidebar__grid">
                {filtered.map((item) => (
                  <button key={item.name} className="vs-component-sidebar__tile" onClick={() => onAddNode(item)} title={`Add ${item.name}`}>
                    <img src={item.iconUrl} alt="" />
                    <span>{item.name}</span>
                  </button>
                ))}
              </div>
            ) : <p className="vs-component-sidebar__empty">No matching components.</p>}
          </section>
          <button
            type="button"
            className="vs-component-sidebar__collapse"
            onClick={() => onExpandedChange(false)}
            aria-label="Collapse component sidebar"
            title="Collapse sidebar"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg>
          </button>
          {onWidthChange && (
            <div
              className="vs-component-sidebar__resize"
              role="separator"
              aria-label="Resize component sidebar"
              aria-orientation="vertical"
              aria-valuenow={width}
              aria-valuemin={180}
              aria-valuemax={420}
              tabIndex={0}
              title="Drag to resize component sidebar"
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                event.currentTarget.setPointerCapture(event.pointerId);
                event.currentTarget.dataset.startX = String(event.clientX);
                event.currentTarget.dataset.startWidth = String(Math.min(width, window.innerWidth * 0.7));
              }}
              onPointerMove={(event) => {
                const startX = Number(event.currentTarget.dataset.startX);
                const startWidth = Number(event.currentTarget.dataset.startWidth);
                if (!event.currentTarget.hasPointerCapture(event.pointerId) || !Number.isFinite(startX)) return;
                const maxWidth = Math.min(420, window.innerWidth * 0.7);
                onWidthChange(Math.min(maxWidth, Math.max(180, startWidth + event.clientX - startX)));
              }}
              onPointerUp={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                  event.currentTarget.releasePointerCapture(event.pointerId);
                }
                delete event.currentTarget.dataset.startX;
                delete event.currentTarget.dataset.startWidth;
              }}
              onPointerCancel={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                  event.currentTarget.releasePointerCapture(event.pointerId);
                }
                delete event.currentTarget.dataset.startX;
                delete event.currentTarget.dataset.startWidth;
              }}
              onKeyDown={(event) => {
                if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
                event.preventDefault();
                const direction = event.key === 'ArrowRight' ? 1 : -1;
                const maxWidth = Math.min(420, window.innerWidth * 0.7);
                onWidthChange(Math.min(maxWidth, Math.max(160, width + direction * 16)));
              }}
            >
              <span />
            </div>
          )}
        </>
      ) : (
        <button
          type="button"
          className="vs-component-sidebar__expand"
          onClick={() => onExpandedChange(true)}
          aria-label="Expand component sidebar"
          title="Open components"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
        </button>
      )}
    </aside>
  );
};
