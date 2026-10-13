import React, { useEffect, useState } from 'react';
import type { VisualStackConnector } from '../types/project';
import { ColorPicker } from './NodeEditModal';

interface ConnectorEditModalProps {
  connector: VisualStackConnector;
  fromLabel?: string;
  toLabel?: string;
  theme?: string;
  onApply: (connector: VisualStackConnector) => void;
  onCancel: () => void;
  onDelete: (id: string) => void;
}

export const ConnectorEditModal: React.FC<ConnectorEditModalProps> = ({
  connector,
  fromLabel,
  toLabel,
  theme = 'light',
  onApply,
  onCancel,
  onDelete
}) => {
  const isDark = theme === 'dark';
  const [draft, setDraft] = useState<VisualStackConnector>(connector);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const apply = () => onApply({ ...draft, label: draft.label?.trim() || undefined });

  const inputStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '10px 14px',
    borderRadius: '8px',
    border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
    background: isDark ? '#0f172a' : '#f8fafc',
    color: isDark ? '#f8fafc' : '#0f172a',
    fontSize: '14px'
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    textAlign: 'center',
    fontSize: '13px',
    color: '#64748b',
    marginBottom: '8px'
  };

  const buttonBase: React.CSSProperties = {
    padding: '10px 18px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer'
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: '16px'
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="connector-edit-title"
        style={{
          background: isDark ? '#1e293b' : '#ffffff',
          color: isDark ? '#f8fafc' : '#0f172a',
          padding: '28px',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '440px',
          maxHeight: '90%',
          overflowY: 'auto',
          border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
          borderTop: `4px solid ${draft.color}`,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          id="connector-edit-title"
          style={{ margin: '0 0 6px 0', fontSize: '20px', fontWeight: 700, textAlign: 'center' }}
        >
          Edit Wire
        </h3>
        {(fromLabel || toLabel) && (
          <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#64748b', textAlign: 'center' }}>
            {fromLabel ?? connector.from} {'→'} {toLabel ?? connector.to}
          </p>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            apply();
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}
        >
          <div>
            <label htmlFor="connector-label" style={labelStyle}>Wire Name</label>
            <input
              id="connector-label"
              type="text"
              value={draft.label ?? ''}
              placeholder="e.g. Telemetry, REST / TLS"
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              style={inputStyle}
              autoFocus
            />
          </div>

          <div>
            <span style={labelStyle}>Wire Color</span>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <ColorPicker
                value={draft.color}
                isDark={isDark}
                onChange={(color) => setDraft({ ...draft, color })}
              />
            </div>
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            <input
              type="checkbox"
              checked={!!draft.dashed}
              onChange={(e) => setDraft({ ...draft, dashed: e.target.checked })}
            />
            Dashed line
          </label>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
            <button
              type="button"
              onClick={() => onDelete(connector.id)}
              style={{ ...buttonBase, background: 'transparent', color: '#dc2626', border: '1px solid #fecaca' }}
            >
              Delete
            </button>
            <div style={{ flex: 1 }} />
            <button
              type="button"
              onClick={onCancel}
              style={{
                ...buttonBase,
                background: 'transparent',
                color: isDark ? '#e2e8f0' : '#334155',
                border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{ ...buttonBase, background: '#10b981', color: '#ffffff', border: 'none' }}
            >
              Apply Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
