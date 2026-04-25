import React from 'react';
import { useProcess } from '../../hooks/useProcess';
import { useAppStore } from '../../stores/appStore';
import { api } from '../../lib/api';
import { Square, Palette, Settings, Bell } from 'lucide-react';
import { StatusDot } from '../sidebar/StatusDot';
import { BUILTIN_THEMES } from '../../lib/themes';
import { IconButton } from '../ui';

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const chipStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '2px 8px',
  height: 20,
  fontSize: 11,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  color: 'var(--text-secondary)',
  backgroundColor: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-pill)',
  lineHeight: 1,
  fontVariantNumeric: 'tabular-nums',
};

export function StatusBar() {
  const {
    selectedProcessId,
    activeThemeId,
    customThemes,
    setActiveTheme,
    setGlobalSettingsOpen,
    setNotificationCenterOpen,
  } = useAppStore();
  const process = useProcess(selectedProcessId);
  const totalUnread = useAppStore((s) =>
    Object.values(s.unreadBySession).reduce((n, v) => n + v, 0),
  );
  const totalAlerts = useAppStore((s) => s.alerts.length);

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
        padding: '0 10px',
        flexShrink: 0,
        gap: 8,
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      {process && (
        <>
          {process.state === 'running' && (
            <IconButton
              size="sm"
              variant="danger"
              label="Stop process"
              onClick={() => api.processes.stop(process.id)}
            >
              <Square size={12} />
            </IconButton>
          )}

          <div style={{ flex: 1 }} />

          <span style={chipStyle}>
            CPU {process.metrics?.cpuPercent?.toFixed(1) ?? '0.0'}%
          </span>
          <span style={chipStyle}>
            MEM {formatBytes(process.metrics?.memoryBytes ?? 0)}
          </span>
          <span
            style={{
              fontSize: 12,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
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
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>MultiTable</span>
          <div style={{ flex: 1 }} />
        </>
      )}
      <button
        onClick={cycleTheme}
        title={`Theme: ${activeTheme?.name ?? 'Light'} (click to cycle)`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'transparent',
          border: '1px solid transparent',
          cursor: 'pointer',
          color: 'var(--text-secondary)',
          fontSize: 12,
          padding: '2px 8px',
          height: 22,
          borderRadius: 'var(--radius-md)',
          transition: 'background-color var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out)',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--bg-hover)';
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)';
        }}
      >
        <Palette size={13} />
        {activeTheme?.name ?? 'Light'}
      </button>
      <button
        onClick={() => setNotificationCenterOpen(true)}
        title={
          totalUnread > 0
            ? `${totalUnread} unread alert${totalUnread === 1 ? '' : 's'}`
            : totalAlerts > 0
              ? `${totalAlerts} notification${totalAlerts === 1 ? '' : 's'} in history`
              : 'No notifications'
        }
        style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 26,
          height: 22,
          background: 'transparent',
          border: '1px solid transparent',
          borderRadius: 'var(--radius-md)',
          cursor: 'pointer',
          color: totalUnread > 0 ? 'var(--accent)' : 'var(--text-secondary)',
          padding: 0,
          transition: 'background-color var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out)',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--bg-hover)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
        }}
      >
        <Bell size={13} />
        {totalUnread > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -2,
              right: -2,
              minWidth: 14,
              height: 14,
              padding: '0 3px',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--accent)',
              color: 'white',
              fontSize: 9,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
      </button>
      <IconButton size="sm" onClick={() => setGlobalSettingsOpen(true)} label="Customize themes">
        <Settings size={13} />
      </IconButton>
    </div>
  );
}
