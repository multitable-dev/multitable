import React, { useEffect, useRef } from 'react';

export interface MenuItem {
  label: string;
  action: () => void;
  divider?: boolean;
  danger?: boolean;
  disabled?: boolean;
}

interface Props {
  items: MenuItem[];
  position: { x: number; y: number };
  onClose: () => void;
}

export function ContextMenu({ items, position, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Adjust position to stay on screen
  let left = position.x;
  let top = position.y;
  const menuWidth = 200;
  const menuHeight = items.length * 32 + 8;
  if (left + menuWidth > window.innerWidth) left = window.innerWidth - menuWidth - 8;
  if (top + menuHeight > window.innerHeight) top = window.innerHeight - menuHeight - 8;
  if (left < 0) left = 8;
  if (top < 0) top = 8;

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left,
        top,
        zIndex: 2000,
        backgroundColor: 'var(--bg-primary)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
        padding: '4px 0',
        minWidth: 180,
      }}
    >
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {item.divider && (
            <div
              style={{
                borderTop: '1px solid var(--border)',
                margin: '4px 0',
              }}
            />
          )}
          <div
            onClick={() => {
              if (item.disabled) return;
              item.action();
              onClose();
            }}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              cursor: item.disabled ? 'default' : 'pointer',
              color: item.danger
                ? 'var(--status-error)'
                : item.disabled
                  ? 'var(--text-muted)'
                  : 'var(--text-primary)',
              opacity: item.disabled ? 0.5 : 1,
              backgroundColor: 'transparent',
            }}
            onMouseEnter={(e) => {
              if (!item.disabled) {
                (e.currentTarget as HTMLDivElement).style.backgroundColor =
                  'var(--bg-sidebar)';
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.backgroundColor =
                'transparent';
            }}
          >
            {item.label}
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}
