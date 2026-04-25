import type { Highlighter } from 'shiki';

// Lazy singleton highlighter. Shiki bundles WASM and a chunky theme JSON, so
// we hold one instance process-wide and only load the languages we need.
let highlighterPromise: Promise<Highlighter> | null = null;

// Languages covered; extend as needed. The highlighter falls back to plain
// rendering for anything unknown.
const LANGS = [
  'ts',
  'tsx',
  'js',
  'jsx',
  'json',
  'python',
  'rust',
  'go',
  'bash',
  'shell',
  'yaml',
  'sql',
  'html',
  'css',
  'markdown',
  'diff',
  'toml',
] as const;

const THEMES = ['github-dark', 'github-light'] as const;

export function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = (async () => {
      const shiki = await import('shiki');
      return shiki.createHighlighter({
        themes: [...THEMES],
        langs: [...LANGS],
      });
    })();
  }
  return highlighterPromise;
}

// Known shiki language aliases — normalize common markdown fence names.
const LANG_ALIAS: Record<string, string> = {
  typescript: 'ts',
  javascript: 'js',
  py: 'python',
  rs: 'rust',
  golang: 'go',
  sh: 'bash',
  zsh: 'bash',
  yml: 'yaml',
};

export function normalizeLang(lang: string | undefined): string | null {
  if (!lang) return null;
  const lower = lang.toLowerCase();
  const resolved = LANG_ALIAS[lower] ?? lower;
  if ((LANGS as readonly string[]).includes(resolved)) return resolved;
  return null;
}

export function pickShikiTheme(isDark: boolean): string {
  return isDark ? 'github-dark' : 'github-light';
}
