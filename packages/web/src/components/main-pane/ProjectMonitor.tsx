import React, { useState } from 'react';
import type { Session, Command, Terminal } from '../../lib/types';
import { useIsDark } from '../../hooks/useIsDark';

type AnyProcess = Session | Command | Terminal;

const SCREEN_BG_LIGHT = '#0f1417';
const SCREEN_BG_DARK = '#060a0c';
const MAX_VISIBLE_WINDOWS = 6;

function truncate(s: string, n: number): string {
  if (!s) return '';
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function basename(p: string): string {
  if (!p) return '~';
  const parts = p.split('/').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : '/';
}

function buildLines(process: AnyProcess): { text: string; dim?: boolean; accent?: string }[] {
  if (process.type === 'session') {
    const s = process as Session;
    const lines: { text: string; dim?: boolean; accent?: string }[] = [
      { text: '$ claude', accent: 'rgba(120, 200, 255, 0.85)' },
    ];
    const label =
      s.claudeState?.label ||
      s.claudeState?.userMessages?.[s.claudeState.userMessages.length - 1] ||
      null;
    lines.push({ text: label ? truncate(label, 22) : '—', dim: !label });

    const tool = s.claudeState?.currentTool;
    if (tool) {
      lines.push({ text: `⏵ ${truncate(tool, 20)}`, accent: 'rgba(255, 200, 120, 0.9)' });
    } else if (process.state === 'running' || process.state === 'idle') {
      lines.push({ text: '⏵ waiting', dim: true });
    }

    const cost = s.claudeState?.costUsd ?? 0;
    const tokens = s.claudeState?.tokenCount ?? 0;
    if (cost > 0 || tokens > 0) {
      const costStr = cost > 0 ? `$${cost.toFixed(2)}` : '';
      const tokStr =
        tokens > 0 ? `${tokens > 1000 ? `${(tokens / 1000).toFixed(1)}k` : tokens}↓` : '';
      lines.push({ text: `${costStr} ${tokStr}`.trim(), dim: true });
    }
    return lines;
  }

  if (process.type === 'command') {
    const lines: { text: string; dim?: boolean; accent?: string }[] = [
      {
        text: `$ ${truncate(process.command || process.name, 20)}`,
        accent: 'rgba(120, 200, 255, 0.85)',
      },
    ];
    const port = process.metrics?.detectedPort;
    if (port) {
      lines.push({ text: `▸ listening :${port}`, accent: 'rgba(130, 230, 160, 0.9)' });
    } else if (process.state === 'running') {
      lines.push({ text: '▸ ready', dim: true });
    }
    const cpu = process.metrics?.cpuPercent ?? 0;
    const memMb = (process.metrics?.memoryBytes ?? 0) / (1024 * 1024);
    if (cpu > 0 || memMb > 0) {
      lines.push({
        text: `${cpu.toFixed(0)}% ${memMb > 0 ? `${memMb.toFixed(0)}MB` : ''}`.trim(),
        dim: true,
      });
    }
    return lines;
  }

  return [
    {
      text: `$ ${truncate(process.command || 'shell', 20)}`,
      accent: 'rgba(120, 200, 255, 0.85)',
    },
    { text: `~ ${truncate(basename(process.workingDir || ''), 20)}`, dim: true },
  ];
}

interface TerminalWindowProps {
  process: AnyProcess;
  onClick?: (e: React.MouseEvent) => void;
}

function TerminalWindow({ process, onClick }: TerminalWindowProps) {
  const [hover, setHover] = useState(false);
  const state = process.state;
  const stopped = state === 'stopped';
  const errored = state === 'errored';
  const running = state === 'running';
  const lines = buildLines(process);

  // Leftmost "traffic light" reflects state; the other two are decorative.
  const stateDot =
    errored ? '#ff5f57' : stopped ? '#8a8a8a' : running ? '#28c940' : '#ffbd2e';

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={process.name}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 4,
        border: `1px solid ${hover ? 'rgba(120, 170, 255, 0.8)' : 'rgba(255,255,255,0.12)'}`,
        background: 'rgba(18, 22, 26, 0.92)',
        overflow: 'hidden',
        cursor: 'pointer',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        minHeight: 78,
        boxShadow: hover
          ? '0 6px 14px rgba(0,0,0,0.5), 0 0 0 1px rgba(120,170,255,0.25)'
          : '0 2px 6px rgba(0,0,0,0.4)',
        transition:
          'border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out)',
        transform: hover ? 'translateY(-1px)' : 'translateY(0)',
        opacity: stopped ? 0.55 : 1,
      }}
    >
      {/* Window titlebar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '3px 6px',
          background: 'linear-gradient(to bottom, rgba(60,66,74,0.95), rgba(40,46,54,0.95))',
          borderBottom: '1px solid rgba(0,0,0,0.4)',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: stateDot,
            boxShadow: running || state === 'idle' ? `0 0 3px ${stateDot}` : 'none',
            flexShrink: 0,
          }}
        />
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#ffbd2e',
            opacity: 0.85,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#28c940',
            opacity: 0.85,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            marginLeft: 4,
            fontSize: 9,
            lineHeight: 1,
            color: 'rgba(220,225,232,0.85)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          }}
        >
          {truncate(process.name, 18)}
        </span>
      </div>

      {/* Window body / terminal content */}
      <div
        style={{
          position: 'relative',
          flex: 1,
          padding: '5px 6px',
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          overflow: 'hidden',
        }}
      >
        {running && (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'repeating-linear-gradient(to bottom, transparent 0 2px, rgba(80,200,120,0.035) 2px 3px)',
              pointerEvents: 'none',
            }}
          />
        )}
        {errored && (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'radial-gradient(circle at center, transparent 40%, rgba(168,70,63,0.32) 100%)',
              pointerEvents: 'none',
            }}
          />
        )}
        {stopped ? (
          <div
            style={{
              margin: 'auto',
              color: '#9aa0a6',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: 9,
              letterSpacing: 0.5,
            }}
          >
            ◼ stopped
          </div>
        ) : (
          <>
            {errored && (
              <div
                style={{
                  color: '#ff8a80',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  fontSize: 9,
                  lineHeight: 1.2,
                }}
              >
                ✗ error
              </div>
            )}
            {lines.map((line, i) => (
              <div
                key={i}
                style={{
                  color: line.accent || (line.dim ? '#7a8691' : '#d7e1ea'),
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  fontSize: 9,
                  lineHeight: 1.25,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {line.text}
                {running && i === lines.length - 1 && (
                  <span
                    aria-hidden
                    style={{
                      display: 'inline-block',
                      width: 4,
                      height: 8,
                      marginLeft: 2,
                      background: '#d7e1ea',
                      verticalAlign: 'middle',
                      animation: 'mt-pulse 1s steps(2) infinite',
                    }}
                  />
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

interface MoreTileProps {
  count: number;
  onClick?: (e: React.MouseEvent) => void;
}

function MoreTile({ count, onClick }: MoreTileProps) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        minHeight: 78,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: `1px dashed ${hover ? 'rgba(120,170,255,0.8)' : 'rgba(255,255,255,0.18)'}`,
        borderRadius: 4,
        background: 'rgba(18,22,26,0.5)',
        color: 'rgba(200,210,220,0.75)',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 11,
        cursor: 'pointer',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        transition: 'border-color var(--dur-fast) var(--ease-out)',
      }}
    >
      +{count} more
    </div>
  );
}

interface Props {
  processes: AnyProcess[];
  onSelectProcess?: (proc: AnyProcess) => void;
  onOpenAll?: () => void;
}

export function ProjectMonitor({ processes, onSelectProcess, onOpenAll }: Props) {
  const dark = useIsDark();
  const screenBg = dark ? SCREEN_BG_DARK : SCREEN_BG_LIGHT;

  const overflow = processes.length > MAX_VISIBLE_WINDOWS;
  const visible = overflow ? processes.slice(0, MAX_VISIBLE_WINDOWS - 1) : processes;
  const overflowCount = overflow ? processes.length - (MAX_VISIBLE_WINDOWS - 1) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Bezel */}
      <div
        style={{
          width: '100%',
          borderRadius: 'var(--radius-md)',
          border: '2px solid var(--border-strong)',
          background: '#1a1d21',
          padding: 4,
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -1px 0 rgba(0,0,0,0.4), var(--shadow-sm)',
        }}
      >
        {/* Screen (desktop) */}
        <div
          style={{
            position: 'relative',
            background: screenBg,
            backgroundImage:
              'radial-gradient(rgba(255,255,255,0.035) 1px, transparent 1px)',
            backgroundSize: '10px 10px',
            borderRadius: 3,
            padding: 8,
            minHeight: 200,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gridAutoRows: 'minmax(78px, auto)',
            gap: 6,
            overflow: 'hidden',
          }}
        >
          {processes.length === 0 ? (
            <div
              style={{
                gridColumn: '1 / -1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(200,210,220,0.5)',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 11,
                letterSpacing: 0.3,
                minHeight: 180,
              }}
            >
              ◌ no sessions
            </div>
          ) : (
            <>
              {visible.map((proc) => (
                <TerminalWindow
                  key={proc.id}
                  process={proc}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectProcess?.(proc);
                  }}
                />
              ))}
              {overflow && (
                <MoreTile
                  count={overflowCount}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenAll?.();
                  }}
                />
              )}
            </>
          )}
        </div>
      </div>
      {/* Stand */}
      <div
        style={{
          width: 44,
          height: 6,
          background: 'var(--border-strong)',
          clipPath: 'polygon(18% 0%, 82% 0%, 100% 100%, 0% 100%)',
        }}
      />
      <div
        style={{
          width: 72,
          height: 3,
          background: 'var(--border-strong)',
          borderRadius: 2,
          marginTop: 1,
        }}
      />
    </div>
  );
}
