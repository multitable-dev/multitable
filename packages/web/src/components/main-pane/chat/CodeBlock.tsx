import React, { memo, useEffect, useState, useRef } from 'react';
import { getHighlighter, normalizeLang, pickShikiTheme } from '../../../lib/shiki';
import { useAppStore } from '../../../stores/appStore';
import { BUILTIN_THEMES } from '../../../lib/themes';

interface Props {
  code: string;
  lang?: string;
}

// Renders a code block with shiki. Falls back to a plain <pre> until the
// highlighter has initialized (async WASM load on first use). Memoized so
// unrelated parent re-renders don't re-invoke shiki and re-apply innerHTML.
export const CodeBlock = memo(function CodeBlock({ code, lang }: Props) {
  const [html, setHtml] = useState<string | null>(null);
  const activeThemeId = useAppStore((s) => s.activeThemeId);
  const customThemes = useAppStore((s) => s.customThemes);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const all = [...BUILTIN_THEMES, ...customThemes];
    const active = all.find((t) => t.id === activeThemeId);
    const shikiTheme = pickShikiTheme(active?.isDark ?? true);
    const resolvedLang = normalizeLang(lang);

    getHighlighter()
      .then((hl) => {
        if (!mountedRef.current) return;
        try {
          const out = hl.codeToHtml(code, {
            lang: resolvedLang ?? 'text',
            theme: shikiTheme,
          });
          setHtml(out);
        } catch {
          setHtml(null);
        }
      })
      .catch(() => {
        if (mountedRef.current) setHtml(null);
      });

    return () => {
      mountedRef.current = false;
    };
  }, [code, lang, activeThemeId, customThemes]);

  const wrapperStyle: React.CSSProperties = {
    fontSize: 12.5,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    backgroundColor: 'color-mix(in srgb, var(--bg-sidebar) 70%, transparent)',
    overflow: 'hidden',
    margin: '6px 0',
  };

  if (html) {
    return (
      <div
        className="mt-scroll mt-shiki"
        style={{ ...wrapperStyle, overflowX: 'auto' }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return (
    <pre
      className="mt-scroll"
      style={{
        ...wrapperStyle,
        margin: '6px 0',
        padding: '10px 12px',
        color: 'var(--text-primary)',
        whiteSpace: 'pre',
        overflowX: 'auto',
      }}
    >
      {code}
    </pre>
  );
});
