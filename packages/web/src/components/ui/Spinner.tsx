import React from 'react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  style?: React.CSSProperties;
}

const SIZE = { sm: 12, md: 16, lg: 28 } as const;

export function Spinner({ size = 'md', color = 'currentColor', style }: SpinnerProps) {
  const px = SIZE[size];
  const stroke = size === 'lg' ? 3 : 2;
  return (
    <span
      role="status"
      aria-label="Loading"
      style={{
        display: 'inline-block',
        width: px,
        height: px,
        border: `${stroke}px solid color-mix(in srgb, ${color} 20%, transparent)`,
        borderTopColor: color,
        borderRadius: '50%',
        animation: 'connection-spin 0.8s linear infinite',
        flexShrink: 0,
        ...style,
      }}
    />
  );
}
