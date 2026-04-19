import React, { useState } from 'react';
import { api } from '../../lib/api';
import { useAppStore } from '../../stores/appStore';
import toast from 'react-hot-toast';

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

      // Auto-spawn: start the process so the PTY is ready
      try {
        if (command.trim() === 'claude') {
          await api.sessions.spawnClaude(session.id);
        } else {
          await api.processes.start(session.id);
        }
        store.updateProcessState(session.id, 'running');
      } catch {
        // Session created but spawn failed — user can manually start later
      }

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
          Add Session
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
            gap: 8,
            marginBottom: 24,
          }}
        >
          {AGENTS.map(agent => {
            const comingSoon = (agent as any).comingSoon;
            return (
              <button
                key={agent.name}
                onClick={() => handlePresetClick(agent)}
                disabled={comingSoon}
                title={comingSoon ? 'Coming soon' : undefined}
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: `1px solid ${
                    selectedAgent === agent.name
                      ? 'var(--accent-blue)'
                      : (agent as any).recommended
                        ? 'rgba(59, 130, 246, 0.3)'
                        : 'var(--border)'
                  }`,
                  backgroundColor:
                    selectedAgent === agent.name
                      ? 'rgba(59, 130, 246, 0.1)'
                      : (agent as any).recommended
                        ? 'rgba(59, 130, 246, 0.05)'
                        : 'transparent',
                  color: 'var(--text-primary)',
                  cursor: comingSoon ? 'not-allowed' : 'pointer',
                  fontSize: 13,
                  fontWeight: selectedAgent === agent.name ? 600 : 400,
                  textAlign: 'center',
                  opacity: comingSoon ? 0.45 : 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                <span>{agent.name}</span>
                {comingSoon && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 500,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: 0.4,
                    }}
                  >
                    Coming soon
                  </span>
                )}
              </button>
            );
          })}
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
            Name
          </label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g., Claude Code"
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
            placeholder="e.g., claude"
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
            {loading ? 'Adding...' : 'Add Session'}
          </button>
        </div>
      </div>
    </div>
  );
}
