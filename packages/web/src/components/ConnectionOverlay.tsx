import React from 'react';
import { useAppStore } from '../stores/appStore';
import { WifiOff, RefreshCw } from 'lucide-react';
import { wsClient } from '../lib/ws';

export function ConnectionOverlay() {
  const connectionState = useAppStore(s => s.connectionState);

  if (connectionState === 'connected') return null;

  if (connectionState === 'reconnecting') {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: 36,
          zIndex: 1000,
          background: '#f59e0b20',
          borderBottom: '1px solid #f59e0b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          fontSize: 13,
          color: '#f59e0b',
        }}
      >
        <RefreshCw
          size={14}
          style={{ animation: 'connection-spin 1s linear infinite' }}
        />
        <span>Reconnecting...</span>
      </div>
    );
  }

  // disconnected
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1500,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <WifiOff size={48} color="var(--text-muted)" />
        <span
          style={{
            fontSize: 18,
            color: 'var(--text-primary)',
            fontWeight: 600,
          }}
        >
          Cannot connect to daemon
        </span>
        <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>
          localhost:3000
        </span>
        <button
          onClick={() => wsClient.connect()}
          style={{
            padding: '8px 24px',
            fontSize: 14,
            fontWeight: 500,
            color: '#fff',
            background: 'var(--accent-blue)',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Start it with: mt start
        </span>
      </div>
    </div>
  );
}
