import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Message, Session } from '../../../lib/types';
import { useAppStore } from '../../../stores/appStore';
import { wsClient } from '../../../lib/ws';
import { api } from '../../../lib/api';
import { SessionHeaderBar } from '../SessionHeaderBar';
import { SessionDetailPanel } from '../SessionDetailPanel';
import { ProcessBanner } from '../ProcessBanner';
import { PermissionBar } from '../../permission/PermissionBar';
import { MessageList } from './MessageList';
import { ChatInputCM } from './ChatInputCM';

// Stable empty-array reference so the selector below doesn't hand a fresh
// [] to Zustand on every unrelated store update — without this, every metrics
// tick re-renders the chat tree.
const EMPTY_MESSAGES: Message[] = [];

interface Props {
  sessionId: string;
  session: Session;
}

export function SessionChat({ sessionId, session }: Props) {
  const messages = useAppStore((s) => s.messagesBySession[sessionId] ?? EMPTY_MESSAGES);
  const mergeMessages = useAppStore((s) => s.mergeMessages);
  const clearMessages = useAppStore((s) => s.clearMessages);
  const detailPanelOpen = useAppStore((s) => s.detailPanelOpen);
  const setDetailPanelOpen = useAppStore((s) => s.setDetailPanelOpen);

  const [loading, setLoading] = useState(false);
  const claudeSessionId = session.claudeSessionId ?? session.claudeState?.claudeSessionId ?? null;
  const lastLoadedKeyRef = useRef<string | null>(null);
  const subscribedIdRef = useRef<string | null>(null);

  // Load + refresh the transcript whenever the session id or the linked
  // Claude session id changes. Resets scroll state by replacing, not
  // appending — ensures stale messages don't linger after "Start New".
  useEffect(() => {
    const key = `${sessionId}:${claudeSessionId ?? ''}`;
    if (lastLoadedKeyRef.current === key) return;
    lastLoadedKeyRef.current = key;

    if (!claudeSessionId) {
      clearMessages(sessionId);
      return;
    }
    setLoading(true);
    api.sessions
      .messages(sessionId)
      .then((res) => {
        // Merge (not replace) so any deltas accumulated via WS broadcast while
        // the user was on a different session aren't clobbered by a slightly
        // stale JSONL fetch.
        mergeMessages(sessionId, res.messages);
      })
      .catch(() => {
        // Empty transcript is valid; errors are silent.
      })
      .finally(() => setLoading(false));
  }, [sessionId, claudeSessionId, mergeMessages, clearMessages]);

  // Subscribe the WS client so we receive session events (assistant-message,
  // tool-event, user-message, etc.). Sessions have no PTY, so no dims are
  // sent — the daemon routes session subscriptions to AgentSessionManager.
  useEffect(() => {
    if (subscribedIdRef.current === sessionId) return;
    if (subscribedIdRef.current) {
      wsClient.unsubscribe(subscribedIdRef.current);
    }
    wsClient.subscribe(sessionId);
    subscribedIdRef.current = sessionId;
    return () => {
      if (subscribedIdRef.current === sessionId) {
        wsClient.unsubscribe(sessionId);
        subscribedIdRef.current = null;
      }
    };
  }, [sessionId]);

  // When the WS reconnects, re-fetch messages (server may have missed tails
  // during the outage).
  useEffect(() => {
    const off = wsClient.on('ws:reconnected', () => {
      if (!claudeSessionId) return;
      api.sessions
        .messages(sessionId)
        .then((res) => mergeMessages(sessionId, res.messages))
        .catch(() => {});
    });
    return off;
  }, [sessionId, claudeSessionId, mergeMessages]);

  // When a new claudeSessionId is assigned mid-session (SessionStart), we
  // may already have some deltas in the store — keep them but also refetch
  // the initial history to be safe. Handled by the key-based effect above.
  // (No extra wiring needed here — claudeSessionId change retriggers load.)

  // Sessions sit in 'stopped' until the first turn fires; that's the normal
  // ready state, no banner needed. Only surface the banner on actual error.
  const showBanner = session.state === 'errored';
  const showDetailPanel = detailPanelOpen;

  // Memoized so MessageList can bail out of re-rendering when the empty
  // state text doesn't actually change.
  const emptyHint = useMemo(
    () => (
      <div
        style={{
          color: 'var(--text-muted)',
          fontSize: 12.5,
          padding: '40px 20px',
          textAlign: 'center',
          lineHeight: 1.5,
        }}
      >
        {claudeSessionId ? (
          <>No messages yet. The conversation will appear here as Claude responds.</>
        ) : (
          <>Type a message below to start the conversation.</>
        )}
      </div>
    ),
    [claudeSessionId, session.state]
  );

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <SessionHeaderBar
        session={session}
        onToggleDetailPanel={() => setDetailPanelOpen(!detailPanelOpen)}
      />

      {showBanner && <ProcessBanner process={session} />}

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minHeight: 0,
          backgroundColor: 'var(--bg-primary)',
        }}
      >
        <div
          style={{
            flex: showDetailPanel ? '1 1 60%' : '1',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            minHeight: 0,
            position: 'relative',
          }}
        >
          <MessageList messages={messages} loading={loading} emptyHint={emptyHint} />
          <ChatInputCM
            processId={sessionId}
            projectId={session.projectId}
            state={session.state}
            attachmentKind="session"
          />
          <PermissionBar sessionId={sessionId} />
        </div>

        {showDetailPanel && (
          <div
            style={{
              flex: '0 0 40%',
              minHeight: 120,
              maxHeight: '60%',
              overflow: 'hidden',
              borderTop: '1px solid var(--border)',
              backgroundColor: 'var(--bg-primary)',
            }}
          >
            <SessionDetailPanel key={session.id} session={session} projectId={session.projectId} />
          </div>
        )}
      </div>
    </div>
  );
}
