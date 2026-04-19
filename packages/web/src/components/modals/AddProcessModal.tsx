import React, { useState } from 'react';
import { api } from '../../lib/api';
import toast from 'react-hot-toast';
import { Modal, Input, Button } from '../ui';

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
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Add Process"
      width={620}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!command.trim()}
            loading={loading}
          >
            {loading ? 'Adding...' : 'Add Process'}
          </Button>
        </>
      }
    >
      <div onKeyDown={handleKeyDown}>
        <div style={{ marginBottom: 14 }}>
          <label
            style={{
              fontSize: 13,
              fontWeight: 600,
              display: 'block',
              marginBottom: 6,
              color: 'var(--text-primary)',
            }}
          >
            Name
          </label>
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g., npm:dev"
            autoFocus
          />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label
            style={{
              fontSize: 13,
              fontWeight: 600,
              display: 'block',
              marginBottom: 6,
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
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: 13,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              resize: 'vertical',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 20 }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
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
              fontSize: 13,
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
      </div>
    </Modal>
  );
}
