import React, { memo } from 'react';
import { getProjectColor } from '../../../lib/projectColor';
import { useIsDark } from '../../../hooks/useIsDark';

interface Props {
  text: string;
  projectId: string;
}

// User messages sit on the same side as assistant messages so the conversation
// reads as one continuous flow. They earn their own visual identity from a
// brighter elevated background, a project-color left stripe, and a soft drop
// shadow — the only place in the chat that uses elevation, so it pops without
// adding a four-sided frame.
export const UserMessage = memo(function UserMessage({ text, projectId }: Props) {
  const dark = useIsDark();
  const projectColor = getProjectColor(projectId, dark);
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', margin: '12px 0' }}>
      <div
        style={{
          maxWidth: '85%',
          padding: '10px 14px 10px 15px',
          backgroundColor: 'var(--bg-elevated)',
          color: 'var(--text-primary)',
          borderLeft: `3px solid ${projectColor.stripe}`,
          borderRadius: 'var(--radius-soft)',
          boxShadow:
            '0 1px 0 rgba(255, 255, 255, 0.04) inset, 0 6px 16px rgba(0, 0, 0, 0.45), 0 2px 4px rgba(0, 0, 0, 0.25)',
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
