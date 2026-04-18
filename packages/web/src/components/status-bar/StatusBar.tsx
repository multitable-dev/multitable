import React from 'react';
import { useProcess } from '../../hooks/useProcess';
import { useAppStore } from '../../stores/appStore';
import { api } from '../../lib/api';
import { RefreshCw, Square, Play, Pause, Palette, Settings } from 'lucide-react';
import { StatusDot } from '../sidebar/StatusDot';
import { BUILTIN_THEMES } from '../../lib/themes';

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function StatusBar() {
  const {
    selectedProcessId,
    activeThemeId,
    customThemes,
    setActiveTheme,
    setGlobalSettingsOpen,
  } = useAppStore();
  const process = useProcess(selectedProcessId);

  const allThemes = [...BUILTIN_THEMES, ...customThemes];
  const activeTheme = allThemes.find((t) => t.id === activeThemeId) ?? allThemes[0];

  const cycleTheme = () => {
    const idx = allThemes.findIndex((t) => t.id === activeThemeId);
    const next = allThemes[(idx + 1) % allThemes.length];
    setActiveTheme(next.id);
  };

  return (
    <div
      style={{
        height: 36,
        backgroundColor: 'var(--bg-statusbar)',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        flexShrink: 0,
        gap: 8,
      }}
    >
      {process && (
        <>
          <button
            onClick={() => api.processes.start(process.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              fontSize: 12,
              padding: '2px 4px',
            }}
          >
            <Play size={12} /> Focus
          </button>
          <button
            onClick={() => {}}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              fontSize: 12,
              padding: '2px 4px',
            }}
          >
            <Pause size={12} /> Pause
          </button>
          <button
            onClick={() => api.processes.stop(process.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              fontSize: 12,
              padding: '2px 4px',
            }}
          >
            <Square size={12} /> Stop
          </button>
          <button
            onClick={() => api.processes.restart(process.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              fontSize: 12,
              padding: '2px 4px',
            }}
          >
            <RefreshCw size={12} /> Restart
          </button>

          <div style={{ flex: 1 }} />

          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            CPU {process.metrics?.cpuPercent?.toFixed(1) ?? '0.0'}%
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            MEM {formatBytes(process.metrics?.memoryBytes ?? 0)}
          </span>
          <span
            style={{
              fontSize: 12,
              fontFamily: 'monospace',
              color: 'var(--text-primary)',
            }}
          >
            {process.name}
          </span>
          <StatusDot state={process.state} />
          <span
            style={{
              fontSize: 12,
              color: 'var(--text-secondary)',
              textTransform: 'capitalize',
            }}
          >
            {process.state}
          </span>
        </>
      )}
      {!process && (
        <>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>MultiTable</span>
          <div style={{ flex: 1 }} />
        </>
      )}
      <button
        onClick={cycleTheme}
        title={`Theme: ${activeTheme?.name ?? 'Light'} (click to cycle)`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-secondary)',
          fontSize: 12,
          padding: '2px 6px',
          borderRadius: 4,
        }}
      >
        <Palette size={14} />
        {activeTheme?.name ?? 'Light'}
      </button>
      <button
        onClick={() => setGlobalSettingsOpen(true)}
        title="Customize themes"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-secondary)',
          padding: '2px 4px',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <Settings size={14} />
      </button>
    </div>
  );
}
