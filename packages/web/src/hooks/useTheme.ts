import { useEffect } from 'react';
import { useAppStore } from '../stores/appStore';
import { terminalManager } from '../lib/terminalManager';

export function useTheme() {
  const theme = useAppStore(s => s.theme);

  useEffect(() => {
    const applyTheme = (dark: boolean) => {
      document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
      terminalManager.updateTheme(dark);
    };

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(mq.matches);
      const handler = (e: MediaQueryListEvent) => applyTheme(e.matches);
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    } else {
      applyTheme(theme === 'dark');
    }
  }, [theme]);
}
