import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { PanelBottom, Copy, Check, Pencil, Sparkles } from 'lucide-react';
import { StatusDot } from '../sidebar/StatusDot';
import { AttachButton } from './AttachButton';
import type { Session } from '../../lib/types';
import { IconButton, Spinner } from '../ui';
import { api } from '../../lib/api';
import { useAppStore } from '../../stores/appStore';

interface Props {
  session: Session;
  onToggleDetailPanel: () => void;
}

export function SessionHeaderBar({ session, onToggleDetailPanel }: Props) {
  const claudeState = session.claudeState;
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(session.name);
  const [aiLoading, setAiLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const upsertSession = useAppStore((s) => s.upsertSession);

  useEffect(() => {
    if (editing) {
      setDraftName(session.name);
      // Defer to next frame so the input is mounted before focusing.
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [editing, session.name]);

  // If a server-side rename arrives while not editing, keep draft in sync so
  // the next edit starts from the latest value.
  useEffect(() => {
    if (!editing) setDraftName(session.name);
  }, [session.name, editing]);

  const commitRename = async () => {
    const next = draftName.trim();
    if (!next || next === session.name) {
      setEditing(false);
      setDraftName(session.name);
      return;
    }
    setEditing(false);
    try {
      const updated = await api.sessions.update(session.id, { name: next });
      upsertSession({ ...session, ...updated });
    } catch {
      toast.error('Failed to rename session');
      setDraftName(session.name);
    }
  };

  const cancelRename = () => {
    setEditing(false);
    setDraftName(session.name);
  };

  const handleAiRename = async () => {
    if (aiLoading) return;
    setAiLoading(true);
    try {
      const result = await api.sessions.renameAi(session.id);
      upsertSession({ ...session, ...result.session });
      toast.success(`Renamed to "${result.name}"`, { duration: 2200 });
    } catch (err: any) {
      const msg = err?.message || 'AI rename failed';
      toast.error(`AI rename: ${msg}`, { duration: 5000, style: { maxWidth: 480 } });
    } finally {
      setAiLoading(false);
    }
  };

  const handleCopySessionId = () => {
    if (claudeState?.claudeSessionId) {
      navigator.clipboard.writeText(claudeState.claudeSessionId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }
  };

  const formatTokens = (n: number): string => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
    return n.toLocaleString();
  };

  const formatCost = (n: number): string => {
    if (n >= 1) return `$${n.toFixed(2)}`;
    if (n >= 0.01) return `$${n.toFixed(3)}`;
    if (n > 0) return `$${n.toFixed(4)}`;
    return '$0.00';
  };

  const costUsd = claudeState?.costUsd ?? 0;
  const tokenCount = claudeState?.tokenCount ?? 0;

  const chipStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 10px',
    height: 20,
    fontSize: 11.5,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    color: 'var(--text-secondary)',
    backgroundColor: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-pill)',
    lineHeight: 1,
  };

  return (
    <div
      style={{
        minHeight: 42,
        backgroundColor: 'var(--bg-sidebar)',
        borderBottom: '1px solid var(--border)',
        padding: '6px 14px',
        boxSizing: 'border-box',
        flexShrink: 0,
      }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, minWidth: 0, flex: 1 }}>
          <div style={{ marginTop: 5, flexShrink: 0 }}>
            <StatusDot state={session.state} size={8} />
          </div>
          {editing ? (
            <input
              ref={inputRef}
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitRename();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  cancelRename();
                }
              }}
              maxLength={120}
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--text-primary)',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--accent-blue)',
                borderRadius: 'var(--radius-sm)',
                padding: '2px 8px',
                outline: 'none',
                lineHeight: 1.3,
              }}
            />
          ) : (
            <span
              onDoubleClick={() => setEditing(true)}
              title="Double-click to rename"
              style={{
                fontSize: 14,
                color: 'var(--text-primary)',
                fontWeight: 600,
                lineHeight: 1.3,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                wordBreak: 'break-word',
                cursor: 'text',
                userSelect: 'text',
                WebkitUserSelect: 'text',
              }}
            >
              {session.name}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, userSelect: 'none', WebkitUserSelect: 'none' }}>
          <IconButton
            size="sm"
            onClick={handleAiRename}
            label="Rename with AI"
            disabled={aiLoading}
          >
            {aiLoading ? <Spinner size="sm" /> : <Sparkles size={14} />}
          </IconButton>
          <IconButton
            size="sm"
            onClick={() => setEditing(true)}
            label="Rename session"
          >
            <Pencil size={13} />
          </IconButton>
          <AttachButton processId={session.id} kind="session" />
          <IconButton size="sm" onClick={onToggleDetailPanel} label="Toggle detail panel">
            <PanelBottom size={14} />
          </IconButton>
        </div>
      </div>

      {/* Bottom row — chips */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
        {claudeState?.claudeSessionId && (
          <span
            onClick={handleCopySessionId}
            title="Click to copy session ID"
            style={{
              ...chipStyle,
              cursor: 'pointer',
              maxWidth: 220,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              transition: 'border-color var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLSpanElement).style.borderColor = 'var(--accent-blue)';
              (e.currentTarget as HTMLSpanElement).style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLSpanElement).style.borderColor = 'var(--border)';
              (e.currentTarget as HTMLSpanElement).style.color = 'var(--text-secondary)';
            }}
          >
            {copied ? <Check size={11} /> : <Copy size={11} />}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {claudeState.claudeSessionId}
            </span>
          </span>
        )}
        {(costUsd > 0 || tokenCount > 0) && (
          <span style={chipStyle}>{formatCost(costUsd)}</span>
        )}
        {tokenCount > 0 && (
          <span style={chipStyle}>{formatTokens(tokenCount)} tokens</span>
        )}
      </div>
    </div>
  );
}
