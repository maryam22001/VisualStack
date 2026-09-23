import { useState, useEffect } from 'react';
import { findIcon, type IconResult } from './IconLibrary';

interface IconPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (icon: IconResult) => void;
  theme?: 'dark' | 'light';
}

export function IconPicker({ isOpen, onClose, onSelect, theme = 'light' }: IconPickerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<IconResult[]>([]);
  const [loading, setLoading] = useState(false);

  const isDark = theme === 'dark';

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    const timer = setTimeout(() => {
      findIcon(query)
        .then((res) => setResults(res))
        .catch((err) => console.error('Failed to load icons:', err))
        .finally(() => setLoading(false));
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '520px',
          maxHeight: '82vh',
          backgroundColor: isDark ? '#1e293b' : '#ffffff',
          color: isDark ? '#f8fafc' : '#0f172a',
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.35)',
          border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
          display: 'flex',
          flexDirection: 'column',
          padding: '20px',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '700' }}>Select Tool Icon</h3>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: isDark ? '#94a3b8' : '#64748b' }}>
              Search across bundled packs (AWS, GCP, Azure, K8s) and 200,000+ Iconify tools
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: isDark ? '#94a3b8' : '#64748b',
              fontSize: '18px',
              cursor: 'pointer',
              padding: '4px 8px'
            }}
          >
            ✕
          </button>
        </div>

        <input
          autoFocus
          placeholder="e.g. redis, postgres, nginx, docker, kafka, esp32, aws..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: '8px',
            border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
            background: isDark ? '#0f172a' : '#f8fafc',
            color: isDark ? '#f8fafc' : '#0f172a',
            fontSize: '14px',
            outline: 'none',
            boxSizing: 'border-box'
          }}
        />

        {loading && (
          <div style={{ fontSize: '12px', color: '#0284c7', fontWeight: '500' }}>
            Searching icons...
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: '10px',
            overflowY: 'auto',
            maxHeight: '360px',
            padding: '4px'
          }}
        >
          {results.map((icon) => (
            <button
              key={icon.id}
              title={icon.name}
              onClick={() => {
                onSelect(icon);
                onClose();
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '10px 6px',
                borderRadius: '8px',
                border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                background: isDark ? '#0f172a' : '#f8fafc',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                gap: '6px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#0284c7';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = isDark ? '#334155' : '#e2e8f0';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <img
                src={icon.url}
                alt={icon.name}
                width={32}
                height={32}
                style={{ objectFit: 'contain' }}
              />
              <span
                style={{
                  fontSize: '10px',
                  color: isDark ? '#94a3b8' : '#64748b',
                  maxWidth: '75px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {icon.name}
              </span>
            </button>
          ))}

          {!loading && query.trim().length >= 2 && results.length === 0 && (
            <div
              style={{
                gridColumn: 'span 5',
                textAlign: 'center',
                color: '#64748b',
                padding: '30px 10px',
                fontSize: '13px'
              }}
            >
              No icons found matching "{query}".
            </div>
          )}

          {query.trim().length < 2 && (
            <div
              style={{
                gridColumn: 'span 5',
                textAlign: 'center',
                color: isDark ? '#64748b' : '#94a3b8',
                padding: '30px 10px',
                fontSize: '13px'
              }}
            >
              Type at least 2 characters to search...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}