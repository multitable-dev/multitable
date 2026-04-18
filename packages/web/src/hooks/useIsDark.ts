import { useAppStore } from '../stores/appStore';
import { BUILTIN_THEMES, BUILTIN_LIGHT } from '../lib/themes';

export function useIsDark(): boolean {
  const activeThemeId = useAppStore((s) => s.activeThemeId);
  const customThemes = useAppStore((s) => s.customThemes);
  const all = [...BUILTIN_THEMES, ...customThemes];
  const theme = all.find((t) => t.id === activeThemeId) ?? BUILTIN_LIGHT;
  return theme.isDark;
}
