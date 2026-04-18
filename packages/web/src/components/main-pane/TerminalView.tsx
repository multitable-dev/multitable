import React from 'react';
import { useTerminal } from '../../hooks/useTerminal';
import { useAppStore } from '../../stores/appStore';
import { SessionHeaderBar } from './SessionHeaderBar';
import { ProcessBanner } from './ProcessBanner';
import { SessionDetailPanel } from './SessionDetailPanel';
import type { ManagedProcess, Session } from '../../lib/types';

interface Props {
  processId: string;
  process?: ManagedProcess;
}

export function TerminalView({ processId, process }: Props) {
  const containerRef = useTerminal(processId);
  const { detailPanelOpen, setDetailPanelOpen } = useAppStore();

  const isSession = process?.type === 'session';
  const session = isSession ? (process as Session) : null;

  const showBanner =
    process &&
    (process.state === 'stopped' || process.state === 'errored');

  const showDetailPanel = isSession && detailPanelOpen && session;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Session header bar */}
      {session && (
        <SessionHeaderBar
          session={session}
          onToggleDetailPanel={() => setDetailPanelOpen(!detailPanelOpen)}
        />
      )}

      {/* Process banner (stopped/errored) */}
      {showBanner && process && <ProcessBanner process={process} />}

      {/* Terminal + optional detail panel */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Terminal container */}
        <div
          style={{
            flex: showDetailPanel ? '1 1 60%' : '1',
            backgroundColor: '#1a1a1a',
            overflow: 'hidden',
            minHeight: 0,
          }}
        >
          <div
            ref={containerRef}
            className="xterm-container"
            style={{ width: '100%', height: '100%' }}
          />
        </div>

        {/* Detail panel */}
        {showDetailPanel && session && (
          <div
            style={{
              flex: '0 0 40%',
              minHeight: 120,
              maxHeight: '60%',
              overflow: 'hidden',
              borderTop: '1px solid var(--border)',
              backgroundColor: 'var(--bg-primary)',
            }}
          >
            <SessionDetailPanel session={session} projectId={session.projectId} />
          </div>
        )}
      </div>
    </div>
  );
}
