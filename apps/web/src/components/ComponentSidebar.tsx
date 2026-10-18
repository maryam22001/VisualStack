import React, { useMemo, useState } from 'react';
import './ComponentSidebar.css';

export interface ArchitectureComponent {
  name: string;
  category: string;
  iconUrl: string;
  color: string;
}

const components: ArchitectureComponent[] = [
  { name: 'AWS', category: 'Cloud', iconUrl: 'https://api.iconify.design/logos/aws.svg', color: '#f59e0b' },
  { name: 'Nginx', category: 'Networking', iconUrl: 'https://api.iconify.design/logos/nginx.svg', color: '#16a34a' },
  { name: 'FastAPI', category: 'Backend', iconUrl: 'https://api.iconify.design/logos/fastapi.svg', color: '#0f766e' },
  { name: 'Kubernetes', category: 'Cloud', iconUrl: 'https://api.iconify.design/logos/kubernetes.svg', color: '#2563eb' },
  { name: 'PostgreSQL', category: 'Database', iconUrl: 'https://api.iconify.design/logos/postgresql.svg', color: '#2563eb' },
  { name: 'Redis', category: 'Database', iconUrl: 'https://api.iconify.design/logos/redis.svg', color: '#dc2626' },
  { name: 'Envoy', category: 'Networking', iconUrl: 'https://api.iconify.design/logos/envoy.svg', color: '#7c3aed' },
  { name: 'Kafka', category: 'Messaging', iconUrl: 'https://api.iconify.design/logos/kafka.svg', color: '#475569' }
];

interface ComponentSidebarProps {
  theme: 'dark' | 'light';
  offsetTop?: number;
  onAddNode: (component: ArchitectureComponent) => void;
  onAddEnclosure?: () => void;
  onExpandedChange?: (expanded: boolean) => void;
}

export const ComponentSidebar: React.FC<ComponentSidebarProps> = ({
  theme,
  offsetTop = 0,
  onAddNode,
  onAddEnclosure,
  onExpandedChange
}) => {
  const [isOpen, setIsOpen] = useState(true);
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
      className={`vs-component-sidebar${isDark ? ' vs-component-sidebar--dark' : ''}${isOpen ? '' : ' vs-component-sidebar--collapsed'}`}
      style={{ top: offsetTop }}
      aria-label="Component library"
      onMouseDown={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      {isOpen ? (
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
            onClick={() => {
              setIsOpen(false);
              onExpandedChange?.(false);
            }}
            aria-label="Collapse component sidebar"
            title="Collapse sidebar"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg>
          </button>
        </>
      ) : (
        <button
          type="button"
          className="vs-component-sidebar__expand"
          onClick={() => {
            setIsOpen(true);
            onExpandedChange?.(true);
          }}
          aria-label="Expand component sidebar"
          title="Open components"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
        </button>
      )}
    </aside>
  );
};
