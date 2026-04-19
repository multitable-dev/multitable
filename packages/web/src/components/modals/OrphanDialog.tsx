import React from 'react';
import { Modal, Button } from '../ui';

interface Props {
  processes: Array<{ processId: string; pid: number }>;
  onKillAll: () => void;
  onIgnore: () => void;
  onClose: () => void;
}

export function OrphanDialog({ processes, onKillAll, onIgnore, onClose }: Props) {
  return (
    <Modal
      open
      onClose={onClose}
      title="Orphaned Processes Found"
      width={520}
      footer={
        <>
          <Button variant="ghost" onClick={onIgnore}>Ignore</Button>
          <Button variant="danger" onClick={onKillAll}>Kill All</Button>
        </>
      }
    >
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 0, marginBottom: 12 }}>
        Found {processes.length} process{processes.length !== 1 ? 'es' : ''} from a previous session:
      </p>
      <ul
        className="mt-scroll"
        style={{
          margin: 0,
          padding: '10px 14px 10px 28px',
          listStyle: 'disc',
          maxHeight: 200,
          overflowY: 'auto',
          backgroundColor: 'var(--bg-sidebar)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        {processes.map(p => (
          <li
            key={p.processId}
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              marginBottom: 4,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            }}
          >
            {p.processId} (PID {p.pid})
          </li>
        ))}
      </ul>
    </Modal>
  );
}
