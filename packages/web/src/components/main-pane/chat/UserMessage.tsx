import React, { memo } from 'react';

interface Props {
  text: string;
}

// User messages render as a flat block with a 3px amber left edge.
// No bubble, no rounded corners, no blue tint — terminal aesthetic.
export const UserMessage = memo(function UserMessage({ text }: Props) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '8px 0' }}>
      <div
        style={{
          maxWidth: '80%',
          padding: '8px 12px',
          backgroundColor: 'var(--bg-elevated)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-strong)',
          borderLeft: '3px solid var(--accent-amber)',
          borderRadius: 0,
          fontSize: 12.5,
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
