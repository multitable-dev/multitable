import React, { useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { useAppStore } from '../../stores/appStore';
import toast from 'react-hot-toast';
import { Modal, Input, Button, Badge } from '../ui';
import { useTranscripts, type TranscriptSession } from '../../hooks/useTranscripts';
import { PastAgentsList } from '../sidebar/PastAgentsList';
import { resumePastSession, selectPinnedSession } from '../../lib/pastAgents';

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
  const projectPath = useAppStore((s) => s.projects.find((p) => p.id === projectId)?.path);
  const [command, setCommand] = useState('claude');
  const [name, setName] = useState('Claude Code');
  const [autostart, setAutostart] = useState(true);
  const [loading, setLoading] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState('Claude Code');
  const [resumingId, setResumingId] = useState<string | null>(null);

  const { data, loading: pastLoading, error: pastError, grouped, loadMoreForCwd } = useTranscripts({
    cwd: projectPath,
    enabled: !!projectPath,
    limit: 20,
  });
  const pastGroup = useMemo(() => grouped[0] ?? null, [grouped]);
  const visiblePastCount = useMemo(() => {
    if (!pastGroup) return 0;
    return pastGroup.sessions.filter((s) => !s.pinnedSessionId).length;
  }, [pastGroup]);

  const handlePickPast = async (session: TranscriptSession) => {
    if (resumingId || loading) return;
    setResumingId(session.sessionId);
    try {
      const ok = session.pinnedSessionId
        ? await selectPinnedSession(session.pinnedSessionId)
        : await resumePastSession(session.sessionId);
      if (ok) onClose();
    } finally {
      setResumingId(null);
    }
  };

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

      toast.success('Agent added');
      onClose();
    } catch {
      toast.error('Failed to add agent');
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
      title="Add Agent"
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
            {loading ? 'Adding...' : 'Add Agent'}
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

        {projectPath && (
          <div
            style={{
              marginTop: 20,
              paddingTop: 14,
              borderTop: '1px solid var(--border)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 8,
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  fontSize: 9.5,
                  fontWeight: 500,
                  color: 'var(--text-faint)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.18em',
                }}
              >
                Or resume a past agent
              </span>
              {visiblePastCount > 0 && (
                <span
                  style={{
                    fontSize: 10,
                    color: 'var(--text-faint)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  ({visiblePastCount})
                </span>
              )}
            </div>
            <div
              className="mt-scroll"
              style={{
                maxHeight: 220,
                overflowY: 'auto',
                marginLeft: -16,
              }}
            >
              <PastAgentsList
                mode="project"
                group={pastGroup}
                loading={pastLoading}
                error={pastError}
                hasFetched={!!data && !pastLoading}
                hidePinned
                perGroupLimit={5}
                inFlightSessionId={resumingId}
                onPickSession={handlePickPast}
                onLoadMore={() => {
                  if (pastGroup) loadMoreForCwd(pastGroup.cwd, pastGroup.totalCount);
                }}
                emptyText="No past agents for this project"
              />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
