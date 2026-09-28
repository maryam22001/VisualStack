/**Profile & Design Gallery Modal */
// src/components/DesignGalleryModal.tsx
import React, { useState } from 'react';
import type { SavedDesign, UserProfile, Collaborator } from '../utils/designStorage';

interface DesignGalleryModalProps {
  isOpen: boolean;
  theme: 'dark' | 'light';
  profile: UserProfile;
  designs: SavedDesign[];
  currentDesignId: string | null;
  onClose: () => void;
  onSelectDesign: (design: SavedDesign) => void;
  onRenameDesign: (id: string, newTitle: string) => void;
  onDeleteDesign: (id: string) => void;
  onAddCollaborator: (designId: string, collab: Omit<Collaborator, 'id'>) => void;
  onRemoveCollaborator: (designId: string, collabId: string) => void;
  onSaveProfile: (profile: UserProfile) => void;
}

export const DesignGalleryModal: React.FC<DesignGalleryModalProps> = ({
  isOpen,
  theme,
  profile,
  designs,
  currentDesignId,
  onClose,
  onSelectDesign,
  onRenameDesign,
  onDeleteDesign,
  onAddCollaborator,
  onRemoveCollaborator,
  onSaveProfile
}) => {
  const isDark = theme === 'dark';
  const [activeTab, setActiveTab] = useState<'gallery' | 'profile'>('gallery');
  const [collabDesignId, setCollabDesignId] = useState<string | null>(null);

  // New collaborator form inputs
  const [collabEmail, setCollabEmail] = useState('');
  const [collabRole, setCollabRole] = useState<'editor' | 'viewer'>('editor');

  // Profile form state
  const [profileName, setProfileName] = useState(profile.name);
  const [profileEmail, setProfileEmail] = useState(profile.email);

  if (!isOpen) return null;

  const targetCollabDesign = designs.find((d) => d.id === collabDesignId);

  const handleCollabSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!collabEmail.trim() || !collabDesignId) return;

    onAddCollaborator(collabDesignId, {
      name: collabEmail.split('@')[0],
      email: collabEmail.trim(),
      role: collabRole
    });
    setCollabEmail('');
  };

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
          width: '840px',
          maxHeight: '85vh',
          background: isDark ? '#1e293b' : '#ffffff',
          color: isDark ? '#f8fafc' : '#0f172a',
          borderRadius: 14,
          border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: '#0284c7' }}>Workspace Hub</span>
            <div style={{ display: 'flex', gap: 6, background: isDark ? '#0f172a' : '#f1f5f9', padding: 3, borderRadius: 8 }}>
              <button
                onClick={() => setActiveTab('gallery')}
                style={{
                  padding: '4px 12px',
                  borderRadius: 6,
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: activeTab === 'gallery' ? '#0284c7' : 'transparent',
                  color: activeTab === 'gallery' ? '#ffffff' : isDark ? '#94a3b8' : '#64748b'
                }}
              >
                Saved Architectures ({designs.length})
              </button>
              <button
                onClick={() => setActiveTab('profile')}
                style={{
                  padding: '4px 12px',
                  borderRadius: 6,
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: activeTab === 'profile' ? '#0284c7' : 'transparent',
                  color: activeTab === 'profile' ? '#ffffff' : isDark ? '#94a3b8' : '#64748b'
                }}
              >
                Profile & Team
              </button>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: 18,
              cursor: 'pointer',
              color: isDark ? '#94a3b8' : '#64748b'
            }}
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          {activeTab === 'gallery' ? (
            <div>
              {designs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>📂</div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>No saved designs found</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>
                    Click <strong>"💾 Save Design"</strong> in the top navigation bar to archive your active canvas.
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                  {designs.map((d) => {
                    const isCurrent = d.id === currentDesignId;
                    const nodeCount = d.project?.cleanView?.nodes?.length || d.project?.detailed2DView?.nodes?.length || 0;

                    return (
                      <div
                        key={d.id}
                        style={{
                          border: `1.5px solid ${isCurrent ? '#0284c7' : isDark ? '#334155' : '#e2e8f0'}`,
                          borderRadius: 10,
                          padding: 12,
                          background: isDark ? '#0f172a' : '#f8fafc',
                          display: 'flex',
                          flexDirection: 'column',
                          position: 'relative'
                        }}
                      >
                        {/* Thumbnail / Click to Load */}
                        <div
                          onClick={() => onSelectDesign(d)}
                          style={{
                            height: 100,
                            background: isDark ? '#1e293b' : '#e2e8f0',
                            borderRadius: 6,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'opacity 0.15s'
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
                          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                        >
                          <span style={{ fontSize: 30 }}>📐</span>
                          <span style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                            {nodeCount} Nodes • {d.project.activeTab.toUpperCase()}
                          </span>
                        </div>

                        {/* Title input underneath card (renames live) */}
                        <input
                          value={d.title}
                          onChange={(e) => onRenameDesign(d.id, e.target.value)}
                          placeholder="Untitled Architecture"
                          style={{
                            width: '100%',
                            textAlign: 'center',
                            fontWeight: 700,
                            fontSize: 13,
                            marginTop: 8,
                            padding: '4px',
                            background: 'transparent',
                            border: '1px solid transparent',
                            borderRadius: 4,
                            color: isDark ? '#f8fafc' : '#0f172a',
                            outline: 'none'
                          }}
                          onFocus={(e) => (e.target.style.borderColor = '#0284c7')}
                          onBlur={(e) => (e.target.style.borderColor = 'transparent')}
                        />

                        {/* Metadata & Collaborators snippet */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                          <span style={{ fontSize: 11, color: '#94a3b8' }}>
                            {new Date(d.updatedAt).toLocaleDateString()}
                          </span>

                          <button
                            onClick={() => setCollabDesignId(d.id)}
                            style={{
                              background: 'transparent',
                              border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
                              borderRadius: 4,
                              fontSize: 11,
                              padding: '2px 6px',
                              cursor: 'pointer',
                              color: isDark ? '#38bdf8' : '#0284c7',
                              fontWeight: 600
                            }}
                          >
                            👥 {d.collaborators?.length || 0}
                          </button>
                        </div>

                        {/* Card Actions */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, paddingTop: 6, borderTop: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}` }}>
                          <button
                            onClick={() => onSelectDesign(d)}
                            style={{
                              border: 'none',
                              background: 'none',
                              color: '#0284c7',
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            Open
                          </button>
                          <button
                            onClick={() => onDeleteDesign(d.id)}
                            style={{
                              border: 'none',
                              background: 'none',
                              color: '#ef4444',
                              fontSize: 12,
                              cursor: 'pointer'
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* User Profile & Role Settings */
            <div style={{ maxWidth: 440, margin: '0 auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                <img
                  src={profile.avatarUrl}
                  alt="avatar"
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    background: '#0284c7',
                    padding: 8
                  }}
                />
                <div>
                  <h4 style={{ margin: 0, fontSize: 16 }}>{profile.name}</h4>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>Workspace Owner</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 4 }}>Full Name</label>
                  <input
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: 8,
                      borderRadius: 6,
                      border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
                      background: isDark ? '#0f172a' : '#f8fafc',
                      color: isDark ? '#f8fafc' : '#0f172a'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 4 }}>Work Email</label>
                  <input
                    type="email"
                    value={profileEmail}
                    onChange={(e) => setProfileEmail(e.target.value)}
                    style={{
                      width: '100%',
                      padding: 8,
                      borderRadius: 6,
                      border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
                      background: isDark ? '#0f172a' : '#f8fafc',
                      color: isDark ? '#f8fafc' : '#0f172a'
                    }}
                  />
                </div>

                <button
                  onClick={() => {
                    onSaveProfile({ ...profile, name: profileName, email: profileEmail });
                    alert('Profile updated successfully!');
                  }}
                  style={{
                    marginTop: 8,
                    padding: '8px 14px',
                    borderRadius: 6,
                    border: 'none',
                    background: '#0284c7',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Save Profile
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Collaborator Drawer / Modal Overlay */}
      {collabDesignId && targetCollabDesign && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onClick={() => setCollabDesignId(null)}
        >
          <div
            style={{
              width: 440,
              background: isDark ? '#1e293b' : '#ffffff',
              color: isDark ? '#f8fafc' : '#0f172a',
              borderRadius: 12,
              padding: 20,
              border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 12px 0', fontSize: 16 }}>
              Collaborators: {targetCollabDesign.title}
            </h3>

            {/* Existing Collaborator List */}
            <div style={{ maxHeight: 160, overflowY: 'auto', marginBottom: 16 }}>
              {(!targetCollabDesign.collaborators || targetCollabDesign.collaborators.length === 0) ? (
                <div style={{ fontSize: 12, color: '#94a3b8' }}>No collaborators invited yet.</div>
              ) : (
                targetCollabDesign.collaborators.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 0',
                      borderBottom: `1px solid ${isDark ? '#334155' : '#f1f5f9'}`
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{c.email} • {c.role}</div>
                    </div>
                    <button
                      onClick={() => onRemoveCollaborator(targetCollabDesign.id, c.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#ef4444',
                        fontSize: 12,
                        cursor: 'pointer'
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Invite Form */}
            <form onSubmit={handleCollabSubmit} style={{ display: 'flex', gap: 8 }}>
              <input
                type="email"
                required
                placeholder="colleague@company.com"
                value={collabEmail}
                onChange={(e) => setCollabEmail(e.target.value)}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
                  background: isDark ? '#0f172a' : '#f8fafc',
                  color: isDark ? '#f8fafc' : '#0f172a',
                  fontSize: 12
                }}
              />
              <select
                value={collabRole}
                onChange={(e) => setCollabRole(e.target.value as 'editor' | 'viewer')}
                style={{
                  padding: '6px 8px',
                  borderRadius: 6,
                  border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
                  background: isDark ? '#0f172a' : '#f8fafc',
                  color: isDark ? '#f8fafc' : '#0f172a',
                  fontSize: 12
                }}
              >
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
              <button
                type="submit"
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#0284c7',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: 'pointer'
                }}
              >
                + Add
              </button>
            </form>

            <div style={{ textAlign: 'right', marginTop: 16 }}>
              <button
                onClick={() => setCollabDesignId(null)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
                  background: 'transparent',
                  color: isDark ? '#cbd5e1' : '#475569',
                  cursor: 'pointer',
                  fontSize: 12
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};