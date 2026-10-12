/** Workspace Hub: shared design gallery + team management */
// src/components/DesignGalleryModal.tsx
import React, { useState } from 'react';
import type { SavedDesign } from '../utils/designStorage';
import type { DesignStore } from '../hooks/useDesigns';
import { errorMessage, type Role, type UserSession } from '../api/client';

interface DesignGalleryModalProps {
  isOpen: boolean;
  theme: 'dark' | 'light';
  store: DesignStore;
  user: UserSession | null;
  currentDesignId: string | null;
  onClose: () => void;
  onSelectDesign: (design: SavedDesign) => void;
  onRenameDesign: (id: string, newTitle: string) => void;
  onDeleteDesign: (id: string) => void;
  onSignOutEverywhere: () => void;
}

const ROLE_LABEL: Record<Role, string> = { owner: 'Owner', editor: 'Can edit', viewer: 'View only' };

export const DesignGalleryModal: React.FC<DesignGalleryModalProps> = ({
  isOpen,
  theme,
  store,
  user,
  currentDesignId,
  onClose,
  onSelectDesign,
  onRenameDesign,
  onDeleteDesign,
  onSignOutEverywhere
}) => {
  const isDark = theme === 'dark';
  const [tab, setTab] = useState<'designs' | 'team'>('designs');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const c = {
    panel: isDark ? '#1e293b' : '#ffffff',
    ink: isDark ? '#f8fafc' : '#0f172a',
    border: isDark ? '#334155' : '#e2e8f0',
    sub: isDark ? '#0f172a' : '#f8fafc',
    muted: '#94a3b8',
    primary: '#0284c7'
  };

  const run = async (fn: () => Promise<unknown>, okMessage?: string) => {
    setBusy(true);
    setFormError(null);
    setNotice(null);
    try {
      await fn();
      if (okMessage) setNotice(okMessage);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    const email = inviteEmail.trim();
    if (!email) return;
    void run(async () => {
      await store.addMember(email, inviteRole);
      setInviteEmail('');
    }, `${email} was added.`);
  };

  const smallBtn = (color: string): React.CSSProperties => ({
    background: 'transparent',
    border: 'none',
    color,
    fontSize: 12,
    cursor: 'pointer',
    fontWeight: 600
  });

  const isCloud = store.mode === 'cloud';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 840,
          maxWidth: '100%',
          maxHeight: '85vh',
          background: c.panel,
          color: c.ink,
          textAlign: 'left', // the app shell inherits text-align:center from index.css
          borderRadius: 14,
          border: `1px solid ${c.border}`,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: `1px solid ${c.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12
          }}
        >
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: c.primary }}>Workspace Hub</span>
            <div style={{ display: 'flex', gap: 6, background: c.sub, padding: 3, borderRadius: 8 }}>
              {(['designs', 'team'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  style={{
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: tab === t ? c.primary : 'transparent',
                    color: tab === t ? '#ffffff' : isDark ? '#94a3b8' : '#64748b'
                  }}
                >
                  {t === 'designs' ? `Designs (${store.designs.length})` : 'Team & Account'}
                </button>
              ))}
            </div>

            {isCloud && store.workspaces.length > 1 && (
              <select
                aria-label="Workspace"
                value={store.activeWorkspace?.id ?? ''}
                onChange={(e) => store.switchWorkspace(e.target.value)}
                style={{
                  padding: '6px 8px',
                  borderRadius: 6,
                  border: `1px solid ${c.border}`,
                  background: c.sub,
                  color: c.ink,
                  fontSize: 12
                }}
              >
                {store.workspaces.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} · {ROLE_LABEL[w.role]}
                  </option>
                ))}
              </select>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'transparent', border: 'none', fontSize: 18, cursor: 'pointer', color: c.muted }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          {/* ------------------------------ DESIGNS ------------------------------ */}
          {tab === 'designs' && (
            <div>
              {!isCloud && (
                <div style={{ marginBottom: 14, padding: '8px 12px', borderRadius: 8, fontSize: 12, background: isDark ? '#422006' : '#fffbeb', color: isDark ? '#fcd34d' : '#92400e' }}>
                  You&rsquo;re using VisualStack as a guest, so designs are kept in this browser only. Sign in to save them to
                  your workspace and share them with teammates.
                </div>
              )}

              {isCloud && store.role === 'viewer' && (
                <div style={{ marginBottom: 14, padding: '8px 12px', borderRadius: 8, fontSize: 12, background: isDark ? '#0c4a6e' : '#f0f9ff', color: isDark ? '#bae6fd' : '#075985' }}>
                  You have <strong>view-only</strong> access to this workspace. You can open designs but not change them.
                </div>
              )}

              {isCloud && store.importableCount > 0 && store.canEdit && (
                <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 8, fontSize: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, background: isDark ? '#0c4a6e' : '#f0f9ff', color: isDark ? '#bae6fd' : '#075985' }}>
                  <span>
                    <strong>{store.importableCount}</strong> design{store.importableCount === 1 ? '' : 's'} saved in this browser
                    before accounts existed. Move {store.importableCount === 1 ? 'it' : 'them'} into <strong>{store.activeWorkspace?.name}</strong>?
                  </span>
                  <button
                    disabled={busy}
                    onClick={() => void run(() => store.importLocalDesigns(), 'Imported into your workspace.')}
                    style={{ background: c.primary, color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    Import
                  </button>
                </div>
              )}

              {notice && <div style={{ marginBottom: 12, fontSize: 12, color: '#16a34a' }}>{notice}</div>}
              {formError && <div role="alert" style={{ marginBottom: 12, fontSize: 12, color: '#ef4444' }}>{formError}</div>}

              {store.error && (
                <div role="alert" style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 8, fontSize: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: isDark ? '#450a0a' : '#fef2f2', color: isDark ? '#fecaca' : '#b91c1c' }}>
                  <span>{store.error}</span>
                  <button onClick={store.reload} style={smallBtn(isDark ? '#fecaca' : '#b91c1c')}>Retry</button>
                </div>
              )}

              {store.loading ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: c.muted, fontSize: 13 }}>Loading your designs…</div>
              ) : store.designs.length === 0 && !store.error ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: c.muted }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>📂</div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>No saved designs yet</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>
                    {store.canEdit ? (
                      <>Click <strong>&quot;💾 Save&quot;</strong> in the top bar to store your active canvas{isCloud ? ' in this workspace' : ''}.</>
                    ) : (
                      'Ask the workspace owner for edit access to add designs.'
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                  {store.designs.map((d) => {
                    const isCurrent = d.id === currentDesignId;
                    const nodeCount = d.project?.cleanView?.nodes?.length || d.project?.detailed2DView?.nodes?.length || 0;
                    return (
                      <div
                        key={d.id}
                        style={{
                          border: `1.5px solid ${isCurrent ? c.primary : c.border}`,
                          borderRadius: 10,
                          padding: 12,
                          background: c.sub,
                          display: 'flex',
                          flexDirection: 'column'
                        }}
                      >
                        <div
                          onClick={() => onSelectDesign(d)}
                          style={{ height: 100, background: isDark ? '#1e293b' : '#e2e8f0', borderRadius: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                        >
                          <span style={{ fontSize: 30 }}>📐</span>
                          <span style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                            {nodeCount} Nodes • {d.project.activeTab.toUpperCase()}
                          </span>
                        </div>

                        <input
                          aria-label="Design title"
                          value={d.title}
                          readOnly={!store.canEdit}
                          onChange={(e) => onRenameDesign(d.id, e.target.value)}
                          placeholder="Untitled Architecture"
                          style={{ width: '100%', textAlign: 'center', fontWeight: 700, fontSize: 13, marginTop: 8, padding: 4, background: 'transparent', border: '1px solid transparent', borderRadius: 4, color: c.ink, outline: 'none' }}
                          onFocus={(e) => (e.target.style.borderColor = c.primary)}
                          onBlur={(e) => (e.target.style.borderColor = 'transparent')}
                        />

                        <div style={{ fontSize: 11, color: c.muted, textAlign: 'center', marginTop: 4 }}>
                          Updated {new Date(d.updatedAt).toLocaleDateString()}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, paddingTop: 6, borderTop: `1px solid ${c.border}` }}>
                          <button onClick={() => onSelectDesign(d)} style={smallBtn(c.primary)}>Open</button>
                          {store.canEdit && (
                            <button onClick={() => onDeleteDesign(d.id)} style={smallBtn('#ef4444')}>Delete</button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ------------------------------ TEAM & ACCOUNT ------------------------------ */}
          {tab === 'team' && (
            <div style={{ maxWidth: 560, margin: '0 auto' }}>
              {!isCloud || !user ? (
                <div style={{ textAlign: 'center', padding: '48px 20px', color: c.muted }}>
                  <div style={{ fontSize: 34, marginBottom: 8 }}>👥</div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>Sign in to collaborate</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>
                    Workspaces, teammates and roles are available with a free account.
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
                    <div style={{ width: 48, height: 48, borderRadius: '50%', background: c.primary, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 18 }}>
                      {user.fullName.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700 }}>{user.fullName}</div>
                      <div style={{ fontSize: 12, color: c.muted }}>{user.email}</div>
                    </div>
                    <button
                      onClick={onSignOutEverywhere}
                      title="Ends your session on every device, including this one"
                      style={{ border: `1px solid ${c.border}`, background: 'transparent', color: c.ink, borderRadius: 6, padding: '6px 10px', fontSize: 12, cursor: 'pointer' }}
                    >
                      Sign out of all devices
                    </button>
                  </div>

                  <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: c.muted, marginBottom: 8 }}>
                    Members of {store.activeWorkspace?.name ?? 'this workspace'}
                  </div>

                  {formError && <div role="alert" style={{ marginBottom: 10, fontSize: 12, color: '#ef4444' }}>{formError}</div>}
                  {notice && <div style={{ marginBottom: 10, fontSize: 12, color: '#16a34a' }}>{notice}</div>}

                  <div style={{ border: `1px solid ${c.border}`, borderRadius: 10, overflow: 'hidden' }}>
                    {store.members.map((m, i) => {
                      const isMe = m.userId === user.id;
                      return (
                        <div
                          key={m.userId}
                          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: c.sub, borderTop: i ? `1px solid ${c.border}` : 'none' }}
                        >
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: isDark ? '#334155' : '#e2e8f0', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 13 }}>
                            {m.fullName.charAt(0).toUpperCase()}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>
                              {m.fullName} {isMe && <span style={{ color: c.muted, fontWeight: 400 }}>(you)</span>}
                            </div>
                            <div style={{ fontSize: 11, color: c.muted, overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.email}</div>
                          </div>

                          {store.isOwner && m.role !== 'owner' ? (
                            <select
                              aria-label={`Role for ${m.fullName}`}
                              value={m.role}
                              disabled={busy}
                              onChange={(e) => void run(() => store.changeMemberRole(m.userId, e.target.value as 'editor' | 'viewer'))}
                              style={{ padding: '4px 6px', borderRadius: 6, border: `1px solid ${c.border}`, background: c.panel, color: c.ink, fontSize: 12 }}
                            >
                              <option value="editor">Can edit</option>
                              <option value="viewer">View only</option>
                            </select>
                          ) : (
                            <span style={{ fontSize: 12, color: c.muted }}>{ROLE_LABEL[m.role]}</span>
                          )}

                          {m.role !== 'owner' && (store.isOwner || isMe) && (
                            <button
                              disabled={busy}
                              onClick={() => {
                                const msg = isMe ? 'Leave this workspace?' : `Remove ${m.fullName} from this workspace?`;
                                if (confirm(msg)) void run(() => store.removeMember(m.userId));
                              }}
                              style={smallBtn('#ef4444')}
                            >
                              {isMe ? 'Leave' : 'Remove'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {store.isOwner ? (
                    <form onSubmit={handleInvite} style={{ marginTop: 18 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: c.muted, marginBottom: 8 }}>
                        Add a teammate
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          type="email"
                          required
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          placeholder="teammate@company.com"
                          aria-label="Teammate email"
                          style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: `1px solid ${c.border}`, background: c.panel, color: c.ink, fontSize: 13, outline: 'none' }}
                        />
                        <select
                          value={inviteRole}
                          onChange={(e) => setInviteRole(e.target.value as 'editor' | 'viewer')}
                          aria-label="Role"
                          style={{ padding: '8px', borderRadius: 8, border: `1px solid ${c.border}`, background: c.panel, color: c.ink, fontSize: 13 }}
                        >
                          <option value="editor">Can edit</option>
                          <option value="viewer">View only</option>
                        </select>
                        <button
                          type="submit"
                          disabled={busy}
                          style={{ background: c.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                        >
                          Add
                        </button>
                      </div>
                      <div style={{ fontSize: 11, color: c.muted, marginTop: 6 }}>
                        They need a verified VisualStack account first. Once added, the workspace appears in their workspace picker.
                      </div>
                    </form>
                  ) : (
                    <div style={{ fontSize: 12, color: c.muted, marginTop: 14 }}>Only the workspace owner can add or remove people.</div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
