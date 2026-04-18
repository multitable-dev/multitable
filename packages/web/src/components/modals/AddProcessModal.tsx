import React, { useState } from 'react';
import { api } from '../../lib/api';
import toast from 'react-hot-toast';

interface Props {
  onClose: () => void;
  projectId: string;
}

export function AddProcessModal({ onClose, projectId }: Props) {
  const [command, setCommand] = useState('');
  const [name, setName] = useState('');
  const [autostart, setAutostart] = useState(true);
  const [autorestart, setAutorestart] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!command.trim()) return;
    setLoading(true);
    try {
      await api.commands.create(projectId, { name: name || command, command });
      toast.success('Process added');
      onClose();
    } catch {
      toast.error('Failed to add process');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit();
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
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderRadius: 12,
          padding: 32,
          width: '100%',
          maxWidth: 600,
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
          Add Process
        </h2>
        <div style={{ marginBottom: 16 }}>
          <label
            style={{
              fontSize: 14,
              fontWeight: 600,
              display: 'block',
              marginBottom: 4,
              color: 'var(--text-primary)',
            }}
          >
            Name
          </label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g., npm:dev"
            autoFocus
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: 14,
              outline: 'none',
            }}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label
            style={{
              fontSize: 14,
              fontWeight: 600,
              display: 'block',
              marginBottom: 4,
              color: 'var(--text-primary)',
            }}
          >
            Command
          </label>
          <textarea
            value={command}
            onChange={e => setCommand(e.target.value)}
            placeholder="e.g., npm run dev"
            rows={2}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: 13,
              fontFamily: 'monospace',
              resize: 'vertical',
              outline: 'none',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 24, marginBottom: 24 }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 14,
              cursor: 'pointer',
              color: 'var(--text-primary)',
            }}
          >
            <input
              type="checkbox"
              checked={autostart}
              onChange={e => setAutostart(e.target.checked)}
            />
            Auto-start
          </label>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 14,
              cursor: 'pointer',
              color: 'var(--text-primary)',
            }}
          >
            <input
              type="checkbox"
              checked={autorestart}
              onChange={e => setAutorestart(e.target.checked)}
            />
            Auto-restart
          </label>
        </div>
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
            onClick={handleSubmit}
            disabled={loading || !command.trim()}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: 'none',
              backgroundColor: 'var(--accent-blue)',
              color: 'white',
              cursor: loading || !command.trim() ? 'not-allowed' : 'pointer',
              fontWeight: 500,
              fontSize: 14,
              opacity: loading || !command.trim() ? 0.7 : 1,
            }}
          >
            {loading ? 'Adding...' : 'Add Process'}
          </button>
        </div>
      </div>
    </div>
  );
}
