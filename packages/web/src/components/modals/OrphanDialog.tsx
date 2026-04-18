import React from 'react';

interface Props {
  processes: Array<{ processId: string; pid: number }>;
  onKillAll: () => void;
  onIgnore: () => void;
  onClose: () => void;
}

export function OrphanDialog({ processes, onKillAll, onIgnore, onClose }: Props) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderRadius: 12,
          padding: 32,
          maxWidth: 500,
          width: '100%',
          border: '1px solid var(--border)',
        }}
      >
        <h2
          style={{
            fontSize: 18,
            fontWeight: 600,
            marginBottom: 8,
            marginTop: 0,
            color: 'var(--text-primary)',
          }}
        >
          Orphaned Processes Found
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
          Found {processes.length} process{processes.length !== 1 ? 'es' : ''} from a
          previous session:
        </p>
        <ul style={{ marginBottom: 24, paddingLeft: 20 }}>
          {processes.map(p => (
            <li
              key={p.processId}
              style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}
            >
              {p.processId} (PID {p.pid})
            </li>
          ))}
        </ul>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onIgnore}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              color: 'var(--text-primary)',
              fontSize: 14,
            }}
          >
            Ignore
          </button>
          <button
            onClick={onKillAll}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: 'none',
              backgroundColor: 'var(--status-error)',
              color: 'white',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            Kill All
          </button>
        </div>
      </div>
    </div>
  );
}
