import React, { useState } from 'react';
import { api } from '../../lib/api';
import { useAppStore } from '../../stores/appStore';
import toast from 'react-hot-toast';

interface Props {
  onClose: () => void;
}

export function AddProjectModal({ onClose }: Props) {
  const [dirPath, setDirPath] = useState('');
  const [loading, setLoading] = useState(false);
  const store = useAppStore();

  const handleAdd = async () => {
    if (!dirPath.trim()) return;
    setLoading(true);
    try {
      const project = await api.projects.create({ path: dirPath.trim() });
      store.addProject(project);
      store.setActiveProject(project.id);
      toast.success(`Project "${project.name}" added`);
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to add project');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAdd();
    if (e.key === 'Escape') onClose();
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
            margin: '0 0 8px',
            fontSize: 18,
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}
        >
          Add Project
        </h2>
        <p
          style={{
            margin: '0 0 20px',
            fontSize: 13,
            color: 'var(--text-secondary)',
          }}
        >
          Enter the absolute path to your project directory.
        </p>
        <input
          autoFocus
          value={dirPath}
          onChange={(e) => setDirPath(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="/home/user/my-project"
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: 6,
            fontSize: 13,
            border: '1px solid var(--border)',
            backgroundColor: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            outline: 'none',
            fontFamily: 'monospace',
            boxSizing: 'border-box',
          }}
        />
        <div
          style={{
            display: 'flex',
            gap: 8,
            justifyContent: 'flex-end',
            marginTop: 20,
          }}
        >
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
            onClick={handleAdd}
            disabled={loading || !dirPath.trim()}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: 'none',
              backgroundColor: 'var(--accent-blue)',
              color: 'white',
              cursor: loading || !dirPath.trim() ? 'not-allowed' : 'pointer',
              fontSize: 14,
              fontWeight: 500,
              opacity: loading || !dirPath.trim() ? 0.6 : 1,
            }}
          >
            {loading ? 'Adding...' : 'Add Project'}
          </button>
        </div>
      </div>
    </div>
  );
}
