import React from 'react';

interface KbdProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
}

export function Kbd({ children, style, ...rest }: KbdProps) {
  return (
    <kbd
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        minWidth: 18,
        height: 18,
        padding: '0 5px',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 10.5,
        fontWeight: 500,
        color: 'var(--text-secondary)',
        backgroundColor: 'var(--bg-sidebar)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        boxShadow: 'var(--shadow-inset)',
        lineHeight: 1,
        ...style,
      }}
      {...rest}
    >
      {children}
    </kbd>
  );
}
