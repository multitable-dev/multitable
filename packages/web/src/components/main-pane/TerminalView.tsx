import React from 'react';
import { useTerminal } from '../../hooks/useTerminal';
import { useAppStore } from '../../stores/appStore';
import { SessionHeaderBar } from './SessionHeaderBar';
import { ProcessBanner } from './ProcessBanner';
import { SessionDetailPanel } from './SessionDetailPanel';
import { PermissionBar } from '../permission/PermissionBar';
import type { ManagedProcess, Session } from '../../lib/types';

interface Props {
  processId: string;
  process?: ManagedProcess;
}

export function TerminalView({ processId, process }: Props) {
  const isSession = process?.type === 'session';
  const session = isSession ? (process as Session) : null;

  // Only disable terminal for errored sessions (resume failed / broken).
  // Stopped sessions keep the terminal visible with scrollback.
  const terminalDisabled = isSession && session?.state === 'errored';

  const attachKind =
    process?.type === 'session' ? 'session' : process?.type === 'terminal' ? 'terminal' : null;
  const containerRef = useTerminal(processId, !!terminalDisabled, { attachKind });
  const { detailPanelOpen, setDetailPanelOpen } = useAppStore();

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
        {/* Terminal container — hidden when session needs user action */}
        {terminalDisabled ? (
          <div
            style={{
              flex: 1,
              backgroundColor: '#1a1a1a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              fontSize: 14,
            }}
          >
            Terminal unavailable — prior session not found
          </div>
        ) : (
          <div
            style={{
              flex: showDetailPanel ? '1 1 60%' : '1',
              backgroundColor: '#1a1a1a',
              overflow: 'hidden',
              minHeight: 0,
              position: 'relative',
              boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.05), inset 0 -1px 0 rgba(0, 0, 0, 0.4)',
            }}
          >
            <div
              ref={containerRef}
              className="xterm-container"
              style={{ width: '100%', height: '100%' }}
            />
            {/* Session-scoped permission confirmations (overlay on terminal) */}
            {session && <PermissionBar sessionId={session.id} />}
          </div>
        )}

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
            <SessionDetailPanel key={session.id} session={session} projectId={session.projectId} />
          </div>
        )}
      </div>
    </div>
  );
}
