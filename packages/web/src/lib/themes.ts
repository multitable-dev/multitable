export interface ThemeColors {
  bgPrimary: string;
  bgSidebar: string;
  bgStatusbar: string;
  bgElevated: string;
  bgOverlay: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderStrong: string;
  accentBlue: string;
  statusRunning: string;
  statusIdle: string;
  statusWarning: string;
  statusError: string;
  statusStopped: string;
  bgHover: string;
  selectionBorder: string;
}

export interface Theme {
  id: string;
  name: string;
  isDark: boolean;
  builtIn?: boolean;
  colors: ThemeColors;
}

export const THEME_COLOR_KEYS: Array<{
  key: keyof ThemeColors;
  label: string;
  cssVar: string;
}> = [
  { key: 'bgPrimary', label: 'Background', cssVar: '--bg-primary' },
  { key: 'bgSidebar', label: 'Sidebar background', cssVar: '--bg-sidebar' },
  { key: 'bgStatusbar', label: 'Status bar background', cssVar: '--bg-statusbar' },
  { key: 'bgElevated', label: 'Elevated surface', cssVar: '--bg-elevated' },
  { key: 'bgOverlay', label: 'Modal overlay', cssVar: '--bg-overlay' },
  { key: 'bgHover', label: 'Hover background', cssVar: '--bg-hover' },
  { key: 'textPrimary', label: 'Primary text', cssVar: '--text-primary' },
  { key: 'textSecondary', label: 'Secondary text', cssVar: '--text-secondary' },
  { key: 'textMuted', label: 'Muted text', cssVar: '--text-muted' },
  { key: 'border', label: 'Border', cssVar: '--border' },
  { key: 'borderStrong', label: 'Strong border', cssVar: '--border-strong' },
  { key: 'accentBlue', label: 'Accent', cssVar: '--accent-blue' },
  { key: 'selectionBorder', label: 'Selection border', cssVar: '--selection-border' },
  { key: 'statusRunning', label: 'Running', cssVar: '--status-running' },
  { key: 'statusIdle', label: 'Idle', cssVar: '--status-idle' },
  { key: 'statusWarning', label: 'Warning', cssVar: '--status-warning' },
  { key: 'statusError', label: 'Error', cssVar: '--status-error' },
  { key: 'statusStopped', label: 'Stopped', cssVar: '--status-stopped' },
];

export const BUILTIN_LIGHT: Theme = {
  id: 'builtin-light',
  name: 'Light',
  isDark: false,
  builtIn: true,
  colors: {
    bgPrimary: '#d9d2bf',
    bgSidebar: '#cfc7b2',
    bgStatusbar: '#c5bca5',
    bgElevated: '#e4ddcb',
    bgOverlay: 'rgba(90, 80, 60, 0.45)',
    bgHover: '#c7beaa',
    textPrimary: '#3d3830',
    textSecondary: '#6b6457',
    textMuted: '#8f887a',
    border: '#b3a993',
    borderStrong: '#9a8f77',
    accentBlue: '#3f6aa8',
    selectionBorder: '#3f6aa8',
    statusRunning: '#3e8450',
    statusIdle: '#3e8450',
    statusWarning: '#b57a2c',
    statusError: '#a8463f',
    statusStopped: '#8f887a',
  },
};

export const BUILTIN_DARK: Theme = {
  id: 'builtin-dark',
  name: 'Dark',
  isDark: true,
  builtIn: true,
  colors: {
    bgPrimary: '#1a1a1a',
    bgSidebar: '#141414',
    bgStatusbar: '#1e1e1e',
    bgElevated: '#202020',
    bgOverlay: 'rgba(0, 0, 0, 0.55)',
    bgHover: '#2a2a2a',
    textPrimary: '#e5e5e5',
    textSecondary: '#9ca3af',
    textMuted: '#6b7280',
    border: '#2e2e2e',
    borderStrong: '#3d3d3d',
    accentBlue: '#60a5fa',
    selectionBorder: '#60a5fa',
    statusRunning: '#22c55e',
    statusIdle: '#22c55e',
    statusWarning: '#f59e0b',
    statusError: '#ef4444',
    statusStopped: '#6b7280',
  },
};

export const BUILTIN_THEMES: Theme[] = [BUILTIN_LIGHT, BUILTIN_DARK];

/**
 * Backfill missing keys on older custom themes loaded from localStorage so
 * legacy saves still render correctly after new tokens land. Missing keys
 * inherit from the appropriate built-in (dark or light).
 */
function withDefaults(colors: Partial<ThemeColors>, isDark: boolean): ThemeColors {
  const base = isDark ? BUILTIN_DARK.colors : BUILTIN_LIGHT.colors;
  return { ...base, ...colors } as ThemeColors;
}

export function applyThemeToDocument(theme: Theme) {
  const root = document.documentElement;
  const filled = withDefaults(theme.colors, theme.isDark);
  for (const { key, cssVar } of THEME_COLOR_KEYS) {
    root.style.setProperty(cssVar, filled[key]);
  }
  root.setAttribute('data-theme', theme.isDark ? 'dark' : 'light');
}

export function cloneTheme(base: Theme, name: string): Theme {
  return {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    isDark: base.isDark,
    colors: { ...base.colors },
  };
}

export function loadCustomThemesFromStorage(): Theme[] {
  try {
    const raw = localStorage.getItem('mt:customThemes');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (t): t is Theme =>
          !!t &&
          typeof t.id === 'string' &&
          typeof t.name === 'string' &&
          typeof t.isDark === 'boolean' &&
          !!t.colors &&
          typeof t.colors === 'object'
      )
      .map((t) => ({ ...t, colors: withDefaults(t.colors, t.isDark) }));
  } catch {
    return [];
  }
}

export function saveCustomThemesToStorage(themes: Theme[]) {
  try {
    localStorage.setItem('mt:customThemes', JSON.stringify(themes));
  } catch {
    /* ignore */
  }
}

export function loadActiveThemeIdFromStorage(): string | null {
  try {
    return localStorage.getItem('mt:activeThemeId');
  } catch {
    return null;
  }
}

export function saveActiveThemeIdToStorage(id: string) {
  try {
    localStorage.setItem('mt:activeThemeId', id);
  } catch {
    /* ignore */
  }
}
