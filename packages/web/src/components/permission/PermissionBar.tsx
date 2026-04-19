import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../stores/appStore';
import { wsClient } from '../../lib/ws';
import type { PermissionPrompt } from '../../lib/types';
import { Button } from '../ui';

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
        backgroundColor: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: 14,
        marginBottom: 8,
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10, gap: 8, userSelect: 'none', WebkitUserSelect: 'none' }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
          {prompt.toolName}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }}>
          from {prompt.sessionId}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
          {Math.ceil(timeoutSecs - elapsed)}s
        </span>
      </div>
      {/* Countdown bar */}
      <div
        style={{
          height: 3,
          backgroundColor: 'var(--border)',
          borderRadius: 'var(--radius-pill)',
          marginBottom: 10,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            backgroundColor: 'var(--accent-blue)',
            borderRadius: 'var(--radius-pill)',
            width: `${progress * 100}%`,
            boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.35)',
            transition: 'width 0.1s linear',
          }}
        />
      </div>
      <pre
        className="mt-scroll"
        style={{
          fontSize: 11,
          color: 'var(--text-secondary)',
          margin: '0 0 10px',
          overflow: 'auto',
          maxHeight: 90,
          padding: '8px 10px',
          backgroundColor: 'color-mix(in srgb, var(--bg-sidebar) 60%, transparent)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        }}
      >
        {JSON.stringify(prompt.toolInput, null, 2)}
      </pre>
      <div style={{ display: 'flex', gap: 6 }}>
        <Button size="sm" variant="primary" onClick={() => respond('allow')}>
          Allow
        </Button>
        <Button size="sm" variant="ghost" onClick={() => respond('always-allow')}>
          Always Allow
        </Button>
        <div style={{ flex: 1 }} />
        <Button size="sm" variant="danger" onClick={() => respond('deny')}>
          Deny
        </Button>
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
      className="mt-scroll"
      style={{
        position: 'absolute',
        left: 12,
        right: 12,
        bottom: 12,
        padding: 12,
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--border)',
        backgroundColor: 'color-mix(in srgb, var(--bg-statusbar) 95%, transparent)',
        backdropFilter: 'blur(12px) saturate(1.1)',
        WebkitBackdropFilter: 'blur(12px) saturate(1.1)',
        boxShadow: 'var(--shadow-lg)',
        zIndex: 10,
        maxHeight: '60%',
        overflowY: 'auto',
        animation: 'mt-slide-up var(--dur-med) var(--ease-out)',
      }}
    >
      {filtered.map(prompt => (
        <PermissionCard key={prompt.id} prompt={prompt} />
      ))}
    </div>
  );
}
