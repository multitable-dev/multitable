import React, { useEffect } from 'react';
import { useAppStore } from '../../stores/appStore';
import { wsClient } from '../../lib/ws';

export function OptionSelector() {
  const { currentOption, setOption } = useAppStore();

  useEffect(() => {
    if (!currentOption) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOption(null);
        return;
      }
      const n = parseInt(e.key);
      if (n >= 1 && n <= currentOption.options.length) {
        wsClient.sendInput(currentOption.sessionId, `${n}\r`);
        setOption(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentOption, setOption]);

  // Auto-clear on new PTY output
  useEffect(() => {
    if (!currentOption) return;
    const off = wsClient.on('pty-output', (msg) => {
      if (msg.processId === currentOption.sessionId) setOption(null);
    });
    return off;
  }, [currentOption, setOption]);

  if (!currentOption) return null;

  return (
    <div
      style={{
        padding: '8px 12px',
        borderTop: '1px solid var(--border)',
        backgroundColor: 'var(--bg-statusbar)',
      }}
    >
      <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 8 }}>
        {currentOption.question}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {currentOption.options.map((opt, i) => (
          <button
            key={i}
            onClick={() => {
              wsClient.sendInput(currentOption.sessionId, `${i + 1}\r`);
              setOption(null);
            }}
            style={{
              padding: '4px 12px',
              borderRadius: 4,
              border: '1px solid var(--border)',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            {i + 1}. {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
