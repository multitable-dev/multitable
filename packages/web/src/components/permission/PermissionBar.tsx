import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../stores/appStore';
import { wsClient } from '../../lib/ws';
import type { PermissionPrompt } from '../../lib/types';
import { Button } from '../ui';

function PermissionCard({ prompt }: { prompt: PermissionPrompt }) {
  const removePermission = useAppStore(s => s.removePermission);
  const [elapsed, setElapsed] = useState(0);
  const timeoutSecs = prompt.timeoutMs / 1000;

  useEffect(() => {
    const interval = setInterval(() => {
      const spent = (Date.now() - prompt.createdAt) / 1000;
      setElapsed(Math.min(spent, timeoutSecs));
    }, 100);
    return () => clearInterval(interval);
  }, [prompt.createdAt, timeoutSecs]);

  const progress = 1 - elapsed / timeoutSecs;

  const respond = (decision: 'allow' | 'deny' | 'always-allow') => {
    wsClient.respondPermission(prompt.id, decision);
    removePermission(prompt.id);
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: 14,
        marginBottom: 8,
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10, gap: 8, userSelect: 'none', WebkitUserSelect: 'none' }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
          {prompt.toolName}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }}>
          from {prompt.sessionId}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
          {Math.ceil(timeoutSecs - elapsed)}s
        </span>
      </div>
      {/* Countdown bar */}
      <div
        style={{
          height: 3,
          backgroundColor: 'var(--border)',
          borderRadius: 'var(--radius-pill)',
          marginBottom: 10,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            backgroundColor: 'var(--accent-blue)',
            borderRadius: 'var(--radius-pill)',
            width: `${progress * 100}%`,
            boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.35)',
            transition: 'width 0.1s linear',
          }}
        />
      </div>
      <pre
        className="mt-scroll"
        style={{
          fontSize: 11,
          color: 'var(--text-secondary)',
          margin: '0 0 10px',
          overflow: 'auto',
          maxHeight: 90,
          padding: '8px 10px',
          backgroundColor: 'color-mix(in srgb, var(--bg-sidebar) 60%, transparent)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        }}
      >
        {JSON.stringify(prompt.toolInput, null, 2)}
      </pre>
      <div style={{ display: 'flex', gap: 6 }}>
        <Button size="sm" variant="primary" onClick={() => respond('allow')}>
          Allow
        </Button>
        <Button size="sm" variant="ghost" onClick={() => respond('always-allow')}>
          Always Allow
        </Button>
        <div style={{ flex: 1 }} />
        <Button size="sm" variant="danger" onClick={() => respond('deny')}>
          Deny
        </Button>
      </div>
    </div>
  );
}

const HEX_RE = /#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/;

/**
 * Compact preview renderer. Detects lines that contain a hex color and
 * renders a color swatch; falls back to plain monospace for other text.
 */
function Preview({ text }: { text: string }) {
  const lines = text.split('\n');
  const anyHex = lines.some(l => HEX_RE.test(l));

  if (!anyHex) {
    return (
      <pre
        className="mt-scroll"
        style={{
          fontSize: 10,
          color: 'var(--text-muted)',
          margin: '6px 0 0',
          padding: '6px 8px',
          backgroundColor: 'color-mix(in srgb, var(--bg-sidebar) 60%, transparent)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          whiteSpace: 'pre',
          overflow: 'auto',
          maxHeight: 80,
        }}
      >
        {text}
      </pre>
    );
  }

  // Palette preview: collect hex colors and render as a swatch strip.
  const swatches: Array<{ hex: string; label: string }> = [];
  for (const line of lines) {
    const m = line.match(HEX_RE);
    if (!m) continue;
    const hex = m[0];
    const label = line.split(':')[0]?.trim() || '';
    swatches.push({ hex, label });
  }

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 4,
        marginTop: 6,
        padding: 6,
        backgroundColor: 'color-mix(in srgb, var(--bg-sidebar) 60%, transparent)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
      }}
    >
      {swatches.map((s, i) => (
        <div
          key={i}
          title={`${s.label}: ${s.hex}`}
          style={{
            width: 18,
            height: 18,
            borderRadius: 3,
            backgroundColor: s.hex,
            border: '1px solid color-mix(in srgb, var(--text-primary) 20%, transparent)',
            flexShrink: 0,
          }}
        />
      ))}
    </div>
  );
}

function AskQuestionCard({ prompt }: { prompt: PermissionPrompt }) {
  const removePermission = useAppStore(s => s.removePermission);
  const questions = prompt.questions ?? [];
  const [elapsed, setElapsed] = useState(0);
  const timeoutSecs = prompt.timeoutMs / 1000;

  // selections[i] = array of chosen labels for question i
  const [selections, setSelections] = useState<string[][]>(() =>
    questions.map(() => [])
  );

  useEffect(() => {
    const interval = setInterval(() => {
      const spent = (Date.now() - prompt.createdAt) / 1000;
      setElapsed(Math.min(spent, timeoutSecs));
    }, 100);
    return () => clearInterval(interval);
  }, [prompt.createdAt, timeoutSecs]);

  const progress = 1 - elapsed / timeoutSecs;

  const toggle = (qIdx: number, label: string, multi: boolean) => {
    setSelections(prev => {
      const next = prev.map(arr => arr.slice());
      const cur = next[qIdx] || [];
      if (multi) {
        next[qIdx] = cur.includes(label) ? cur.filter(l => l !== label) : [...cur, label];
      } else {
        next[qIdx] = cur.includes(label) ? [] : [label];
      }
      return next;
    });
  };

  const allAnswered = questions.every((_, i) => (selections[i]?.length ?? 0) > 0);

  const submit = () => {
    wsClient.answerQuestion(prompt.id, selections);
    removePermission(prompt.id);
  };

  const skip = () => {
    wsClient.answerQuestion(prompt.id, questions.map(() => []));
    removePermission(prompt.id);
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: 14,
        marginBottom: 8,
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10, gap: 8, userSelect: 'none', WebkitUserSelect: 'none' }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
          Question
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }}>
          from {prompt.sessionId}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
          {Math.ceil(timeoutSecs - elapsed)}s
        </span>
      </div>
      <div
        style={{
          height: 3,
          backgroundColor: 'var(--border)',
          borderRadius: 'var(--radius-pill)',
          marginBottom: 12,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            backgroundColor: 'var(--accent-blue)',
            borderRadius: 'var(--radius-pill)',
            width: `${progress * 100}%`,
            boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.35)',
            transition: 'width 0.1s linear',
          }}
        />
      </div>

      {questions.map((q, qIdx) => {
        const multi = !!q.multiSelect;
        const picked = selections[qIdx] ?? [];
        return (
          <div key={qIdx} style={{ marginBottom: qIdx < questions.length - 1 ? 16 : 8 }}>
            {q.header && (
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                {q.header}
              </div>
            )}
            <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 10, fontWeight: 500 }}>
              {q.question}
              {multi && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}>(select multiple)</span>}
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 6,
              }}
            >
              {q.options.map((opt, oIdx) => {
                const selected = picked.includes(opt.label);
                return (
                  <label
                    key={oIdx}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                      padding: 8,
                      border: `1px solid ${selected ? 'var(--accent-blue)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: selected ? 'color-mix(in srgb, var(--accent-blue) 10%, transparent)' : 'transparent',
                      cursor: 'pointer',
                      transition: 'background-color 0.12s, border-color 0.12s',
                    }}
                  >
                    <input
                      type={multi ? 'checkbox' : 'radio'}
                      name={`q-${prompt.id}-${qIdx}`}
                      checked={selected}
                      onChange={() => toggle(qIdx, opt.label, multi)}
                      style={{ marginTop: 2, flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>
                        {opt.label}
                      </div>
                      {opt.description && (
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.35 }}>
                          {opt.description}
                        </div>
                      )}
                      {opt.preview && <Preview text={opt.preview} />}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}

      <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
        <Button size="sm" variant="primary" onClick={submit} disabled={!allAnswered}>
          Submit answer
        </Button>
        <div style={{ flex: 1 }} />
        <Button size="sm" variant="ghost" onClick={skip}>
          Skip
        </Button>
      </div>
    </div>
  );
}

interface PermissionBarProps {
  sessionId?: string;
}

export function PermissionBar({ sessionId }: PermissionBarProps = {}) {
  const pendingPermissions = useAppStore(s => s.pendingPermissions);
  const filtered = sessionId
    ? pendingPermissions.filter(p => p.sessionId === sessionId)
    : pendingPermissions;
  if (filtered.length === 0) return null;
  return (
    <div
      className="mt-scroll"
      style={{
        position: 'absolute',
        left: 12,
        right: 12,
        bottom: 12,
        padding: 12,
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--border)',
        backgroundColor: 'color-mix(in srgb, var(--bg-statusbar) 95%, transparent)',
        backdropFilter: 'blur(12px) saturate(1.1)',
        WebkitBackdropFilter: 'blur(12px) saturate(1.1)',
        boxShadow: 'var(--shadow-lg)',
        zIndex: 10,
        maxHeight: '60%',
        overflowY: 'auto',
        animation: 'mt-slide-up var(--dur-med) var(--ease-out)',
      }}
    >
      {filtered.map(prompt =>
        prompt.kind === 'ask-question' ? (
          <AskQuestionCard key={prompt.id} prompt={prompt} />
        ) : (
          <PermissionCard key={prompt.id} prompt={prompt} />
        )
      )}
    </div>
  );
}
