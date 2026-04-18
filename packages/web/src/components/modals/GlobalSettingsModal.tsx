import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useAppStore } from '../../stores/appStore';
import toast from 'react-hot-toast';
import type { GlobalConfig } from '../../lib/types';
import type { Theme, ThemeColors } from '../../lib/themes';
import {
  BUILTIN_THEMES,
  BUILTIN_LIGHT,
  BUILTIN_DARK,
  THEME_COLOR_KEYS,
  cloneTheme,
} from '../../lib/themes';
import { Check, Copy, Pencil, Trash2, Plus } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export function GlobalSettingsModal({ onClose }: Props) {
  const [config, setConfig] = useState<GlobalConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const {
    activeThemeId,
    customThemes,
    setActiveTheme,
    addCustomTheme,
    updateCustomTheme,
    deleteCustomTheme,
  } = useAppStore();
  const [editingThemeId, setEditingThemeId] = useState<string | null>(null);

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

  const allThemes: Theme[] = [...BUILTIN_THEMES, ...customThemes];
  const editingTheme = customThemes.find((t) => t.id === editingThemeId) ?? null;

  const handleNewTheme = (baseDark: boolean) => {
    const base = baseDark ? BUILTIN_DARK : BUILTIN_LIGHT;
    const name = prompt('Name for new theme:', `${base.name} Custom`);
    if (!name) return;
    const theme = cloneTheme(base, name.trim());
    addCustomTheme(theme);
    setEditingThemeId(theme.id);
    setActiveTheme(theme.id);
  };

  const handleDuplicate = (src: Theme) => {
    const name = prompt('Name for duplicated theme:', `${src.name} Copy`);
    if (!name) return;
    const theme = cloneTheme(src, name.trim());
    addCustomTheme(theme);
    setEditingThemeId(theme.id);
  };

  const handleDelete = (id: string) => {
    const t = customThemes.find((x) => x.id === id);
    if (!t) return;
    if (!confirm(`Delete theme "${t.name}"?`)) return;
    deleteCustomTheme(id);
    if (editingThemeId === id) setEditingThemeId(null);
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

  const iconButtonStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    padding: 4,
    display: 'flex',
    alignItems: 'center',
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
          maxHeight: '85vh',
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

        {/* Appearance / Themes */}
        <h3 style={sectionTitleStyle}>Themes</h3>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
          Pick a default theme, or create your own. Custom themes are saved to this
          browser.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {allThemes.map((t) => {
            const isActive = activeThemeId === t.id;
            const isCustom = !t.builtIn;
            return (
              <div
                key={t.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 10px',
                  border: `1px solid ${isActive ? 'var(--accent-blue)' : 'var(--border)'}`,
                  borderRadius: 6,
                  backgroundColor: isActive ? 'var(--bg-hover)' : 'transparent',
                }}
              >
                <button
                  onClick={() => setActiveTheme(t.id)}
                  title={isActive ? 'Active theme' : 'Set as default'}
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    border: '2px solid var(--accent-blue)',
                    background: isActive ? 'var(--accent-blue)' : 'transparent',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {isActive && <Check size={12} color="white" />}
                </button>
                <span
                  style={{
                    flex: 1,
                    fontSize: 14,
                    color: 'var(--text-primary)',
                    fontWeight: isActive ? 500 : 400,
                  }}
                >
                  {t.name}
                  {t.builtIn && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>
                      built-in
                    </span>
                  )}
                </span>
                <div style={{ display: 'flex', gap: 4, marginRight: 6 }}>
                  {(
                    [
                      t.colors.bgPrimary,
                      t.colors.bgSidebar,
                      t.colors.textPrimary,
                      t.colors.accentBlue,
                      t.colors.statusRunning,
                      t.colors.statusError,
                    ] as string[]
                  ).map((c, i) => (
                    <span
                      key={i}
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 3,
                        backgroundColor: c,
                        border: '1px solid var(--border)',
                      }}
                    />
                  ))}
                </div>
                {isCustom && (
                  <button
                    onClick={() =>
                      setEditingThemeId(editingThemeId === t.id ? null : t.id)
                    }
                    title="Edit"
                    style={iconButtonStyle}
                  >
                    <Pencil size={14} />
                  </button>
                )}
                <button
                  onClick={() => handleDuplicate(t)}
                  title="Duplicate"
                  style={iconButtonStyle}
                >
                  <Copy size={14} />
                </button>
                {isCustom && (
                  <button
                    onClick={() => handleDelete(t.id)}
                    title="Delete"
                    style={{ ...iconButtonStyle, color: 'var(--status-error)' }}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button
            onClick={() => handleNewTheme(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              backgroundColor: 'transparent',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            <Plus size={12} /> New from Light
          </button>
          <button
            onClick={() => handleNewTheme(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              backgroundColor: 'transparent',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            <Plus size={12} /> New from Dark
          </button>
        </div>

        {editingTheme && (
          <ThemeEditor
            theme={editingTheme}
            onChange={(patch) => updateCustomTheme(editingTheme.id, patch)}
            onClose={() => setEditingThemeId(null)}
          />
        )}

        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '20px 0' }} />

        {/* Appearance (non-theme) */}
        <h3 style={sectionTitleStyle}>Appearance</h3>

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

interface EditorProps {
  theme: Theme;
  onChange: (patch: { name?: string; colors?: Partial<ThemeColors>; isDark?: boolean }) => void;
  onClose: () => void;
}

function ThemeEditor({ theme, onChange, onClose }: EditorProps) {
  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: 16,
        marginBottom: 16,
        backgroundColor: 'var(--bg-sidebar)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Name</span>
        <input
          value={theme.name}
          onChange={(e) => onChange({ name: e.target.value })}
          style={{
            flex: 1,
            padding: '6px 10px',
            borderRadius: 4,
            border: '1px solid var(--border)',
            backgroundColor: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            fontSize: 13,
            outline: 'none',
          }}
        />
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            color: 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={theme.isDark}
            onChange={(e) => onChange({ isDark: e.target.checked })}
          />
          Dark mode
        </label>
        <button
          onClick={onClose}
          style={{
            padding: '4px 10px',
            borderRadius: 4,
            border: '1px solid var(--border)',
            backgroundColor: 'transparent',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          Done
        </button>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 8,
        }}
      >
        {THEME_COLOR_KEYS.map(({ key, label }) => (
          <label
            key={key}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              color: 'var(--text-secondary)',
            }}
          >
            <input
              type="color"
              value={theme.colors[key]}
              onChange={(e) => onChange({ colors: { [key]: e.target.value } as Partial<ThemeColors> })}
              style={{
                width: 32,
                height: 26,
                border: '1px solid var(--border)',
                borderRadius: 4,
                padding: 0,
                background: 'none',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            />
            <span style={{ flex: 1 }}>{label}</span>
            <input
              value={theme.colors[key]}
              onChange={(e) => onChange({ colors: { [key]: e.target.value } as Partial<ThemeColors> })}
              style={{
                width: 76,
                padding: '2px 6px',
                borderRadius: 3,
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: 11,
                fontFamily: 'monospace',
                outline: 'none',
              }}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
