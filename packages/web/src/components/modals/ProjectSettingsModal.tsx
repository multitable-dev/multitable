import React, { useState } from 'react';
import { api } from '../../lib/api';
import { useAppStore } from '../../stores/appStore';
import toast from 'react-hot-toast';
import type { Project } from '../../lib/types';
import { Modal, Input, Button } from '../ui';

interface Props {
  onClose: () => void;
  project: Project;
}

export function ProjectSettingsModal({ onClose, project }: Props) {
  const [name, setName] = useState(project.name);
  const [icon, setIcon] = useState(project.icon || '');
  const [loading, setLoading] = useState(false);
  const store = useAppStore();

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Project name cannot be empty');
      return;
    }
    setLoading(true);
    try {
      const updated = await api.projects.update(project.id, {
        name: trimmed,
        icon: icon || null,
      });
      store.updateProject(updated);
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

  const labelStyle: React.CSSProperties = {
    fontSize: 13,
    color: 'var(--text-secondary)',
    display: 'block',
    marginBottom: 6,
    fontWeight: 500,
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Project Settings"
      width={540}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} loading={loading}>
            {loading ? 'Saving...' : 'Save'}
          </Button>
        </>
      }
    >
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Project name</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>Icon (emoji)</label>
        <Input
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          placeholder="e.g. \uD83D\uDE80"
          wrapperStyle={{ maxWidth: 100 }}
        />
      </div>

      {/* Danger Zone */}
      <div
        style={{
          border: '1px solid color-mix(in srgb, var(--status-error) 50%, var(--border))',
          borderRadius: 'var(--radius-lg)',
          padding: 16,
          backgroundColor: 'color-mix(in srgb, var(--status-error) 5%, transparent)',
        }}
      >
        <h3
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--status-error)',
            margin: '0 0 6px',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
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
        <Button variant="danger" size="sm" onClick={handleRemove}>
          Remove project
        </Button>
      </div>
    </Modal>
  );
}
