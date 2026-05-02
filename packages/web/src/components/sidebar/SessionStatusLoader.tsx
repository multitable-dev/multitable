import React from 'react';
import { StatusDot } from './StatusDot';
import { getLoaderComponent } from '../ui/loaders';
import { getProjectColor } from '../../lib/projectColor';
import type { ProcessState } from '../../lib/types';

interface Props {
  loaderVariant?: string | null;
  state: ProcessState;
  projectId: string;
  isIdle?: boolean;
  size?: number;
}

export function SessionStatusLoader({
  loaderVariant,
  state,
  projectId,
  isIdle,
  size = 10,
}: Props) {
  if (state === 'errored') {
    return <StatusDot state={state} isIdle={isIdle} size={size} />;
  }

  const Loader = getLoaderComponent(loaderVariant);
  const color = getProjectColor(projectId, false).stripe;
  const active = state === 'running';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        flexShrink: 0,
      }}
    >
      <Loader
        size={size}
        dotSize={1}
        color={color}
        animated={active}
        className={active ? undefined : 'dmx-static-dim'}
        ariaLabel="Session activity"
      />
    </span>
  );
}
