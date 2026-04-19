import React, { useState } from 'react';
import { api } from '../../lib/api';
import { useAppStore } from '../../stores/appStore';
import toast from 'react-hot-toast';
import { Modal, Input, Button } from '../ui';

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
      store.expandProject(project.id);
      store.setProjectOverviewOpen(true);
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
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Add Project"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleAdd}
            disabled={!dirPath.trim()}
            loading={loading}
          >
            {loading ? 'Adding...' : 'Add Project'}
          </Button>
        </>
      }
    >
      <p
        style={{
          margin: '0 0 14px',
          fontSize: 13,
          color: 'var(--text-secondary)',
        }}
      >
        Enter the absolute path to your project directory.
      </p>
      <Input
        autoFocus
        value={dirPath}
        onChange={(e) => setDirPath(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="/home/user/my-project"
        style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
      />
    </Modal>
  );
}
