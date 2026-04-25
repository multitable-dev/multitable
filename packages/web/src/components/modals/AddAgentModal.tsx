import React, { useState } from 'react';
import { api } from '../../lib/api';
import { useAppStore } from '../../stores/appStore';
import toast from 'react-hot-toast';
import { Modal, Input, Button, Badge } from '../ui';

const AGENTS = [
  { name: 'Claude Code', command: 'claude', recommended: true },
  { name: 'Codex', command: 'codex', comingSoon: true },
  { name: 'Gemini CLI', command: 'gemini', comingSoon: true },
  { name: 'Amp', command: 'amp', comingSoon: true },
  { name: 'Aider', command: 'aider', comingSoon: true },
  { name: 'Goose', command: 'goose', comingSoon: true },
  { name: 'Custom', command: '', comingSoon: true },
];

interface Props {
  onClose: () => void;
  projectId: string;
}

export function AddAgentModal({ onClose, projectId }: Props) {
  const store = useAppStore();
  const [command, setCommand] = useState('claude');
  const [name, setName] = useState('Claude Code');
  const [autostart, setAutostart] = useState(true);
  const [loading, setLoading] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState('Claude Code');

  const handlePresetClick = (agent: typeof AGENTS[number]) => {
    if ((agent as any).comingSoon) return;
    setSelectedAgent(agent.name);
    setName(agent.name === 'Custom' ? '' : agent.name);
    setCommand(agent.command);
  };

  const handleSubmit = async () => {
    if (!command.trim()) return;
    setLoading(true);
    try {
      const session = await api.sessions.create(projectId, { name: name || command, command });
      store.upsertSession(session);
      store.setSelectedProcess(session.id);

      // Sessions are SDK-driven now: no spawn/start step. The first user turn
      // sent through the chat composer auto-starts the agent. Until then the
      // session sits idle, which is the correct state.

      toast.success('Session added');
      onClose();
    } catch {
      toast.error('Failed to add session');
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
      title="Add Session"
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
            {loading ? 'Adding...' : 'Add Session'}
          </Button>
        </>
      }
    >
      <div onKeyDown={handleKeyDown}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
            gap: 8,
            marginBottom: 20,
          }}
        >
          {AGENTS.map(agent => {
            const comingSoon = (agent as any).comingSoon;
            const selected = selectedAgent === agent.name;
            return (
              <button
                key={agent.name}
                onClick={() => handlePresetClick(agent)}
                disabled={comingSoon}
                title={comingSoon ? 'Coming soon' : undefined}
                style={{
                  padding: '12px 10px',
                  borderRadius: 'var(--radius-md)',
                  border: `1px solid ${selected ? 'var(--accent-blue)' : 'var(--border)'}`,
                  backgroundColor: selected
                    ? 'color-mix(in srgb, var(--accent-blue) 12%, transparent)'
                    : 'var(--bg-sidebar)',
                  color: 'var(--text-primary)',
                  cursor: comingSoon ? 'not-allowed' : 'pointer',
                  fontSize: 13,
                  fontWeight: selected ? 600 : 500,
                  textAlign: 'center',
                  opacity: comingSoon ? 0.5 : 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  boxShadow: selected ? 'var(--shadow-sm), 0 0 0 1px var(--accent-blue)' : 'none',
                  transition: 'box-shadow var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out), background-color var(--dur-fast) var(--ease-out)',
                }}
              >
                <span>{agent.name}</span>
                {comingSoon ? (
                  <Badge variant="muted" size="sm">Coming soon</Badge>
                ) : (agent as any).recommended ? (
                  <Badge variant="accent" size="sm">Recommended</Badge>
                ) : null}
              </button>
            );
          })}
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
            Name
          </label>
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g., Claude Code"
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
            placeholder="e.g., claude"
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
              transition: 'border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)',
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
        </div>
      </div>
    </Modal>
  );
}
