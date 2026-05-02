import { useEffect, useMemo, useRef, useState } from 'react';

import { getLoaderComponent } from '../../ui/loaders';
import { getProjectColor } from '../../../lib/projectColor';

interface Props {
  projectId?: string;
  loaderVariant?: string | null;
  /**
   * Whether the agent is currently doing work — turn in flight, streaming,
   * processing tool results, or waiting on a user permission decision. Drives
   * whether the dot-matrix animation runs.
   */
  active?: boolean;
  /**
   * Whether to render the "Thinking…" label and elapsed-seconds counter.
   * Controlled separately from `active` so the label can hide while the
   * assistant is mid-response (the loader stays animated regardless).
   */
  showLabel?: boolean;
}

/**
 * Persistent session activity indicator. The dot-matrix loader is always
 * rendered (one variant per session). It animates whenever `active` is true
 * — agent processing, responding, or waiting on a user permission — and
 * sits static otherwise. The "Thinking…" label and elapsed counter only
 * appear in the in-chat gap where the assistant has yet to produce visible
 * output for this turn.
 */
export function ThinkingIndicator({
  projectId,
  loaderVariant,
  active = false,
  showLabel = false,
}: Props) {
  const [elapsed, setElapsed] = useState(0);
  const [dotCount, setDotCount] = useState(0);
  const startedAtRef = useRef<number>(Date.now());

  // Run the label's animation/timer only while it's visible. Resetting on
  // each visibility transition keeps elapsed accurate per gap, not
  // accumulating across turns where the label briefly hides.
  useEffect(() => {
    if (!showLabel) {
      setElapsed(0);
      setDotCount(0);
      return;
    }
    startedAtRef.current = Date.now();
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
      setDotCount((c) => (c + 1) % 4);
    }, 320);
    return () => window.clearInterval(id);
  }, [showLabel]);

  const Loader = useMemo(() => getLoaderComponent(loaderVariant), [loaderVariant]);
  const color = projectId ? getProjectColor(projectId, false).stripe : '#4169E1';

  const dots = '.'.repeat(dotCount).padEnd(3, ' ');

  return (
    <div
      role="status"
      aria-label={active ? 'Agent is active' : 'Agent is idle'}
      style={{
        margin: '8px 0',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        fontSize: 12.5,
        lineHeight: 1.55,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        color: 'var(--text-secondary)',
      }}
    >
      <Loader
        size={20}
        dotSize={3}
        color={color}
        animated={active}
        // When inactive, apply the .dmx-static-dim class which uses
        // !important to flatten every active dot's opacity to a uniform 0.18
        // and disable any animation. The variant's pattern (which cells are
        // visible vs .dmx-inactive) is preserved so each session keeps its
        // visual identity even when the loader is dormant.
        className={active ? undefined : 'dmx-static-dim'}
        ariaLabel="Session activity"
      />
      {showLabel && (
        <>
          <span>
            Thinking<span style={{ display: 'inline-block', width: '3ch' }}>{dots}</span>
          </span>
          {elapsed > 0 && (
            <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
              {elapsed}s
            </span>
          )}
        </>
      )}
    </div>
  );
}
