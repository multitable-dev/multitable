import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useAppStore } from '../../stores/appStore';
import toast from 'react-hot-toast';
import type { GlobalConfig } from '../../lib/types';

interface Props {
  onClose: () => void;
}

export function GlobalSettingsModal({ onClose }: Props) {
  const [config, setConfig] = useState<GlobalConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const setTheme = useAppStore((s) => s.setTheme);

  useEffect(() => {
    api.config.get().then(setConfig).catch(() => {
      toast.error('Failed to load settings');
      onClose();
    });
  }, [onClose]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave();
  };

  const handleSave = async () => {
    if (!config) return;
    setLoading(true);
    try {
      await api.config.update(config);
      toast.success('Settings saved');
      onClose();
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const handleThemeChange = (theme: 'light' | 'dark' | 'system') => {
    if (!config) return;
    setConfig({ ...config, theme });
    setTheme(theme);
  };

  if (!config) return null;

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 13,
    color: 'var(--text-secondary)',
    display: 'block',
    marginBottom: 4,
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text-primary)',
    margin: '0 0 12px',
  };

  const fieldStyle: React.CSSProperties = {
    marginBottom: 16,
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderRadius: 12,
          padding: 32,
          width: '100%',
          maxWidth: 680,
          border: '1px solid var(--border)',
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
      >
        <h2
          style={{
            fontSize: 18,
            fontWeight: 600,
            marginBottom: 24,
            marginTop: 0,
            color: 'var(--text-primary)',
          }}
        >
          Global Settings
        </h2>

        {/* Appearance */}
        <h3 style={sectionTitleStyle}>Appearance</h3>

        <div style={fieldStyle}>
          <label style={labelStyle}>Theme</label>
          <div style={{ display: 'flex', gap: 0, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)', width: 'fit-content' }}>
            {(['light', 'dark', 'system'] as const).map((t) => (
              <button
                key={t}
                onClick={() => handleThemeChange(t)}
                style={{
                  padding: '6px 16px',
                  border: 'none',
                  backgroundColor: config.theme === t ? 'var(--accent-blue)' : 'transparent',
                  color: config.theme === t ? 'white' : 'var(--text-primary)',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Terminal font size</label>
          <input
            type="number"
            min={8}
            max={24}
            value={config.terminalFontSize}
            onChange={(e) => setConfig({ ...config, terminalFontSize: Number(e.target.value) })}
            style={{ ...inputStyle, maxWidth: 120 }}
          />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Terminal scrollback</label>
          <input
            type="number"
            min={1000}
            max={100000}
            value={config.terminalScrollback}
            onChange={(e) => setConfig({ ...config, terminalScrollback: Number(e.target.value) })}
            style={{ ...inputStyle, maxWidth: 180 }}
          />
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '20px 0' }} />

        {/* Behavior */}
        <h3 style={sectionTitleStyle}>Behavior</h3>

        <div style={fieldStyle}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              cursor: 'pointer',
              color: 'var(--text-primary)',
            }}
          >
            <input
              type="checkbox"
              checked={config.notifications}
              onChange={(e) => setConfig({ ...config, notifications: e.target.checked })}
            />
            Enable notifications
          </label>
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Default editor</label>
          <input
            value={config.defaultEditor}
            onChange={(e) => setConfig({ ...config, defaultEditor: e.target.value })}
            placeholder="code"
            style={{ ...inputStyle, maxWidth: 240 }}
          />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Default shell</label>
          <input
            value={config.defaultShell}
            onChange={(e) => setConfig({ ...config, defaultShell: e.target.value })}
            placeholder="auto-detect"
            style={{ ...inputStyle, maxWidth: 240 }}
          />
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '20px 0' }} />

        {/* Network */}
        <h3 style={sectionTitleStyle}>Network</h3>

        <div style={fieldStyle}>
          <label style={labelStyle}>Daemon port</label>
          <input
            type="number"
            value={config.port}
            onChange={(e) => setConfig({ ...config, port: Number(e.target.value) })}
            style={{ ...inputStyle, maxWidth: 120 }}
          />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Bind host</label>
          <input
            value={config.host}
            onChange={(e) => setConfig({ ...config, host: e.target.value })}
            placeholder="127.0.0.1"
            style={{ ...inputStyle, maxWidth: 240 }}
          />
        </div>

        <div
          style={{
            fontSize: 12,
            color: 'var(--text-muted)',
            marginBottom: 20,
          }}
        >
          Restart daemon for network changes to take effect
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              backgroundColor: 'transparent',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: 'none',
              backgroundColor: 'var(--accent-blue)',
              color: 'white',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 500,
              fontSize: 14,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
