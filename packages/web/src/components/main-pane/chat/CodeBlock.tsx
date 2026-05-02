import React, { memo, useEffect, useState, useRef } from 'react';
import { Copy, Check } from 'lucide-react';
import { getHighlighter, normalizeLang, pickShikiTheme } from '../../../lib/shiki';
import { useAppStore } from '../../../stores/appStore';
import { BUILTIN_THEMES } from '../../../lib/themes';

interface Props {
  code: string;
  lang?: string;
}

function CopyButton({ text, visible }: { text: string; visible: boolean }) {
  const [copied, setCopied] = useState(false);
  const [hover, setHover] = useState(false);

  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore — clipboard may be unavailable
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={copied ? 'Copied' : 'Copy code'}
      style={{
        position: 'absolute',
        top: 6,
        right: 6,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 22,
        height: 22,
        padding: 0,
        background: hover ? 'var(--bg-hover)' : 'var(--bg-elevated)',
        border: '1px solid var(--border-strong)',
        borderRadius: 'var(--radius-snug)',
        color: copied ? 'var(--accent-amber)' : 'var(--text-muted)',
        cursor: 'pointer',
        opacity: visible || copied ? 1 : 0,
        transition: 'opacity var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out), background-color var(--dur-fast) var(--ease-out)',
        fontFamily: 'inherit',
      }}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
    </button>
  );
}

// Renders a code block with shiki. Falls back to a plain <pre> until the
// highlighter has initialized (async WASM load on first use). Memoized so
// unrelated parent re-renders don't re-invoke shiki and re-apply innerHTML.
export const CodeBlock = memo(function CodeBlock({ code, lang }: Props) {
  const [html, setHtml] = useState<string | null>(null);
  const [hover, setHover] = useState(false);
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

  // No frame and no left marker — the tinted background alone separates code
  // from surrounding prose. Padding lives on the inner pre / .mt-shiki pre.
  const wrapperStyle: React.CSSProperties = {
    position: 'relative',
    fontSize: 12,
    fontFamily: 'inherit',
    borderRadius: 'var(--radius-none)',
    backgroundColor: 'var(--bg-sidebar)',
    overflow: 'hidden',
    margin: '6px 0',
  };

  return (
    <div
      style={wrapperStyle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {html ? (
        <div
          className="mt-scroll mt-shiki"
          style={{ overflowX: 'auto' }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre
          className="mt-scroll"
          style={{
            margin: 0,
            padding: '10px 16px',
            color: 'var(--text-primary)',
            whiteSpace: 'pre',
            overflowX: 'auto',
          }}
        >
          {code}
        </pre>
      )}
      <CopyButton text={code} visible={hover} />
    </div>
  );
});
