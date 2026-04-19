import React, { forwardRef } from 'react';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'xs' | 'sm' | 'md';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  loading?: boolean;
  block?: boolean;
}

const SIZE: Record<ButtonSize, React.CSSProperties> = {
  xs: { padding: '2px 8px', fontSize: 11, height: 22, gap: 4 },
  sm: { padding: '4px 10px', fontSize: 12, height: 26, gap: 5 },
  md: { padding: '6px 14px', fontSize: 13, height: 32, gap: 6 },
};

function variantStyle(variant: ButtonVariant): React.CSSProperties {
  switch (variant) {
    case 'primary':
      return {
        backgroundColor: 'var(--accent-blue)',
        color: '#fff',
        border: '1px solid transparent',
        boxShadow: 'var(--shadow-sm), var(--shadow-inset)',
      };
    case 'secondary':
      return {
        backgroundColor: 'transparent',
        color: 'var(--text-primary)',
        border: '1px solid var(--border)',
      };
    case 'ghost':
      return {
        backgroundColor: 'transparent',
        color: 'var(--text-primary)',
        border: '1px solid transparent',
      };
    case 'danger':
      return {
        backgroundColor: 'var(--status-error)',
        color: '#fff',
        border: '1px solid transparent',
        boxShadow: 'var(--shadow-sm), var(--shadow-inset)',
      };
  }
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = 'secondary',
      size = 'md',
      leftIcon,
      rightIcon,
      loading,
      block,
      children,
      disabled,
      style,
      onMouseEnter,
      onMouseLeave,
      onMouseDown,
      onMouseUp,
      ...rest
    },
    ref,
  ) {
    const [hover, setHover] = React.useState(false);
    const [active, setActive] = React.useState(false);
    const isDisabled = disabled || loading;

    const hoverExtras: React.CSSProperties =
      hover && !isDisabled
        ? variant === 'primary'
          ? { boxShadow: 'var(--accent-glow), var(--shadow-sm), var(--shadow-inset)', filter: 'brightness(1.06)' }
          : variant === 'secondary'
            ? { backgroundColor: 'var(--bg-hover)', borderColor: 'var(--border-strong)' }
            : variant === 'ghost'
              ? { backgroundColor: 'var(--bg-hover)' }
              : { filter: 'brightness(1.06)' }
        : {};

    const activeExtras: React.CSSProperties =
      active && !isDisabled ? { transform: 'translateY(1px)' } : {};

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        onMouseEnter={(e) => { setHover(true); onMouseEnter?.(e); }}
        onMouseLeave={(e) => { setHover(false); setActive(false); onMouseLeave?.(e); }}
        onMouseDown={(e) => { setActive(true); onMouseDown?.(e); }}
        onMouseUp={(e) => { setActive(false); onMouseUp?.(e); }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          whiteSpace: 'nowrap',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          borderRadius: 'var(--radius-md)',
          fontWeight: 500,
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          opacity: isDisabled ? 0.55 : 1,
          transition:
            'background-color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out), filter var(--dur-fast) var(--ease-out)',
          width: block ? '100%' : undefined,
          ...SIZE[size],
          ...variantStyle(variant),
          ...hoverExtras,
          ...activeExtras,
          ...style,
        }}
        {...rest}
      >
        {loading ? <Spinner size="sm" /> : leftIcon}
        {children && <span>{children}</span>}
        {!loading && rightIcon}
      </button>
    );
  },
);
