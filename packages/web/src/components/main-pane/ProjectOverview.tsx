import React, { useState } from 'react';
import { useAppStore } from '../../stores/appStore';
import { api } from '../../lib/api';
import {
  Settings,
  Bot,
  TerminalSquare,
  Play,
  Square,
  ChevronRight,
  Plus,
} from 'lucide-react';
import type { Session, Command, Terminal, ManagedProcess } from '../../lib/types';
import { Button, Card, IconButton, Badge, Divider } from '../ui';

interface Props {
  projectId: string;
}

function stateBadgeVariant(state: string): 'running' | 'warning' | 'error' | 'muted' {
  if (state === 'running' || state === 'idle') return 'running';
  if (state === 'errored') return 'error';
  if (state === 'stopped') return 'muted';
  return 'warning';
}

function ProcessCard({ process }: { process: ManagedProcess }) {
  const [expanded, setExpanded] = useState(false);

  const typeIcon =
    process.type === 'session' ? (
      <Bot size={14} />
    ) : process.type === 'command' ? (
      <Play size={14} />
    ) : (
      <TerminalSquare size={14} />
    );

  const isAutostart = process.config?.autostart;

  const handleStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    api.processes.start(process.id);
  };
  const handleStop = (e: React.MouseEvent) => {
    e.stopPropagation();
    api.processes.stop(process.id);
  };
  const handleToggleAutostart = () => {
    if (process.type === 'session') {
      api.sessions.update(process.id, {
        config: { ...process.config, autostart: !process.config.autostart },
      } as Partial<Session>);
    } else if (process.type === 'command') {
      api.commands.update(process.id, {
        config: { ...process.config, autostart: !process.config.autostart },
      } as Partial<Command>);
    } else {
      api.terminals.update(process.id, {
        config: { ...process.config, autostart: !process.config.autostart },
      } as Partial<Terminal>);
    }
  };

  const handleToggleAutorestart = () => {
    if (process.type === 'session') {
      api.sessions.update(process.id, {
        config: { ...process.config, autorestart: !process.config.autorestart },
      } as Partial<Session>);
    } else if (process.type === 'command') {
      api.commands.update(process.id, {
        config: { ...process.config, autorestart: !process.config.autorestart },
      } as Partial<Command>);
    } else {
      api.terminals.update(process.id, {
        config: { ...process.config, autorestart: !process.config.autorestart },
      } as Partial<Terminal>);
    }
  };

  return (
    <Card padding={0} radius="md" style={{ overflow: 'hidden' }}>
      {/* Collapsed header */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '0 14px',
          height: 46,
          cursor: 'pointer',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          background: 'transparent',
          transition: 'background-color var(--dur-fast) var(--ease-out)',
        }}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--bg-hover)')
        }
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent')
        }
      >
        <ChevronRight
          size={14}
          style={{
            color: 'var(--text-muted)',
            flexShrink: 0,
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform var(--dur-fast) var(--ease-out)',
          }}
        />
        <span style={{ color: 'var(--text-secondary)', display: 'flex' }}>{typeIcon}</span>
        <span
          style={{
            fontWeight: 500,
            fontSize: 13,
            color: 'var(--text-primary)',
          }}
        >
          {process.name}
        </span>
        {isAutostart && (
          <Badge variant="accent" size="sm">
            AUTO
          </Badge>
        )}
        <Badge variant={stateBadgeVariant(process.state)} size="sm">
          {process.state.toUpperCase()}
        </Badge>
        <span
          style={{
            flex: 1,
            fontSize: 12,
            color: 'var(--text-muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            textAlign: 'right',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          }}
        >
          {process.command}
        </span>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div
          style={{
            padding: '14px 16px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            fontSize: 13,
            backgroundColor: 'color-mix(in srgb, var(--bg-sidebar) 40%, transparent)',
          }}
        >
          <div>
            <span style={{ color: 'var(--text-muted)', marginRight: 8 }}>Name:</span>
            <span style={{ color: 'var(--text-primary)' }}>{process.name}</span>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)', marginRight: 8 }}>Command:</span>
            <span
              style={{
                color: 'var(--text-primary)',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 12,
                background: 'var(--bg-sidebar)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
              }}
            >
              {process.command}
            </span>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)', marginRight: 8 }}>Working directory:</span>
            <span
              style={{
                color: 'var(--text-primary)',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 12,
              }}
            >
              {process.workingDir}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
                color: 'var(--text-secondary)',
              }}
            >
              <input
                type="checkbox"
                checked={process.config?.autostart ?? false}
                onChange={handleToggleAutostart}
              />
              Auto-start
            </label>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
                color: 'var(--text-secondary)',
              }}
            >
              <input
                type="checkbox"
                checked={process.config?.autorestart ?? false}
                onChange={handleToggleAutorestart}
              />
              Auto-restart
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <Button size="sm" variant="primary" leftIcon={<Play size={12} />} onClick={handleStart}>
              Start
            </Button>
            <Button size="sm" variant="danger" leftIcon={<Square size={12} />} onClick={handleStop}>
              Stop
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

export function ProjectOverview({ projectId }: Props) {
  const store = useAppStore();
  const project = store.projects.find(p => p.id === projectId);

  const sessions = Object.values(store.sessions).filter(s => s.projectId === projectId);
  const commands = Object.values(store.commands).filter(c => c.projectId === projectId);
  const terminals = Object.values(store.terminals).filter(t => t.projectId === projectId);

  const allProcesses: ManagedProcess[] = [...sessions, ...commands, ...terminals];
  const runningCount = allProcesses.filter(p => p.state === 'running' || p.state === 'idle').length;

  const handleAddTerminal = async () => {
    if (!projectId) return;
    try {
      const terminal = await api.terminals.create(projectId, {});
      store.upsertTerminal(terminal);
    } catch {
      // ignore
    }
  };

  return (
    <div
      className="mt-scroll"
      style={{ flex: 1, overflow: 'auto', padding: 32, animation: 'mt-fade-in var(--dur-med) var(--ease-out)' }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <span
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: 'var(--text-primary)',
            flex: 1,
            letterSpacing: -0.3,
          }}
        >
          {project?.name ?? 'Project'}
        </span>
        {runningCount > 0 ? (
          <Badge variant="running" size="md">
            {runningCount} running
          </Badge>
        ) : allProcesses.length > 0 ? (
          <Badge variant="muted" size="md">
            Idle
          </Badge>
        ) : null}
        <IconButton label="Project settings" onClick={() => store.setProjectSettingsOpen(true)}>
          <Settings size={15} />
        </IconButton>
      </div>

      <Divider margin={20} />

      {/* Process list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {allProcesses.length === 0 && (
          <div
            style={{
              padding: 24,
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: 13,
              border: '1px dashed var(--border)',
              borderRadius: 'var(--radius-lg)',
            }}
          >
            No processes configured yet. Add a session, command, or terminal to get started.
          </div>
        )}
        {allProcesses.map(p => (
          <ProcessCard key={p.id} process={p} />
        ))}
      </div>

      {/* Add buttons */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginTop: 24,
        }}
      >
        <Button
          block
          variant="secondary"
          leftIcon={<Plus size={14} />}
          onClick={() => store.setAddAgentModalOpen(true)}
        >
          Add Session
        </Button>
        <Button
          block
          variant="secondary"
          leftIcon={<Plus size={14} />}
          onClick={() => store.setAddProcessModalOpen(true)}
        >
          Add Command
        </Button>
        <Button
          block
          variant="secondary"
          leftIcon={<Plus size={14} />}
          onClick={handleAddTerminal}
        >
          Add Terminal
        </Button>
      </div>
    </div>
  );
}
