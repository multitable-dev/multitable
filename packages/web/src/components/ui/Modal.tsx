import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { IconButton } from './IconButton';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number | string;
  closeOnBackdrop?: boolean;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = 520,
  closeOnBackdrop = true,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const content = (
    <div
      onClick={closeOnBackdrop ? onClose : undefined}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        backgroundColor: 'var(--bg-overlay)',
        backdropFilter: 'blur(8px) saturate(1.1)',
        WebkitBackdropFilter: 'blur(8px) saturate(1.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        animation: 'mt-fade-in var(--dur-med) var(--ease-out)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        style={{
          width,
          maxWidth: '100%',
          maxHeight: 'calc(100vh - 32px)',
          backgroundColor: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-xl)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'mt-scale-in var(--dur-med) var(--ease-out)',
        }}
      >
        {title !== undefined && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '16px 20px',
              borderBottom: '1px solid var(--border)',
              gap: 12,
              userSelect: 'none',
              WebkitUserSelect: 'none',
            }}
          >
            <div style={{ flex: 1, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
              {title}
            </div>
            <IconButton size="sm" onClick={onClose} label="Close">
              <X size={14} />
            </IconButton>
          </div>
        )}
        <div
          className="mt-scroll"
          style={{
            padding: 20,
            overflowY: 'auto',
            flex: 1,
          }}
        >
          {children}
        </div>
        {footer && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
              padding: '12px 20px',
              borderTop: '1px solid var(--border)',
              backgroundColor: 'color-mix(in srgb, var(--bg-sidebar) 60%, transparent)',
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
