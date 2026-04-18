import React, { useState } from 'react';
import { api } from '../../lib/api';
import { useAppStore } from '../../stores/appStore';
import toast from 'react-hot-toast';
import type { Project } from '../../lib/types';

interface Props {
  onClose: () => void;
  project: Project;
}

export function ProjectSettingsModal({ onClose, project }: Props) {
  const [name, setName] = useState(project.name);
  const [shortcut, setShortcut] = useState<number | null>(project.shortcut);
  const [icon, setIcon] = useState(project.icon || '');
  const [loading, setLoading] = useState(false);
  const store = useAppStore();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave();
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await api.projects.update(project.id, {
        name,
        shortcut,
        icon: icon || null,
      });
      toast.success('Project settings saved');
      onClose();
    } catch {
      toast.error('Failed to save project settings');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    if (!window.confirm(`Remove project "${project.name}"? This will not delete any files.`)) return;
    try {
      await api.projects.delete(project.id);
      store.removeProject(project.id);
      toast.success('Project removed');
      onClose();
    } catch {
      toast.error('Failed to remove project');
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 13,
    color: 'var(--text-secondary)',
    display: 'block',
    marginBottom: 4,
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderRadius: 12,
          padding: 32,
          width: '100%',
          maxWidth: 520,
          border: '1px solid var(--border)',
        }}
      >
        <h2
          style={{
            fontSize: 18,
            fontWeight: 600,
            marginBottom: 24,
            marginTop: 0,
            color: 'var(--text-primary)',
          }}
        >
          Project Settings
        </h2>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Project name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Keyboard shortcut</label>
          <select
            value={shortcut ?? ''}
            onChange={(e) => setShortcut(e.target.value ? Number(e.target.value) : null)}
            style={{
              ...inputStyle,
              maxWidth: 120,
              cursor: 'pointer',
            }}
          >
            <option value="">None</option>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <option key={n} value={n}>
                Alt+{n}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>Icon (emoji)</label>
          <input
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            placeholder="e.g. \uD83D\uDE80"
            style={{ ...inputStyle, maxWidth: 80 }}
          />
        </div>

        {/* Danger Zone */}
        <div
          style={{
            border: '1px solid var(--status-error)',
            borderRadius: 8,
            padding: 16,
            marginBottom: 24,
          }}
        >
          <h3
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--status-error)',
              margin: '0 0 8px',
            }}
          >
            Danger Zone
          </h3>
          <p
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              margin: '0 0 12px',
            }}
          >
            Remove this project from MultiTable. This will not delete any files on disk.
          </p>
          <button
            onClick={handleRemove}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: '1px solid var(--status-error)',
              backgroundColor: 'transparent',
              color: 'var(--status-error)',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            Remove project
          </button>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              backgroundColor: 'transparent',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: 'none',
              backgroundColor: 'var(--accent-blue)',
              color: 'white',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 500,
              fontSize: 14,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
