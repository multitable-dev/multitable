import React, { memo, useState } from 'react';
import { ChevronRight, FileText, FilePenLine, Terminal as TerminalIcon, Search, Globe, Wrench, AlertTriangle } from 'lucide-react';
import { CodeBlock } from './CodeBlock';

interface Props {
  toolName: string;
  input: unknown;
  output: string | null;
  isError: boolean;
  pending: boolean;
}

function toolIcon(name: string, size = 13) {
  switch (name) {
    case 'Read':
      return <FileText size={size} />;
    case 'Edit':
    case 'Write':
    case 'MultiEdit':
      return <FilePenLine size={size} />;
    case 'Bash':
    case 'BashOutput':
      return <TerminalIcon size={size} />;
    case 'Grep':
    case 'Glob':
      return <Search size={size} />;
    case 'WebFetch':
    case 'WebSearch':
      return <Globe size={size} />;
    default:
      return <Wrench size={size} />;
  }
}

// Per-tool one-line summary. Keeps the collapsed card readable without
// having to dig into the JSON.
function toolSummary(toolName: string, input: any): string {
  if (!input || typeof input !== 'object') return '';
  switch (toolName) {
    case 'Read':
      return typeof input.file_path === 'string' ? input.file_path : '';
    case 'Write':
    case 'Edit':
    case 'MultiEdit':
      return typeof input.file_path === 'string' ? input.file_path : '';
    case 'Bash':
      return typeof input.command === 'string' ? input.command.slice(0, 120) : '';
    case 'Grep':
      return typeof input.pattern === 'string' ? input.pattern : '';
    case 'Glob':
      return typeof input.pattern === 'string' ? input.pattern : '';
    case 'WebFetch':
    case 'WebSearch':
      return typeof input.url === 'string' ? input.url : typeof input.query === 'string' ? input.query : '';
    case 'Task':
      return typeof input.description === 'string' ? input.description : '';
    case 'TodoWrite':
      return Array.isArray(input.todos) ? `${input.todos.length} todo(s)` : '';
    default:
      return '';
  }
}

function languageForTool(toolName: string, input: any): string | undefined {
  if (toolName === 'Bash') return 'bash';
  if (toolName === 'Edit' || toolName === 'Write' || toolName === 'MultiEdit' || toolName === 'Read') {
    const path: string | undefined = typeof input?.file_path === 'string' ? input.file_path : undefined;
    if (!path) return undefined;
    const ext = path.split('.').pop()?.toLowerCase();
    return ext;
  }
  return undefined;
}

export const ToolCallCard = memo(function ToolCallCard({ toolName, input, output, isError, pending }: Props) {
  const [open, setOpen] = useState(false);
  const summary = toolSummary(toolName, input);
  const lang = languageForTool(toolName, input);

  return (
    <div
      style={{
        margin: '6px 0',
        border: `1px solid ${isError ? 'var(--status-error)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-md)',
        backgroundColor: 'color-mix(in srgb, var(--bg-elevated) 60%, transparent)',
        overflow: 'hidden',
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex',
          width: '100%',
          alignItems: 'center',
          gap: 8,
          padding: '6px 10px',
          background: 'transparent',
          border: 'none',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform var(--dur-fast) var(--ease-out)',
            color: 'var(--text-muted)',
          }}
        >
          <ChevronRight size={13} />
        </span>
        <span style={{ color: isError ? 'var(--status-error)' : 'var(--text-secondary)', display: 'inline-flex' }}>
          {isError ? <AlertTriangle size={13} /> : toolIcon(toolName)}
        </span>
        <span style={{ fontSize: 12.5, fontWeight: 600 }}>{toolName}</span>
        {summary && (
          <span
            style={{
              fontSize: 12,
              color: 'var(--text-secondary)',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
              flex: 1,
            }}
          >
            {summary}
          </span>
        )}
        {pending && (
          <span
            style={{
              fontSize: 10.5,
              color: 'var(--text-muted)',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              marginLeft: 'auto',
            }}
          >
            running…
          </span>
        )}
      </button>

      {open && (
        <div style={{ padding: '4px 10px 10px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Input
          </div>
          <CodeBlock code={JSON.stringify(input, null, 2)} lang="json" />
          {output !== null && (
            <>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {isError ? 'Error' : 'Result'}
              </div>
              <CodeBlock code={output} lang={lang} />
            </>
          )}
        </div>
      )}
    </div>
  );
});
