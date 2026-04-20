import { useEffect, useMemo } from 'react';
import { useAppStore } from '../stores/appStore';
import { terminalManager } from '../lib/terminalManager';
import { BUILTIN_THEMES, BUILTIN_DARK, applyThemeToDocument } from '../lib/themes';

export function useTheme() {
  const activeThemeId = useAppStore((s) => s.activeThemeId);
  const customThemes = useAppStore((s) => s.customThemes);

  const activeTheme = useMemo(() => {
    const all = [...BUILTIN_THEMES, ...customThemes];
    return all.find((t) => t.id === activeThemeId) ?? BUILTIN_DARK;
  }, [activeThemeId, customThemes]);

  useEffect(() => {
    applyThemeToDocument(activeTheme);
    terminalManager.updateThemeColors({
      background: activeTheme.colors.bgPrimary,
      foreground: activeTheme.colors.textPrimary,
      cursor: activeTheme.colors.textPrimary,
    });
  }, [activeTheme]);
}
