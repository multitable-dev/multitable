import React from 'react';
import toast from 'react-hot-toast';
import { useAppStore } from '../../stores/appStore';
import { wsClient } from '../../lib/ws';
import { AttachButton } from '../main-pane/AttachButton';
import type { AttachmentKind } from '../../lib/attachments';

type Key = { label: string; input: string; title?: string };

const KEYS: Key[] = [
  { label: '\u238B', input: '\x1b', title: 'Esc' },
  { label: 'Tab', input: '\t' },
  { label: '\u21E7Tab', input: '\x1b[Z', title: 'Shift+Tab' },
  { label: '\u2303C', input: '\x03', title: 'Ctrl+C' },
  { label: '\u2303D', input: '\x04', title: 'Ctrl+D' },
  { label: '\u2303L', input: '\x0c', title: 'Ctrl+L (clear)' },
  { label: '\u2303R', input: '\x12', title: 'Ctrl+R (history)' },
  { label: '\u2303Z', input: '\x1a', title: 'Ctrl+Z' },
  { label: '\u2190', input: '\x1b[D', title: 'Left' },
  { label: '\u2192', input: '\x1b[C', title: 'Right' },
  { label: '\u2191', input: '\x1b[A', title: 'Up' },
  { label: '\u2193', input: '\x1b[B', title: 'Down' },
  { label: 'Home', input: '\x1b[H' },
  { label: 'End', input: '\x1b[F' },
  { label: 'PgUp', input: '\x1b[5~' },
  { label: 'PgDn', input: '\x1b[6~' },
  { label: '\u21B5', input: '\r', title: 'Enter' },
];

const buttonStyle: React.CSSProperties = {
  minWidth: 44,
  height: 40,
  padding: '0 10px',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border)',
  backgroundColor: 'var(--bg-elevated)',
  color: 'var(--text-primary)',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  flexShrink: 0,
  touchAction: 'manipulation',
  boxShadow: 'var(--shadow-sm), var(--shadow-inset)',
  transition:
    'background-color var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  whiteSpace: 'nowrap',
};

function onPressDown(e: React.TouchEvent<HTMLButtonElement> | React.MouseEvent<HTMLButtonElement>) {
  const el = e.currentTarget as HTMLButtonElement;
  el.style.transform = 'translateY(1px)';
  el.style.backgroundColor = 'var(--bg-hover)';
}
function onPressUp(e: React.TouchEvent<HTMLButtonElement> | React.MouseEvent<HTMLButtonElement>) {
  const el = e.currentTarget as HTMLButtonElement;
  el.style.transform = 'translateY(0)';
  el.style.backgroundColor = 'var(--bg-elevated)';
}

export function TouchToolbar() {
  const selectedProcessId = useAppStore(s => s.selectedProcessId);
  const attachKind = useAppStore((s): AttachmentKind | null => {
    if (!s.selectedProcessId) return null;
    if (s.sessions[s.selectedProcessId]) return 'session';
    if (s.terminals[s.selectedProcessId]) return 'terminal';
    return null;
  });

  if (!selectedProcessId) return null;

  const sendKey = (input: string) => {
    wsClient.sendInput(selectedProcessId, input);
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) wsClient.sendInput(selectedProcessId, text);
    } catch {
      toast.error('Clipboard access denied');
    }
  };

  return (
    <div
      className="mt-scroll"
      style={{
        display: 'flex',
        height: 52,
        backgroundColor: 'var(--bg-statusbar)',
        borderTop: '1px solid var(--border)',
        alignItems: 'center',
        gap: 4,
        padding: '0 6px',
        overflowX: 'auto',
        flexShrink: 0,
      }}
    >
      {attachKind && (
        <AttachButton processId={selectedProcessId} kind={attachKind} variant="toolbar" />
      )}
      <button
        onClick={pasteFromClipboard}
        title="Paste"
        aria-label="Paste"
        style={buttonStyle}
        onTouchStart={onPressDown}
        onTouchEnd={onPressUp}
      >
        Paste
      </button>
      {KEYS.map(k => (
        <button
          key={k.label}
          onClick={() => sendKey(k.input)}
          title={k.title ?? k.label}
          aria-label={k.title ?? k.label}
          style={buttonStyle}
          onTouchStart={onPressDown}
          onTouchEnd={onPressUp}
        >
          {k.label}
        </button>
      ))}
    </div>
  );
}
