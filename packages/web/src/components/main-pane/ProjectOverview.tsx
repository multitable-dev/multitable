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
  ChevronDown,
} from 'lucide-react';
import type { Session, Command, Terminal, ManagedProcess } from '../../lib/types';

interface Props {
  projectId: string;
}

const stateColors: Record<string, string> = {
  running: 'var(--status-running)',
  idle: 'var(--status-idle)',
  stopped: 'var(--status-stopped)',
  errored: 'var(--status-error)',
};

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

  const stateLabel = process.state.toUpperCase();
  const stateColor = stateColors[process.state] ?? 'var(--text-muted)';
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
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 6,
        overflow: 'hidden',
      }}
    >
      {/* Collapsed header */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 12px',
          height: 48,
          cursor: 'pointer',
          background: 'var(--bg-sidebar)',
        }}
      >
        {expanded ? (
          <ChevronDown size={14} color="var(--text-muted)" />
        ) : (
          <ChevronRight size={14} color="var(--text-muted)" />
        )}
        <span style={{ color: 'var(--text-secondary)' }}>{typeIcon}</span>
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
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              padding: '2px 5px',
              borderRadius: 3,
              background: 'var(--accent-blue)',
              color: '#fff',
              lineHeight: 1,
            }}
          >
            AUTO
          </span>
        )}
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            padding: '2px 5px',
            borderRadius: 3,
            background: stateColor + '20',
            color: stateColor,
            lineHeight: 1,
          }}
        >
          {stateLabel}
        </span>
        <span
          style={{
            flex: 1,
            fontSize: 12,
            color: 'var(--text-muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            textAlign: 'right',
            fontFamily: 'monospace',
          }}
        >
          {process.command}
        </span>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            fontSize: 13,
          }}
        >
          <div>
            <span style={{ color: 'var(--text-muted)', marginRight: 8 }}>
              Name:
            </span>
            <span style={{ color: 'var(--text-primary)' }}>
              {process.name}
            </span>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)', marginRight: 8 }}>
              Command:
            </span>
            <span
              style={{
                color: 'var(--text-primary)',
                fontFamily: 'monospace',
                fontSize: 12,
                background: 'var(--bg-sidebar)',
                padding: '2px 6px',
                borderRadius: 3,
              }}
            >
              {process.command}
            </span>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)', marginRight: 8 }}>
              Working directory:
            </span>
            <span
              style={{
                color: 'var(--text-primary)',
                fontFamily: 'monospace',
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
            <button
              onClick={handleStart}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '5px 12px',
                fontSize: 12,
                fontWeight: 500,
                color: '#fff',
                background: 'var(--status-running)',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              <Play size={12} /> Start
            </button>
            <button
              onClick={handleStop}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '5px 12px',
                fontSize: 12,
                fontWeight: 500,
                color: '#fff',
                background: 'var(--status-error)',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              <Square size={12} /> Stop
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ProjectOverview({ projectId }: Props) {
  const store = useAppStore();
  const project = store.projects.find(p => p.id === projectId);

  const sessions = Object.values(store.sessions).filter(
    s => s.projectId === projectId,
  );
  const commands = Object.values(store.commands).filter(
    c => c.projectId === projectId,
  );
  const terminals = Object.values(store.terminals).filter(
    t => t.projectId === projectId,
  );

  const allProcesses: ManagedProcess[] = [
    ...sessions,
    ...commands,
    ...terminals,
  ];
  const runningCount = allProcesses.filter(
    p => p.state === 'running' || p.state === 'idle',
  ).length;

  const handleAddTerminal = async () => {
    if (!projectId) return;
    try {
      const terminal = await api.terminals.create(projectId, {});
      store.upsertTerminal(terminal);
    } catch {
      // ignore
    }
  };

  const secondaryButtonStyle: React.CSSProperties = {
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text-secondary)',
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: 6,
    cursor: 'pointer',
    flex: 1,
  };

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 32 }}>
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
            fontSize: 20,
            fontWeight: 700,
            color: 'var(--text-primary)',
            flex: 1,
          }}
        >
          {project?.name ?? 'Project'}
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            padding: '3px 8px',
            borderRadius: 10,
            background: 'var(--status-running)' + '20',
            color: 'var(--status-running)',
          }}
        >
          {runningCount} running
        </span>
        <button
          onClick={() => store.setProjectSettingsOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 6,
            cursor: 'pointer',
            color: 'var(--text-secondary)',
          }}
        >
          <Settings size={16} />
        </button>
      </div>

      {/* Separator */}
      <div
        style={{
          height: 1,
          background: 'var(--border)',
          marginBottom: 20,
        }}
      />

      {/* Process list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {allProcesses.length === 0 && (
          <div
            style={{
              padding: 24,
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: 13,
            }}
          >
            No processes configured yet. Add a session, command, or terminal to
            get started.
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
        <button
          onClick={() => store.setAddAgentModalOpen(true)}
          style={secondaryButtonStyle}
        >
          + Add Session
        </button>
        <button
          onClick={() => store.setAddProcessModalOpen(true)}
          style={secondaryButtonStyle}
        >
          + Add Command
        </button>
        <button onClick={handleAddTerminal} style={secondaryButtonStyle}>
          + Add Terminal
        </button>
      </div>
    </div>
  );
}
