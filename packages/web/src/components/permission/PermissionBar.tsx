import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../stores/appStore';
import { wsClient } from '../../lib/ws';
import type { PermissionPrompt } from '../../lib/types';

function PermissionCard({ prompt }: { prompt: PermissionPrompt }) {
  const removePermission = useAppStore(s => s.removePermission);
  const [elapsed, setElapsed] = useState(0);
  const timeoutSecs = prompt.timeoutMs / 1000;

  useEffect(() => {
    const interval = setInterval(() => {
      const spent = (Date.now() - prompt.createdAt) / 1000;
      setElapsed(Math.min(spent, timeoutSecs));
    }, 100);
    return () => clearInterval(interval);
  }, [prompt.createdAt, timeoutSecs]);

  const progress = 1 - elapsed / timeoutSecs;

  const respond = (decision: 'allow' | 'deny' | 'always-allow') => {
    wsClient.respondPermission(prompt.id, decision);
    removePermission(prompt.id);
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-primary)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: 12,
        marginBottom: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>{prompt.toolName}</span>
        <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
          from {prompt.sessionId}
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {Math.ceil(timeoutSecs - elapsed)}s
        </span>
      </div>
      {/* Countdown bar */}
      <div
        style={{
          height: 2,
          backgroundColor: 'var(--border)',
          borderRadius: 1,
          marginBottom: 8,
        }}
      >
        <div
          style={{
            height: '100%',
            backgroundColor: 'var(--accent-blue)',
            borderRadius: 1,
            width: `${progress * 100}%`,
            transition: 'width 0.1s linear',
          }}
        />
      </div>
      <pre
        style={{
          fontSize: 11,
          color: 'var(--text-secondary)',
          margin: '0 0 8px',
          overflow: 'auto',
          maxHeight: 80,
          fontFamily: 'monospace',
        }}
      >
        {JSON.stringify(prompt.toolInput, null, 2)}
      </pre>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => respond('allow')}
          style={{
            padding: '4px 12px',
            borderRadius: 4,
            border: 'none',
            backgroundColor: 'var(--status-running)',
            color: 'white',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          Allow
        </button>
        <button
          onClick={() => respond('deny')}
          style={{
            padding: '4px 12px',
            borderRadius: 4,
            border: 'none',
            backgroundColor: 'var(--status-error)',
            color: 'white',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          Deny
        </button>
        <button
          onClick={() => respond('always-allow')}
          style={{
            padding: '4px 12px',
            borderRadius: 4,
            border: 'none',
            backgroundColor: 'var(--accent-blue)',
            color: 'white',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          Always Allow
        </button>
      </div>
    </div>
  );
}

interface PermissionBarProps {
  sessionId?: string;
}

export function PermissionBar({ sessionId }: PermissionBarProps = {}) {
  const pendingPermissions = useAppStore(s => s.pendingPermissions);
  const filtered = sessionId
    ? pendingPermissions.filter(p => p.sessionId === sessionId)
    : pendingPermissions;
  if (filtered.length === 0) return null;
  return (
    <div
      style={{
        padding: '8px 12px',
        borderTop: '1px solid var(--border)',
        backgroundColor: 'var(--bg-statusbar)',
        flexShrink: 0,
      }}
    >
      {filtered.map(prompt => (
        <PermissionCard key={prompt.id} prompt={prompt} />
      ))}
    </div>
  );
}
