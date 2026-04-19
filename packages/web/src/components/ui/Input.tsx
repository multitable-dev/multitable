import React, { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  invalid?: boolean;
  wrapperStyle?: React.CSSProperties;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input(
    { leftIcon, rightIcon, invalid, wrapperStyle, style, disabled, ...rest },
    ref,
  ) {
    const [focus, setFocus] = React.useState(false);
    const borderColor = invalid
      ? 'var(--status-error)'
      : focus
        ? 'var(--accent-blue)'
        : 'var(--border)';

    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: leftIcon || rightIcon ? '0 10px' : 0,
          backgroundColor: disabled ? 'var(--bg-sidebar)' : 'var(--bg-primary)',
          border: `1px solid ${borderColor}`,
          borderRadius: 'var(--radius-md)',
          transition:
            'border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)',
          boxShadow: focus
            ? invalid
              ? '0 0 0 3px color-mix(in srgb, var(--status-error) 22%, transparent)'
              : 'var(--accent-glow)'
            : 'none',
          opacity: disabled ? 0.65 : 1,
          ...wrapperStyle,
        }}
      >
        {leftIcon && (
          <span
            style={{
              display: 'inline-flex',
              color: 'var(--text-muted)',
              flexShrink: 0,
            }}
          >
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          disabled={disabled}
          onFocus={(e) => { setFocus(true); rest.onFocus?.(e); }}
          onBlur={(e) => { setFocus(false); rest.onBlur?.(e); }}
          {...rest}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: 'var(--text-primary)',
            fontSize: 13,
            padding: leftIcon || rightIcon ? '8px 0' : '8px 12px',
            minWidth: 0,
            ...style,
          }}
        />
        {rightIcon && (
          <span
            style={{
              display: 'inline-flex',
              color: 'var(--text-muted)',
              flexShrink: 0,
            }}
          >
            {rightIcon}
          </span>
        )}
      </div>
    );
  },
);
