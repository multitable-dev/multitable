import React, { useEffect, useRef, useState } from 'react';

const BRAILLE_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const FRAME_MS = 80;
const DOT_PERIOD_FRAMES = 12; // ~960ms per "...." cycle at 80ms/frame

/**
 * In-flight indicator shown between the user's prompt and the first chunk
 * of the assistant's reply (and again whenever the SDK is thinking between
 * tool calls). Braille spinner + cycling dots + elapsed-seconds counter,
 * styled to feel like a placeholder assistant message.
 */
export function ThinkingIndicator() {
  const [frame, setFrame] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const startedAtRef = useRef<number>(Date.now());

  useEffect(() => {
    startedAtRef.current = Date.now();
    const id = window.setInterval(() => {
      setFrame((f) => f + 1);
      setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, FRAME_MS);
    return () => window.clearInterval(id);
  }, []);

  const spinner = BRAILLE_FRAMES[frame % BRAILLE_FRAMES.length];
  const dotCount = Math.floor((frame % DOT_PERIOD_FRAMES) / 3); // 0..3
  const dots = '.'.repeat(dotCount).padEnd(3, ' ');

  return (
    <div
      role="status"
      aria-label="Assistant is thinking"
      style={{
        margin: '8px 0',
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 8,
        fontSize: 12.5,
        lineHeight: 1.55,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        color: 'var(--text-secondary)',
        animation: 'mt-fade-in var(--dur-med) var(--ease-out)',
      }}
    >
      <span
        aria-hidden
        style={{
          color: 'var(--accent-amber)',
          fontSize: 14,
          width: '1ch',
          display: 'inline-block',
          textAlign: 'center',
        }}
      >
        {spinner}
      </span>
      <span>
        Thinking<span style={{ display: 'inline-block', width: '3ch' }}>{dots}</span>
      </span>
      {elapsed > 0 && (
        <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
          {elapsed}s
        </span>
      )}
    </div>
  );
}
