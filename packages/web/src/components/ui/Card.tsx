import React, { forwardRef } from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  padding?: number | string;
  radius?: 'md' | 'lg' | 'xl';
  elevated?: boolean;
}

const RADIUS_MAP = {
  md: 'var(--radius-md)',
  lg: 'var(--radius-lg)',
  xl: 'var(--radius-xl)',
} as const;

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { interactive, padding = 16, radius = 'lg', elevated = true, style, onMouseEnter, onMouseLeave, ...rest },
  ref,
) {
  const [hover, setHover] = React.useState(false);
  return (
    <div
      ref={ref}
      onMouseEnter={(e) => { setHover(true); onMouseEnter?.(e); }}
      onMouseLeave={(e) => { setHover(false); onMouseLeave?.(e); }}
      style={{
        backgroundColor: elevated ? 'var(--bg-elevated)' : 'var(--bg-sidebar)',
        border: `1px solid ${interactive && hover ? 'var(--accent-blue)' : 'var(--border)'}`,
        borderRadius: RADIUS_MAP[radius],
        padding,
        boxShadow: interactive && hover ? 'var(--shadow-md)' : 'var(--shadow-sm)',
        transition:
          'border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-med) var(--ease-out), transform var(--dur-med) var(--ease-out)',
        cursor: interactive ? 'pointer' : 'default',
        userSelect: interactive ? 'none' : undefined,
        WebkitUserSelect: interactive ? 'none' : undefined,
        ...style,
      }}
      {...rest}
    />
  );
});
