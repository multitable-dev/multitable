import React, { memo } from 'react';

interface Props {
  text: string;
}

// User messages render as a right-aligned bubble with the literal text the
// user typed. No markdown — we keep user input exactly as submitted.
// Memoized so store updates that don't change the text don't re-render.
export const UserMessage = memo(function UserMessage({ text }: Props) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '8px 0' }}>
      <div
        style={{
          maxWidth: '80%',
          padding: '8px 12px',
          backgroundColor: 'color-mix(in srgb, var(--accent-blue) 18%, transparent)',
          color: 'var(--text-primary)',
          border: '1px solid color-mix(in srgb, var(--accent-blue) 35%, transparent)',
          borderRadius: 'var(--radius-lg)',
          fontSize: 13.5,
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {text}
      </div>
    </div>
  );
});
