import React, { forwardRef } from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ invalid, style, disabled, ...rest }, ref) {
    const [focus, setFocus] = React.useState(false);
    const borderColor = invalid
      ? 'var(--status-error)'
      : focus
        ? 'var(--accent-blue)'
        : 'var(--border)';
    return (
      <select
        ref={ref}
        disabled={disabled}
        onFocus={(e) => { setFocus(true); rest.onFocus?.(e); }}
        onBlur={(e) => { setFocus(false); rest.onBlur?.(e); }}
        {...rest}
        style={{
          appearance: 'none',
          WebkitAppearance: 'none',
          backgroundColor: disabled ? 'var(--bg-sidebar)' : 'var(--bg-primary)',
          border: `1px solid ${borderColor}`,
          borderRadius: 'var(--radius-md)',
          color: 'var(--text-primary)',
          fontSize: 13,
          padding: '8px 32px 8px 12px',
          outline: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          backgroundImage:
            "url('data:image/svg+xml;charset=UTF-8,%3csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%238f887a%22 stroke-width=%222.5%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3e%3cpolyline points=%226 9 12 15 18 9%22%3e%3c/polyline%3e%3c/svg%3e')",
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 10px center',
          backgroundSize: '12px',
          transition:
            'border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)',
          boxShadow: focus ? 'var(--accent-glow)' : 'none',
          opacity: disabled ? 0.65 : 1,
          ...style,
        }}
      />
    );
  },
);
