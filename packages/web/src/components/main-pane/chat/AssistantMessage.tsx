import React, { memo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeBlock } from './CodeBlock';

interface Props {
  text: string;
  costLabel?: string | null;
}

// Module-level so the reference is stable across every AssistantMessage
// render. A fresh components object per render forces react-markdown to
// discard memoized children — a key cause of flicker during unrelated
// parent re-renders (e.g. metrics ticks).
const MD_COMPONENTS: Components = {
  code(props) {
    const { inline, className, children } = props as typeof props & { inline?: boolean };
    const code = String(children ?? '').replace(/\n$/, '');
    if (inline) {
      return (
        <code
          style={{
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: '0.92em',
            padding: '1px 6px',
            borderRadius: 4,
            backgroundColor: 'color-mix(in srgb, var(--bg-sidebar) 80%, transparent)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
          }}
        >
          {code}
        </code>
      );
    }
    const match = /language-([\w-]+)/.exec(className ?? '');
    return <CodeBlock code={code} lang={match?.[1]} />;
  },
  a({ children, href }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        style={{ color: 'var(--accent-blue)', textDecoration: 'underline' }}
      >
        {children}
      </a>
    );
  },
  p({ children }) {
    return <p style={{ margin: '6px 0' }}>{children}</p>;
  },
  ul({ children }) {
    return <ul style={{ margin: '6px 0', paddingLeft: 22 }}>{children}</ul>;
  },
  ol({ children }) {
    return <ol style={{ margin: '6px 0', paddingLeft: 22 }}>{children}</ol>;
  },
  li({ children }) {
    return <li style={{ margin: '2px 0' }}>{children}</li>;
  },
  blockquote({ children }) {
    return (
      <blockquote
        style={{
          margin: '6px 0',
          padding: '4px 10px',
          borderLeft: '3px solid var(--border-strong)',
          color: 'var(--text-secondary)',
        }}
      >
        {children}
      </blockquote>
    );
  },
  h1: ({ children }) => <h3 style={{ fontSize: 16, margin: '10px 0 6px' }}>{children}</h3>,
  h2: ({ children }) => <h4 style={{ fontSize: 14.5, margin: '10px 0 6px' }}>{children}</h4>,
  h3: ({ children }) => <h5 style={{ fontSize: 13.5, margin: '10px 0 6px', fontWeight: 600 }}>{children}</h5>,
};

const REMARK_PLUGINS = [remarkGfm];

// Assistant message — rendered as GitHub-flavored markdown. Code fences are
// handed off to the shiki-backed CodeBlock. Inline code uses a compact chip.
// Memoized so unrelated parent re-renders don't re-parse the markdown.
export const AssistantMessage = memo(function AssistantMessage({ text, costLabel }: Props) {
  return (
    <div style={{ margin: '8px 0', color: 'var(--text-primary)' }}>
      <div
        className="mt-chat-assistant"
        style={{
          fontSize: 13.5,
          lineHeight: 1.55,
          maxWidth: '100%',
        }}
      >
        <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={MD_COMPONENTS}>
          {text}
        </ReactMarkdown>
      </div>
      {costLabel && (
        <div
          style={{
            fontSize: 10.5,
            color: 'var(--text-muted)',
            marginTop: 4,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          }}
        >
          {costLabel}
        </div>
      )}
    </div>
  );
});
