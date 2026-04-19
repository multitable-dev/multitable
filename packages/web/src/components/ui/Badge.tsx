import React from 'react';

export type BadgeVariant = 'default' | 'accent' | 'running' | 'warning' | 'error' | 'muted';
export type BadgeSize = 'sm' | 'md';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  solid?: boolean;
}

function variantColors(variant: BadgeVariant): { fg: string; bg: string } {
  switch (variant) {
    case 'accent':
      return { fg: 'var(--accent-blue)', bg: 'color-mix(in srgb, var(--accent-blue) 15%, transparent)' };
    case 'running':
      return { fg: 'var(--status-running)', bg: 'color-mix(in srgb, var(--status-running) 15%, transparent)' };
    case 'warning':
      return { fg: 'var(--status-warning)', bg: 'color-mix(in srgb, var(--status-warning) 18%, transparent)' };
    case 'error':
      return { fg: 'var(--status-error)', bg: 'color-mix(in srgb, var(--status-error) 18%, transparent)' };
    case 'muted':
      return { fg: 'var(--text-muted)', bg: 'color-mix(in srgb, var(--text-muted) 15%, transparent)' };
    default:
      return { fg: 'var(--text-secondary)', bg: 'color-mix(in srgb, var(--border) 50%, transparent)' };
  }
}

const SIZE: Record<BadgeSize, React.CSSProperties> = {
  sm: { fontSize: 10, padding: '2px 7px', height: 18 },
  md: { fontSize: 11, padding: '3px 9px', height: 22 },
};

export function Badge({
  variant = 'default',
  size = 'sm',
  solid,
  style,
  children,
  ...rest
}: BadgeProps) {
  const { fg, bg } = variantColors(variant);
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        userSelect: 'none',
        WebkitUserSelect: 'none',
        borderRadius: 'var(--radius-pill)',
        fontWeight: 600,
        color: solid ? '#fff' : fg,
        backgroundColor: solid
          ? variant === 'default'
            ? 'var(--text-muted)'
            : fg
          : bg,
        border: solid ? '1px solid transparent' : '1px solid color-mix(in srgb, currentColor 22%, transparent)',
        lineHeight: 1,
        whiteSpace: 'nowrap',
        ...SIZE[size],
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  );
}
