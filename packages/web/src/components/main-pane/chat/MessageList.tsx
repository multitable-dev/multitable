import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Message } from '../../../lib/types';
import { UserMessage } from './UserMessage';
import { AssistantMessage } from './AssistantMessage';
import { ToolCallCard } from './ToolCallCard';
import { ThinkingIndicator } from './ThinkingIndicator';

interface Props {
  messages: Message[];
  loading?: boolean;
  emptyHint?: React.ReactNode;
  /** Show an in-flight indicator below the last message (turn is running). */
  thinking?: boolean;
}

function formatCost(tokens: number | undefined, model: string | undefined): string | null {
  if (!tokens || tokens <= 0) return null;
  const out = tokens >= 1000 ? `${(tokens / 1000).toFixed(1)}k` : `${tokens}`;
  return model ? `${out} tokens · ${model}` : `${out} tokens`;
}

// Builds a map from tool_use id → its matching tool_result (if seen). The
// tool_result messages themselves are then hidden from the rendered list.
function indexResults(messages: Message[]) {
  const byUseId = new Map<string, { output: string; isError: boolean }>();
  for (const m of messages) {
    if (m.kind === 'tool_result') {
      byUseId.set(m.toolUseId, { output: m.output, isError: !!m.isError });
    }
  }
  return byUseId;
}

export function MessageList({ messages, loading, emptyHint, thinking }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const resultsByUseId = useMemo(() => indexResults(messages), [messages]);

  // Auto-scroll: only follow if the user is already near the bottom, so we
  // don't yank them away while they're reading history.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (atBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, atBottom]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const threshold = 80;
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      setAtBottom(distance < threshold);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    setAtBottom(true);
  };

  const renderable = messages.filter((m) => m.kind !== 'tool_result');

  // Show the thinking indicator only in the gap where the assistant has
  // nothing on screen yet — i.e., after the user's prompt before the first
  // assistant chunk, or after a completed tool call before the next chunk.
  // While an assistant message is on screen, the indicator hides so the
  // streaming text doesn't render alongside it (which would cause a jolt
  // when the indicator finally unmounts at turn-complete).
  const lastMsg = renderable[renderable.length - 1];
  const showThinking =
    !!thinking &&
    (!lastMsg ||
      lastMsg.kind === 'user' ||
      (lastMsg.kind === 'tool_use' && resultsByUseId.has(lastMsg.toolUseId)));

  return (
    <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
      <div
        ref={scrollRef}
        className="mt-scroll"
        style={{
          position: 'absolute',
          inset: 0,
          overflowY: 'auto',
          padding: '12px 14px 16px',
        }}
      >
        {renderable.length === 0 && !loading && emptyHint}
        {renderable.map((m) => {
          if (m.kind === 'user') return <UserMessage key={m.id} text={m.text} />;
          if (m.kind === 'assistant') {
            if (!m.text) return null;
            const usage = m.usage;
            const tokens = usage
              ? (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0)
              : 0;
            const costLabel = formatCost(tokens, m.model);
            return <AssistantMessage key={m.id} text={m.text} costLabel={costLabel} />;
          }
          if (m.kind === 'tool_use') {
            const result = resultsByUseId.get(m.toolUseId);
            return (
              <ToolCallCard
                key={m.id}
                toolName={m.toolName}
                input={m.input}
                output={result?.output ?? null}
                isError={!!result?.isError}
                pending={!result}
              />
            );
          }
          if (m.kind === 'system') {
            return (
              <div
                key={m.id}
                style={{
                  margin: '8px 0',
                  fontSize: 11.5,
                  color: 'var(--text-muted)',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  whiteSpace: 'pre-wrap',
                  opacity: 0.75,
                }}
              >
                {m.text}
              </div>
            );
          }
          return null;
        })}
        {loading && renderable.length === 0 && (
          <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: 20, textAlign: 'center' }}>
            Loading conversation…
          </div>
        )}
        {showThinking && <ThinkingIndicator />}
      </div>

      {!atBottom && renderable.length > 0 && (
        <button
          onClick={scrollToBottom}
          style={{
            position: 'absolute',
            bottom: 14,
            right: 16,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 10px',
            fontSize: 10.5,
            borderRadius: 0,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--accent-amber)',
            color: 'var(--accent-amber)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          <ChevronDown size={11} /> Jump to latest
        </button>
      )}
    </div>
  );
}
