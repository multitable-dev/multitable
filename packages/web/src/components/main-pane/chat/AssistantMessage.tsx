import React, { memo } from 'react';
import { Streamdown, type Components } from 'streamdown';
import 'streamdown/styles.css';
import { CodeBlock } from './CodeBlock';

interface Props {
  text: string;
  costLabel?: string | null;
}

// Module-level so the reference is stable across every AssistantMessage
// render. A fresh components object per render forces the markdown renderer
// to discard memoized children — a key cause of flicker during unrelated
// parent re-renders (e.g. metrics ticks).
const MD_COMPONENTS: Components = {
  code(props) {
    const { inline, className, children } = props as typeof props & { inline?: boolean };
    const code = String(children ?? '').replace(/\n$/, '');
    if (inline) {
      return (
        <code
          style={{
            fontFamily: 'inherit',
            fontSize: '0.92em',
            padding: '0 5px',
            borderRadius: 0,
            backgroundColor: 'var(--bg-sidebar)',
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
        style={{ color: 'var(--accent-amber)', textDecoration: 'underline' }}
      >
        {children}
      </a>
    );
  },
  p({ children }) {
    return <p style={{ margin: '6px 0' }}>{children}</p>;
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
  // Headings — real semantic levels with a sized hierarchy. h1 is no longer
  // remapped to h3; it renders as a true h1 with the new font size.
  h1: ({ children }) => (
    <h1 style={{ fontSize: 17, fontWeight: 600, margin: '12px 0 6px' }}>{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 style={{ fontSize: 15.5, fontWeight: 600, margin: '12px 0 6px' }}>{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 style={{ fontSize: 14, fontWeight: 600, margin: '12px 0 6px' }}>{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 style={{ fontSize: 13, fontWeight: 600, margin: '12px 0 6px' }}>{children}</h4>
  ),
  h5: ({ children }) => (
    <h5 style={{ fontSize: 12.5, fontWeight: 600, margin: '12px 0 6px' }}>{children}</h5>
  ),
  h6: ({ children }) => (
    <h6
      style={{
        fontSize: 12,
        fontWeight: 600,
        margin: '12px 0 6px',
        color: 'var(--text-secondary)',
      }}
    >
      {children}
    </h6>
  ),
  // GFM tables
  table: ({ children }) => (
    <table style={{ borderCollapse: 'collapse', margin: '8px 0', fontSize: '0.95em' }}>
      {children}
    </table>
  ),
  thead: ({ children }) => (
    <thead style={{ backgroundColor: 'var(--bg-elevated)' }}>{children}</thead>
  ),
  tr: ({ children }) => <tr>{children}</tr>,
  th: ({ children }) => (
    <th
      style={{
        border: '1px solid var(--border)',
        padding: '4px 8px',
        textAlign: 'left',
        fontWeight: 600,
      }}
    >
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td style={{ border: '1px solid var(--border)', padding: '4px 8px' }}>{children}</td>
  ),
  // Lists
  ul: ({ children }) => <ul style={{ paddingLeft: 22, margin: '6px 0' }}>{children}</ul>,
  ol: ({ children }) => <ol style={{ paddingLeft: 22, margin: '6px 0' }}>{children}</ol>,
  li: ({ children }) => <li style={{ margin: '2px 0' }}>{children}</li>,
  // Inline emphasis
  strong: ({ children }) => (
    <strong style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{children}</strong>
  ),
  em: ({ children }) => <em style={{ fontStyle: 'italic' }}>{children}</em>,
  del: ({ children }) => (
    <del style={{ textDecoration: 'line-through', color: 'var(--text-muted)' }}>{children}</del>
  ),
  // Centered three-dot motif in place of a full-width rule
  hr: () => (
    <div
      style={{
        textAlign: 'center',
        color: 'var(--text-faint)',
        letterSpacing: '0.5em',
        margin: '14px 0',
      }}
    >
      ···
    </div>
  ),
  // GFM task list checkboxes
  input: (props) => {
    const { type, checked, disabled } = props as typeof props & {
      type?: string;
      checked?: boolean;
      disabled?: boolean;
    };
    if (type === 'checkbox') {
      return (
        <input
          type="checkbox"
          checked={!!checked}
          disabled={disabled}
          readOnly
          style={{
            width: 12,
            height: 12,
            accentColor: 'var(--accent-amber)',
            verticalAlign: '-1px',
            marginRight: 4,
          }}
        />
      );
    }
    return <input {...props} />;
  },
};

// Assistant message — rendered as GitHub-flavored markdown via Streamdown,
// which auto-closes unclosed code fences during streaming. Code fences are
// handed off to the shiki-backed CodeBlock. Inline code uses a compact chip.
// Memoized so unrelated parent re-renders don't re-parse the markdown.
export const AssistantMessage = memo(function AssistantMessage({ text, costLabel }: Props) {
  return (
    <div style={{ margin: '8px 0', color: 'var(--text-primary)' }}>
      <div
        className="mt-chat-assistant"
        style={{
          fontSize: 12.5,
          lineHeight: 1.55,
          maxWidth: '100%',
        }}
      >
        <Streamdown components={MD_COMPONENTS} parseIncompleteMarkdown>
          {text}
        </Streamdown>
      </div>
      {costLabel && (
        <div
          style={{
            fontSize: 10,
            color: 'var(--text-muted)',
            marginTop: 4,
            fontFamily: 'inherit',
            textTransform: 'uppercase',
            letterSpacing: '0.14em',
          }}
        >
          {costLabel}
        </div>
      )}
    </div>
  );
});
