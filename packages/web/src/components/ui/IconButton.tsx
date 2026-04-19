import React, { forwardRef } from 'react';

export type IconButtonSize = 'sm' | 'md' | 'lg';
export type IconButtonVariant = 'ghost' | 'subtle' | 'danger';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: IconButtonSize;
  variant?: IconButtonVariant;
  label?: string;
}

const BOX: Record<IconButtonSize, number> = { sm: 22, md: 28, lg: 36 };

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    { size = 'md', variant = 'ghost', label, children, style, onMouseEnter, onMouseLeave, disabled, title, ...rest },
    ref,
  ) {
    const [hover, setHover] = React.useState(false);
    const box = BOX[size];

    const hoverBg =
      variant === 'danger'
        ? 'color-mix(in srgb, var(--status-error) 16%, transparent)'
        : 'var(--bg-hover)';
    const baseColor =
      variant === 'danger' ? 'var(--status-error)' : 'var(--text-secondary)';

    return (
      <button
        ref={ref}
        disabled={disabled}
        title={title ?? label}
        aria-label={label ?? title}
        onMouseEnter={(e) => { setHover(true); onMouseEnter?.(e); }}
        onMouseLeave={(e) => { setHover(false); onMouseLeave?.(e); }}
        style={{
          width: box,
          height: box,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          background: hover && !disabled ? hoverBg : variant === 'subtle' ? 'var(--bg-elevated)' : 'transparent',
          border: variant === 'subtle' ? '1px solid var(--border)' : '1px solid transparent',
          color: hover && !disabled ? (variant === 'danger' ? 'var(--status-error)' : 'var(--text-primary)') : baseColor,
          borderRadius: 'var(--radius-md)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          flexShrink: 0,
          transition:
            'background-color var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out)',
          ...style,
        }}
        {...rest}
      >
        {children}
      </button>
    );
  },
);
