import React, { useRef } from 'react';
import toast from 'react-hot-toast';
import { Paperclip } from 'lucide-react';
import { uploadAttachment, quotePath, type AttachmentKind } from '../../lib/attachments';
import { wsClient } from '../../lib/ws';
import { IconButton } from '../ui';

interface Props {
  processId: string;
  kind: AttachmentKind;
  variant?: 'icon' | 'toolbar';
}

export function AttachButton({ processId, kind, variant = 'icon' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const onPick = () => inputRef.current?.click();

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    // Reset so the same file can be picked again later
    e.target.value = '';
    if (files.length === 0) return;

    const paths: string[] = [];
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name}: not an image`);
        continue;
      }
      const toastId = toast.loading(`Uploading ${file.name || 'image'}…`);
      try {
        const result = await uploadAttachment(kind, processId, file);
        paths.push(quotePath(result.path));
        toast.success(`Attached ${result.filename}`, { id: toastId });
      } catch (err: any) {
        toast.error(err?.message || 'Upload failed', { id: toastId });
      }
    }

    if (paths.length > 0) {
      wsClient.sendInput(processId, paths.join(' ') + ' ');
    }
  };

  const hiddenInput = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      multiple
      onChange={onChange}
      style={{ display: 'none' }}
    />
  );

  if (variant === 'toolbar') {
    return (
      <>
        {hiddenInput}
        <button
          onClick={onPick}
          aria-label="Attach image"
          style={{
            minWidth: 44,
            height: 40,
            padding: '0 10px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            backgroundColor: 'var(--bg-elevated)',
            color: 'var(--text-primary)',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            flexShrink: 0,
            touchAction: 'manipulation',
            boxShadow: 'var(--shadow-sm), var(--shadow-inset)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition:
              'background-color var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out)',
          }}
          onTouchStart={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(1px)';
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--bg-hover)';
          }}
          onTouchEnd={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--bg-elevated)';
          }}
        >
          <Paperclip size={16} />
        </button>
      </>
    );
  }

  return (
    <>
      {hiddenInput}
      <IconButton size="sm" onClick={onPick} label="Attach image">
        <Paperclip size={14} />
      </IconButton>
    </>
  );
}
