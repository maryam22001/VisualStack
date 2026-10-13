import React, { useEffect, useState } from 'react';
import type { VisualStackNode } from '../types/project';

export const NODE_COLOR_PRESETS = [
  '#0284c7',
  '#16a34a',
  '#d97706',
  '#dc2626',
  '#9333ea',
  '#db2777',
  '#0d9488',
  '#475569'
];

interface ColorPickerProps {
  value?: string;
  onChange: (color: string) => void;
  isDark: boolean;
}

export const ColorPicker: React.FC<ColorPickerProps> = ({ value, onChange, isDark }) => {
  const current = (value || NODE_COLOR_PRESETS[0]).toLowerCase();
  return (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
      {NODE_COLOR_PRESETS.map((c) => {
        const active = current === c;
        return (
          <button
            key={c}
            type="button"
            aria-label={`Use color ${c}`}
            aria-pressed={active}
            onClick={() => onChange(c)}
            style={{
              width: 26,
              height: 26,
              borderRadius: '50%',
              background: c,
              border: active ? `3px solid ${isDark ? '#f8fafc' : '#0f172a'}` : '2px solid transparent',
              boxShadow: active ? `0 0 0 2px ${c}` : 'none',
              cursor: 'pointer',
              padding: 0
            }}
          />
        );
      })}
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '12px',
          color: isDark ? '#94a3b8' : '#64748b',
          cursor: 'pointer'
        }}
      >
        <input
          type="color"
          value={current.startsWith('#') && current.length === 7 ? current : '#0284c7'}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Custom color"
          style={{ width: 30, height: 26, border: 'none', padding: 0, background: 'transparent', cursor: 'pointer' }}
        />
        Custom
      </label>
    </div>
  );
};

interface NodeEditModalProps {
  node: VisualStackNode;
  theme?: string;
  onApply: (node: VisualStackNode) => void;
  onCancel: () => void;
  onDelete: (id: string) => void;
  onPickIcon?: (node: VisualStackNode) => void;
}

export const NodeEditModal: React.FC<NodeEditModalProps> = ({
  node,
  theme = 'light',
  onApply,
  onCancel,
  onDelete,
  onPickIcon
}) => {
  const isDark = theme === 'dark';
  const [draft, setDraft] = useState<VisualStackNode>(node);
  const [newSpec, setNewSpec] = useState('');

  useEffect(() => {
    setDraft((d) => (d.id === node.id ? { ...d, iconUrl: node.iconUrl } : node));
  }, [node]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const specs = draft.specs ?? [];

  const addSpec = () => {
    const value = newSpec.trim();
    if (!value) return;
    setDraft({ ...draft, specs: [...specs, value] });
    setNewSpec('');
  };

  const removeSpec = (index: number) => {
    setDraft({ ...draft, specs: specs.filter((_, i) => i !== index) });
  };

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

  const accent = draft.color || '#0284c7';

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
        aria-labelledby="node-edit-title"
        style={{
          background: isDark ? '#1e293b' : '#ffffff',
          color: isDark ? '#f8fafc' : '#0f172a',
          padding: '28px',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '520px',
          maxHeight: '90%',
          overflowY: 'auto',
          border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
          borderTop: `4px solid ${accent}`,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          id="node-edit-title"
          style={{ margin: '0 0 20px 0', fontSize: '20px', fontWeight: 700, textAlign: 'center' }}
        >
          Edit Node: {node.id}
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div>
            <label htmlFor="node-title" style={labelStyle}>Node Title</label>
            <input
              id="node-title"
              type="text"
              value={draft.label}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              style={inputStyle}
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="node-subtext" style={labelStyle}>Description / Primary Subtext</label>
            <input
              id="node-subtext"
              type="text"
              value={draft.subtext || ''}
              onChange={(e) => setDraft({ ...draft, subtext: e.target.value })}
              style={inputStyle}
            />
          </div>

          <div>
            <label htmlFor="node-badge" style={labelStyle}>Layer / Category</label>
            <input
              id="node-badge"
              type="text"
              value={draft.badge || ''}
              onChange={(e) => setDraft({ ...draft, badge: e.target.value })}
              style={inputStyle}
            />
          </div>

          <div>
            <span style={labelStyle}>Node Color</span>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <ColorPicker value={draft.color} onChange={(color) => setDraft({ ...draft, color })} isDark={isDark} />
            </div>
          </div>

          <div>
            <span style={labelStyle}>Custom Text Lines / Specs</span>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {specs.map((spec, i) => (
                <li
                  key={`${spec}-${i}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: isDark ? '#0f172a' : '#f1f5f9',
                    color: accent,
                    fontSize: '13px'
                  }}
                >
                  <span>{'• '}{spec}</span>
                  <button
                    type="button"
                    onClick={() => removeSpec(i)}
                    aria-label={`Remove ${spec}`}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: '#ef4444',
                      fontSize: '18px',
                      lineHeight: 1,
                      cursor: 'pointer',
                      padding: '0 4px'
                    }}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            <div style={{ display: 'flex', gap: '8px', marginTop: specs.length ? '10px' : 0 }}>
              <input
                type="text"
                value={newSpec}
                placeholder="e.g. Baudrate: 115200"
                aria-label="New spec line"
                onChange={(e) => setNewSpec(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                    e.preventDefault();
                    addSpec();
                  }
                }}
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                type="button"
                onClick={addSpec}
                style={{
                  padding: '0 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#0284c7',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                + Add
              </button>
            </div>
          </div>

          {onPickIcon && (
            <div>
              <span style={labelStyle}>Component Icon</span>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                {draft.iconUrl && (
                  <img src={draft.iconUrl} alt="" style={{ width: 32, height: 32, objectFit: 'contain' }} />
                )}
                <button
                  type="button"
                  onClick={() => onPickIcon(draft)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
                    background: 'transparent',
                    color: isDark ? '#e2e8f0' : '#0f172a',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Change Icon
                </button>
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px',
            marginTop: '26px'
          }}
        >
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Delete node "${draft.label}" and its connections?`)) onDelete(node.id);
            }}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              border: '1px solid #fecaca',
              background: isDark ? 'rgba(239,68,68,0.12)' : '#fef2f2',
              color: '#dc2626',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            Delete Node
          </button>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
                background: 'transparent',
                color: isDark ? '#cbd5e1' : '#334155',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                const pending = newSpec.trim();
                onApply(pending ? { ...draft, specs: [...specs, pending] } : draft);
              }}
              style={{
                padding: '10px 22px',
                borderRadius: '8px',
                border: 'none',
                background: '#10b981',
                color: '#fff',
                fontWeight: 700,
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Apply Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
