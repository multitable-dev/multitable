import React, { useState, useEffect, useRef } from 'react';
import { X, Folder, File } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { api } from '../../lib/api';
import type { Session } from '../../lib/types';

interface Props {
  session: Session;
  projectId: string;
}

type TabId = 'files' | 'diff' | 'cost' | 'notes';

const TABS: { id: TabId; label: string }[] = [
  { id: 'files', label: 'Files' },
  { id: 'diff', label: 'Diff' },
  { id: 'cost', label: 'Cost' },
  { id: 'notes', label: 'Notes' },
];

interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
}

function FilesTab({ projectId }: { projectId: string }) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [expanded, setExpanded] = useState<Record<string, FileEntry[]>>({});
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.projects.files(projectId).then(setFiles).catch(() => {});
  }, [projectId]);

  const toggleFolder = async (path: string) => {
    if (expandedPaths.has(path)) {
      setExpandedPaths((prev) => {
        const next = new Set(prev);
        next.delete(path);
        return next;
      });
    } else {
      try {
        const children = await api.projects.files(projectId, path);
        setExpanded((prev) => ({ ...prev, [path]: children }));
        setExpandedPaths((prev) => new Set(prev).add(path));
      } catch {
        // ignore
      }
    }
  };

  const openFile = (path: string) => {
    api.projects.openFile(projectId, path).catch(() => {});
  };

  const renderEntries = (entries: FileEntry[], depth: number) => (
    <>
      {entries.map((entry) => (
        <React.Fragment key={entry.path}>
          <div
            onClick={() =>
              entry.type === 'directory' ? toggleFolder(entry.path) : openFile(entry.path)
            }
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 8px',
              paddingLeft: 8 + depth * 16,
              cursor: 'pointer',
              fontSize: 13,
              color: 'var(--text-primary)',
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--bg-hover)')
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent')
            }
          >
            {entry.type === 'directory' ? (
              <Folder size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            ) : (
              <File size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            )}
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {entry.name}
            </span>
          </div>
          {entry.type === 'directory' &&
            expandedPaths.has(entry.path) &&
            expanded[entry.path] &&
            renderEntries(expanded[entry.path], depth + 1)}
        </React.Fragment>
      ))}
    </>
  );

  return <div style={{ padding: 8 }}>{renderEntries(files, 0)}</div>;
}

function DiffTab({ projectId }: { projectId: string }) {
  const [diff, setDiff] = useState<string>('');

  useEffect(() => {
    api.projects.diff(projectId).then((res) => setDiff(res.diff)).catch(() => {});
  }, [projectId]);

  const colorLine = (line: string): string => {
    if (line.startsWith('+')) return 'var(--status-running)';
    if (line.startsWith('-')) return 'var(--status-error)';
    if (line.startsWith('@@')) return 'var(--accent-blue)';
    return 'var(--text-primary)';
  };

  return (
    <pre
      style={{
        padding: 12,
        margin: 0,
        fontSize: 12,
        fontFamily: 'monospace',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
        overflow: 'auto',
        flex: 1,
      }}
    >
      {diff
        ? diff.split('\n').map((line, i) => (
            <div key={i} style={{ color: colorLine(line) }}>
              {line}
            </div>
          ))
        : <span style={{ color: 'var(--text-muted)' }}>No changes detected.</span>}
    </pre>
  );
}

function CostTab({ session }: { session: Session }) {
  const [costData, setCostData] = useState<{
    tokensIn: number;
    tokensOut: number;
    costUsd: number;
  } | null>(null);

  useEffect(() => {
    api.sessions.cost(session.id).then(setCostData).catch(() => {});
  }, [session.id]);

  const totalTokens = session.claudeState?.tokenCount ?? 0;
  const tokensIn = costData?.tokensIn ?? 0;
  const tokensOut = costData?.tokensOut ?? 0;
  const costUsd = costData?.costUsd ?? (totalTokens * 0.000003);

  const rows = [
    { label: 'Tokens In', value: tokensIn.toLocaleString() },
    { label: 'Tokens Out', value: tokensOut.toLocaleString() },
    { label: 'Total Tokens', value: (tokensIn + tokensOut || totalTokens).toLocaleString() },
    { label: 'Cost USD', value: `$${costUsd.toFixed(4)}` },
  ];

  return (
    <div style={{ padding: 16 }}>
      {rows.map((row) => (
        <div
          key={row.label}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '6px 0',
            fontSize: 13,
          }}
        >
          <span style={{ color: 'var(--text-secondary)' }}>{row.label}</span>
          <span style={{ color: 'var(--text-primary)', textAlign: 'right' }}>{row.value}</span>
        </div>
      ))}
    </div>
  );
}

function NotesTab({ session }: { session: Session }) {
  const [value, setValue] = useState(session.scratchpad ?? '');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    setValue(newVal);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      api.sessions.update(session.id, { scratchpad: newVal } as any).catch(() => {});
    }, 500);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <textarea
      value={value}
      onChange={handleChange}
      placeholder="Notes..."
      style={{
        flex: 1,
        width: '100%',
        height: '100%',
        resize: 'none',
        padding: 12,
        fontSize: 13,
        fontFamily: 'inherit',
        backgroundColor: 'transparent',
        color: 'var(--text-primary)',
        border: 'none',
        outline: 'none',
        boxSizing: 'border-box',
      }}
    />
  );
}

export function SessionDetailPanel({ session, projectId }: Props) {
  const { detailPanelTab, setDetailPanelTab, setDetailPanelOpen } = useAppStore();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        height: '100%',
      }}
    >
      {/* Tab bar */}
      <div
        style={{
          height: 36,
          display: 'flex',
          alignItems: 'center',
          backgroundColor: 'var(--bg-sidebar)',
          borderTop: '1px solid var(--border)',
          flexShrink: 0,
          paddingLeft: 8,
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setDetailPanelTab(tab.id)}
            style={{
              background: 'none',
              border: 'none',
              borderBottom:
                detailPanelTab === tab.id ? '2px solid var(--accent-blue)' : '2px solid transparent',
              color:
                detailPanelTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontSize: 13,
              padding: '0 12px',
              height: '100%',
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setDetailPanelOpen(false)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '0 8px',
            display: 'flex',
            alignItems: 'center',
            height: '100%',
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        {detailPanelTab === 'files' && <FilesTab projectId={projectId} />}
        {detailPanelTab === 'diff' && <DiffTab projectId={projectId} />}
        {detailPanelTab === 'cost' && <CostTab session={session} />}
        {detailPanelTab === 'notes' && <NotesTab session={session} />}
      </div>
    </div>
  );
}
