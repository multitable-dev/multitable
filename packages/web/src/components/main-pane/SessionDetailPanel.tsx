import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Folder, File, ChevronRight, FileText, Plus, Minus, MessageSquare, Check, Copy, Sparkles, Trash2 } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { api } from '../../lib/api';
import { wsClient } from '../../lib/ws';
import { copyToClipboard } from '../../lib/clipboard';
import type { Session, Note } from '../../lib/types';
import { IconButton, Badge, Spinner } from '../ui';
import { TasksTab } from './chat/TasksTab';

interface Props {
  session: Session;
  projectId: string;
}

type TabId = 'files' | 'diff' | 'cost' | 'prompts' | 'brainstorm' | 'tasks';

const TABS: { id: TabId; label: string }[] = [
  { id: 'files', label: 'Files' },
  { id: 'diff', label: 'Diff' },
  { id: 'cost', label: 'Cost' },
  { id: 'prompts', label: 'Prompts' },
  { id: 'brainstorm', label: 'Brainstorm' },
  { id: 'tasks', label: 'Tasks' },
];

interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
}

function FilesTab({ projectId }: { projectId: string }) {
  const projects = useAppStore(s => s.projects);
  const projectPath = useMemo(() => {
    const p = projects.find(pr => pr.id === projectId);
    return p?.path ?? '';
  }, [projects, projectId]);

  const [files, setFiles] = useState<FileEntry[]>([]);
  const [expanded, setExpanded] = useState<Record<string, FileEntry[]>>({});
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Track the last-copied entry path for transient feedback — keyed by the
  // entry's relative path, cleared after ~1.2s.
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mirrors the App-level mobile breakpoint so we can flip the copy-path
  // button to the right edge on touch layouts.
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      setError('No project ID available');
      return;
    }
    setLoading(true);
    setError(null);
    api.projects
      .files(projectId)
      .then((result) => {
        setFiles(result);
        setLoading(false);
      })
      .catch((err) => {
        console.error('[FilesTab] Failed to load root files:', err);
        setError(err?.message || 'Failed to load files');
        setLoading(false);
      });
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
      } catch (err) {
        console.error('[FilesTab] Failed to expand folder:', path, err);
      }
    }
  };

  const copyEntryPath = async (entry: FileEntry, e: React.MouseEvent) => {
    // Prevent the click from bubbling to the row and triggering folder expand.
    e.stopPropagation();
    const abs = projectPath
      ? `${projectPath.replace(/\/$/, '')}/${entry.path}`
      : entry.path;
    const ok = await copyToClipboard(abs);
    if (!ok) return;
    setCopiedPath(entry.path);
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => setCopiedPath(null), 1200);
  };

  const handleRowClick = (entry: FileEntry) => {
    // Folders expand/collapse on click. Files do nothing — the only way to
    // interact with a file is the copy-path button.
    if (entry.type === 'directory') toggleFolder(entry.path);
  };

  const renderEntries = (entries: FileEntry[], depth: number) => (
    <>
      {entries.map((entry) => {
        const isCopied = copiedPath === entry.path;
        const isDir = entry.type === 'directory';
        const copyBtn = (
          <button
            type="button"
            onClick={(e) => copyEntryPath(entry, e)}
            title="Copy path"
            aria-label={`Copy path for ${entry.name}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              background: isCopied
                ? 'color-mix(in srgb, var(--accent-blue) 20%, transparent)'
                : 'transparent',
              border: '1px solid',
              borderColor: isCopied ? 'var(--accent-blue)' : 'var(--border)',
              color: isCopied ? 'var(--accent-blue)' : 'var(--text-muted)',
              padding: '2px 6px',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              fontSize: 11,
              flexShrink: 0,
              transition: 'background-color var(--dur-fast), color var(--dur-fast), border-color var(--dur-fast)',
            }}
            onMouseEnter={(e) => {
              if (!isCopied) {
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)';
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--text-muted)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isCopied) {
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)';
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)';
              }
            }}
          >
            {isCopied ? <Check size={12} /> : <Copy size={12} />}
            {isCopied ? 'Copied' : 'Copy'}
          </button>
        );
        return (
          <React.Fragment key={entry.path}>
            <div
              onClick={() => handleRowClick(entry)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 8px',
                paddingLeft: 8 + depth * 16,
                cursor: isDir ? 'pointer' : 'default',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                fontSize: 13,
                color: 'var(--text-primary)',
                borderRadius: 'var(--radius-sm)',
                transition: 'background-color var(--dur-fast) var(--ease-out)',
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--bg-hover)')
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent')
              }
            >
              {!isMobile && copyBtn}
              {isDir ? (
                <Folder size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              ) : (
                <File size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              )}
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                  minWidth: 0,
                }}
              >
                {entry.name}
              </span>
              {isMobile && copyBtn}
            </div>
            {isDir &&
              expandedPaths.has(entry.path) &&
              expanded[entry.path] &&
              renderEntries(expanded[entry.path], depth + 1)}
          </React.Fragment>
        );
      })}
    </>
  );

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-muted)', fontSize: 13, padding: 24, gap: 8 }}>
        <Spinner size="sm" /> Loading files...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 8, color: 'var(--text-muted)', padding: 24 }}>
        <Folder size={32} style={{ opacity: 0.4 }} />
        <span style={{ fontSize: 13, color: 'var(--status-error)' }}>{error}</span>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 8, color: 'var(--text-muted)', padding: 24 }}>
        <Folder size={32} style={{ opacity: 0.4 }} />
        <span style={{ fontSize: 13 }}>No files found</span>
      </div>
    );
  }

  return <div className="mt-scroll" style={{ padding: 8, overflowY: 'auto', flex: 1 }}>{renderEntries(files, 0)}</div>;
}

// --- Diff parsing and rendering utilities ---

interface DiffHunk {
  header: string;
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: DiffLine[];
}

interface DiffLine {
  type: 'add' | 'del' | 'context' | 'header';
  content: string;
  oldLine?: number;
  newLine?: number;
}

interface DiffFile {
  oldPath: string;
  newPath: string;
  hunks: DiffHunk[];
  additions: number;
  deletions: number;
}

interface DiffStats {
  filesChanged: number;
  totalAdditions: number;
  totalDeletions: number;
}

function parseDiff(raw: string): { files: DiffFile[]; stats: DiffStats } {
  if (!raw || !raw.trim()) return { files: [], stats: { filesChanged: 0, totalAdditions: 0, totalDeletions: 0 } };

  const files: DiffFile[] = [];
  const lines = raw.split('\n');
  let i = 0;

  while (i < lines.length) {
    // Look for diff --git header
    if (!lines[i].startsWith('diff --git')) {
      i++;
      continue;
    }

    let oldPath = '';
    let newPath = '';
    // Extract paths from "diff --git a/path b/path"
    const gitMatch = lines[i].match(/^diff --git a\/(.+?) b\/(.+)$/);
    if (gitMatch) {
      oldPath = gitMatch[1];
      newPath = gitMatch[2];
    }
    i++;

    // Skip index, mode, and other header lines until we hit --- or a new diff
    while (i < lines.length && !lines[i].startsWith('---') && !lines[i].startsWith('diff --git') && !lines[i].startsWith('@@')) {
      // Check for new file / deleted file hints
      if (lines[i].startsWith('new file mode')) {
        oldPath = '/dev/null';
      } else if (lines[i].startsWith('deleted file mode')) {
        newPath = '/dev/null';
      }
      i++;
    }

    // Parse --- and +++ lines
    if (i < lines.length && lines[i].startsWith('---')) {
      const m = lines[i].match(/^--- (?:a\/)?(.+)$/);
      if (m && m[1] !== '/dev/null') oldPath = m[1];
      else if (m && m[1] === '/dev/null') oldPath = '/dev/null';
      i++;
    }
    if (i < lines.length && lines[i].startsWith('+++')) {
      const m = lines[i].match(/^\+\+\+ (?:b\/)?(.+)$/);
      if (m && m[1] !== '/dev/null') newPath = m[1];
      else if (m && m[1] === '/dev/null') newPath = '/dev/null';
      i++;
    }

    const hunks: DiffHunk[] = [];
    let fileAdditions = 0;
    let fileDeletions = 0;

    // Parse hunks
    while (i < lines.length && !lines[i].startsWith('diff --git')) {
      if (lines[i].startsWith('@@')) {
        const hunkMatch = lines[i].match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/);
        if (hunkMatch) {
          const oldStart = parseInt(hunkMatch[1]);
          const oldCount = hunkMatch[2] !== undefined ? parseInt(hunkMatch[2]) : 1;
          const newStart = parseInt(hunkMatch[3]);
          const newCount = hunkMatch[4] !== undefined ? parseInt(hunkMatch[4]) : 1;
          const hunkContext = hunkMatch[5] || '';

          const hunk: DiffHunk = {
            header: lines[i],
            oldStart,
            oldCount,
            newStart,
            newCount,
            lines: [{ type: 'header', content: `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@${hunkContext}` }],
          };

          let oldLine = oldStart;
          let newLine = newStart;
          i++;

          while (i < lines.length && !lines[i].startsWith('@@') && !lines[i].startsWith('diff --git')) {
            const line = lines[i];
            if (line.startsWith('+')) {
              hunk.lines.push({ type: 'add', content: line.substring(1), newLine: newLine++ });
              fileAdditions++;
            } else if (line.startsWith('-')) {
              hunk.lines.push({ type: 'del', content: line.substring(1), oldLine: oldLine++ });
              fileDeletions++;
            } else if (line.startsWith(' ') || line === '') {
              hunk.lines.push({ type: 'context', content: line.startsWith(' ') ? line.substring(1) : line, oldLine: oldLine++, newLine: newLine++ });
            } else {
              // No-newline-at-end-of-file or other special lines
              if (line.startsWith('\\')) {
                // skip "\ No newline at end of file"
              } else {
                hunk.lines.push({ type: 'context', content: line, oldLine: oldLine++, newLine: newLine++ });
              }
            }
            i++;
          }

          hunks.push(hunk);
        } else {
          i++;
        }
      } else {
        i++;
      }
    }

    files.push({ oldPath, newPath, hunks, additions: fileAdditions, deletions: fileDeletions });
  }

  const stats: DiffStats = {
    filesChanged: files.length,
    totalAdditions: files.reduce((s, f) => s + f.additions, 0),
    totalDeletions: files.reduce((s, f) => s + f.deletions, 0),
  };

  return { files, stats };
}

/** Compute word-level diff between two strings, returns segments with highlight flags */
function computeWordDiff(oldStr: string, newStr: string): { old: { text: string; highlight: boolean }[]; new: { text: string; highlight: boolean }[] } {
  // Simple character-level LCS-based diff for highlighting changed portions
  const oldChars = oldStr.split('');
  const newChars = newStr.split('');

  // For very long lines, skip word diff to avoid perf issues
  if (oldChars.length > 500 || newChars.length > 500) {
    return {
      old: [{ text: oldStr, highlight: true }],
      new: [{ text: newStr, highlight: true }],
    };
  }

  // Find common prefix and suffix to narrow the diff region
  let prefixLen = 0;
  const minLen = Math.min(oldChars.length, newChars.length);
  while (prefixLen < minLen && oldChars[prefixLen] === newChars[prefixLen]) prefixLen++;

  let suffixLen = 0;
  while (
    suffixLen < minLen - prefixLen &&
    oldChars[oldChars.length - 1 - suffixLen] === newChars[newChars.length - 1 - suffixLen]
  ) suffixLen++;

  const commonPrefix = oldStr.substring(0, prefixLen);
  const commonSuffix = oldStr.substring(oldStr.length - suffixLen);
  const oldMiddle = oldStr.substring(prefixLen, oldStr.length - suffixLen);
  const newMiddle = newStr.substring(prefixLen, newStr.length - suffixLen);

  const oldSegments: { text: string; highlight: boolean }[] = [];
  const newSegments: { text: string; highlight: boolean }[] = [];

  if (commonPrefix) {
    oldSegments.push({ text: commonPrefix, highlight: false });
    newSegments.push({ text: commonPrefix, highlight: false });
  }
  if (oldMiddle) oldSegments.push({ text: oldMiddle, highlight: true });
  if (newMiddle) newSegments.push({ text: newMiddle, highlight: true });
  if (commonSuffix) {
    oldSegments.push({ text: commonSuffix, highlight: false });
    newSegments.push({ text: commonSuffix, highlight: false });
  }

  // If nothing was highlighted (identical lines), just return plain
  if (!oldMiddle && !newMiddle) {
    return { old: [{ text: oldStr, highlight: false }], new: [{ text: newStr, highlight: false }] };
  }

  return { old: oldSegments, new: newSegments };
}

function DiffLineContent({ segments, type }: { segments: { text: string; highlight: boolean }[]; type: 'add' | 'del' }) {
  return (
    <>
      {segments.map((seg, i) => (
        <span
          key={i}
          style={seg.highlight ? {
            backgroundColor: type === 'add' ? 'rgba(34, 197, 94, 0.35)' : 'rgba(239, 68, 68, 0.35)',
            borderRadius: 2,
          } : undefined}
        >
          {seg.text || ' '}
        </span>
      ))}
    </>
  );
}

function DiffFileSection({ file, defaultExpanded }: { file: DiffFile; defaultExpanded: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const displayPath = file.newPath === '/dev/null' ? file.oldPath : file.newPath;
  const isNew = file.oldPath === '/dev/null';
  const isDeleted = file.newPath === '/dev/null';

  // Pre-compute word diffs for adjacent add/del line pairs
  const hunkWordDiffs = useMemo(() => {
    return file.hunks.map((hunk) => {
      const wordDiffMap = new Map<number, { old: { text: string; highlight: boolean }[]; new: { text: string; highlight: boolean }[] }>();
      const lines = hunk.lines;
      let i = 0;
      while (i < lines.length) {
        if (lines[i].type === 'del') {
          // Collect consecutive del lines
          const delStart = i;
          while (i < lines.length && lines[i].type === 'del') i++;
          // Collect consecutive add lines
          const addStart = i;
          while (i < lines.length && lines[i].type === 'add') i++;
          const addEnd = i;
          // Pair them up for word diff
          const delCount = addStart - delStart;
          const addCount = addEnd - addStart;
          const pairs = Math.min(delCount, addCount);
          for (let p = 0; p < pairs; p++) {
            const wd = computeWordDiff(lines[delStart + p].content, lines[addStart + p].content);
            wordDiffMap.set(delStart + p, wd);
            wordDiffMap.set(addStart + p, wd);
          }
        } else {
          i++;
        }
      }
      return wordDiffMap;
    });
  }, [file.hunks]);

  // Stats bar for the file
  const statsBarWidth = Math.min(file.additions + file.deletions, 5);
  const addBlocks = file.additions + file.deletions > 0
    ? Math.round((file.additions / (file.additions + file.deletions)) * statsBarWidth)
    : 0;
  const delBlocks = statsBarWidth - addBlocks;

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      {/* File header */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 12px',
          backgroundColor: 'var(--bg-sidebar)',
          cursor: 'pointer',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          position: 'sticky',
          top: 0,
          zIndex: 1,
          borderBottom: expanded ? '1px solid var(--border)' : 'none',
        }}
      >
        <ChevronRight
          size={14}
          style={{
            color: 'var(--text-muted)',
            flexShrink: 0,
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform var(--dur-fast) var(--ease-out)',
          }}
        />
        <FileText size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <span style={{
          fontSize: 13,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          color: 'var(--text-primary)',
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {displayPath}
        </span>
        {isNew && <Badge variant="running" size="sm">NEW</Badge>}
        {isDeleted && <Badge variant="error" size="sm">DELETED</Badge>}
        <span style={{ fontSize: 12, color: 'var(--status-running)', fontWeight: 600, marginLeft: 4 }}>
          +{file.additions}
        </span>
        <span style={{ fontSize: 12, color: 'var(--status-error)', fontWeight: 600 }}>
          -{file.deletions}
        </span>
        {/* Mini stats blocks */}
        <span style={{ display: 'flex', gap: 1, marginLeft: 4 }}>
          {Array.from({ length: addBlocks }).map((_, i) => (
            <span key={`a${i}`} style={{ width: 8, height: 8, borderRadius: 1, backgroundColor: 'var(--status-running)', display: 'inline-block' }} />
          ))}
          {Array.from({ length: delBlocks }).map((_, i) => (
            <span key={`d${i}`} style={{ width: 8, height: 8, borderRadius: 1, backgroundColor: 'var(--status-error)', display: 'inline-block' }} />
          ))}
        </span>
      </div>

      {/* Hunks */}
      {expanded && (
        <div style={{ overflow: 'auto' }}>
          {file.hunks.map((hunk, hunkIdx) => (
            <table
              key={hunkIdx}
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontFamily: 'monospace',
                fontSize: 12,
                tableLayout: 'fixed',
              }}
            >
              <colgroup>
                <col style={{ width: 50 }} />
                <col style={{ width: 50 }} />
                <col style={{ width: 16 }} />
                <col />
              </colgroup>
              <tbody>
                {hunk.lines.map((line, lineIdx) => {
                  if (line.type === 'header') {
                    return (
                      <tr key={lineIdx}>
                        <td
                          colSpan={4}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: 'rgba(96, 165, 250, 0.08)',
                            color: 'var(--accent-blue)',
                            fontSize: 12,
                            fontFamily: 'monospace',
                            borderTop: hunkIdx > 0 ? '1px solid var(--border)' : 'none',
                          }}
                        >
                          {line.content}
                        </td>
                      </tr>
                    );
                  }

                  const bgColor =
                    line.type === 'add' ? 'rgba(34, 197, 94, 0.1)' :
                    line.type === 'del' ? 'rgba(239, 68, 68, 0.1)' :
                    'transparent';

                  const gutterBg =
                    line.type === 'add' ? 'rgba(34, 197, 94, 0.18)' :
                    line.type === 'del' ? 'rgba(239, 68, 68, 0.18)' :
                    'transparent';

                  const prefix = line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' ';
                  const prefixColor =
                    line.type === 'add' ? 'var(--status-running)' :
                    line.type === 'del' ? 'var(--status-error)' :
                    'var(--text-muted)';

                  // Word diff rendering
                  const wordDiffData = hunkWordDiffs[hunkIdx]?.get(lineIdx);
                  let contentEl: React.ReactNode;
                  if (wordDiffData && line.type === 'del') {
                    contentEl = <DiffLineContent segments={wordDiffData.old} type="del" />;
                  } else if (wordDiffData && line.type === 'add') {
                    contentEl = <DiffLineContent segments={wordDiffData.new} type="add" />;
                  } else {
                    contentEl = line.content || ' ';
                  }

                  return (
                    <tr key={lineIdx} style={{ backgroundColor: bgColor }}>
                      <td style={{
                        padding: '0 8px',
                        textAlign: 'right',
                        color: 'var(--text-muted)',
                        backgroundColor: gutterBg,
                        fontSize: 11,
                        lineHeight: '20px',
                        userSelect: 'none',
                        verticalAlign: 'top',
                        borderRight: '1px solid var(--border)',
                      }}>
                        {line.oldLine ?? ''}
                      </td>
                      <td style={{
                        padding: '0 8px',
                        textAlign: 'right',
                        color: 'var(--text-muted)',
                        backgroundColor: gutterBg,
                        fontSize: 11,
                        lineHeight: '20px',
                        userSelect: 'none',
                        verticalAlign: 'top',
                        borderRight: '1px solid var(--border)',
                      }}>
                        {line.newLine ?? ''}
                      </td>
                      <td style={{
                        padding: '0 4px',
                        textAlign: 'center',
                        color: prefixColor,
                        fontWeight: 700,
                        lineHeight: '20px',
                        userSelect: 'none',
                        verticalAlign: 'top',
                      }}>
                        {prefix}
                      </td>
                      <td style={{
                        padding: '0 8px',
                        lineHeight: '20px',
                        whiteSpace: 'pre',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        color: 'var(--text-primary)',
                        verticalAlign: 'top',
                      }}>
                        {contentEl}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ))}
        </div>
      )}
    </div>
  );
}

function DiffTab({ projectId }: { projectId: string }) {
  const [diff, setDiff] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.projects.diff(projectId)
      .then((res) => setDiff(res.diff))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  const parsed = useMemo(() => parseDiff(diff), [diff]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-muted)', fontSize: 13 }}>
        Loading diff...
      </div>
    );
  }

  if (!diff || parsed.files.length === 0) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        gap: 8,
        color: 'var(--text-muted)',
        padding: 24,
      }}>
        <FileText size={32} style={{ opacity: 0.4 }} />
        <span style={{ fontSize: 14, fontWeight: 500 }}>No changes detected</span>
        <span style={{ fontSize: 12, textAlign: 'center' }}>The working tree is clean. Make some edits and check back here.</span>
      </div>
    );
  }

  const { files, stats } = parsed;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Stats bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 12px',
        fontSize: 12,
        color: 'var(--text-secondary)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        backgroundColor: 'var(--bg-primary)',
      }}>
        <span>
          <strong style={{ color: 'var(--text-primary)' }}>{stats.filesChanged}</strong> file{stats.filesChanged !== 1 ? 's' : ''} changed
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--status-running)' }}>
          <Plus size={12} />
          <strong>{stats.totalAdditions}</strong> insertion{stats.totalAdditions !== 1 ? 's' : ''}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--status-error)' }}>
          <Minus size={12} />
          <strong>{stats.totalDeletions}</strong> deletion{stats.totalDeletions !== 1 ? 's' : ''}
        </span>
      </div>

      {/* File sections */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {files.map((file, idx) => (
          <DiffFileSection key={`${file.newPath}-${idx}`} file={file} defaultExpanded={files.length <= 10} />
        ))}
      </div>
    </div>
  );
}

function CostTab({ session }: { session: Session }) {
  const [costData, setCostData] = useState<{
    tokensIn: number;
    tokensOut: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
    costUsd: number;
    model: string;
    messageCount: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.sessions
      .cost(session.id)
      .then(setCostData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session.id]);

  // Refresh when claudeState updates (turn ends)
  const stateTokenCount = session.claudeState?.tokenCount ?? 0;
  useEffect(() => {
    if (stateTokenCount > 0) {
      api.sessions.cost(session.id).then(setCostData).catch(() => {});
    }
  }, [stateTokenCount, session.id]);

  const tokensIn = costData?.tokensIn ?? 0;
  const tokensOut = costData?.tokensOut ?? 0;
  const cacheCreation = costData?.cacheCreationTokens ?? 0;
  const cacheRead = costData?.cacheReadTokens ?? 0;
  const costUsd = costData?.costUsd ?? 0;
  const model = costData?.model ?? '';
  const messageCount = costData?.messageCount ?? 0;
  const totalTokens = tokensIn + tokensOut + cacheCreation + cacheRead;

  const formatTokens = (n: number): string => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
    return n.toLocaleString();
  };

  const formatCost = (n: number): string => {
    if (n >= 1) return `$${n.toFixed(2)}`;
    if (n >= 0.01) return `$${n.toFixed(3)}`;
    return `$${n.toFixed(4)}`;
  };

  if (loading) {
    return (
      <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 13 }}>
        Loading cost data...
      </div>
    );
  }

  if (totalTokens === 0) {
    return (
      <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 13 }}>
        No cost data available yet. Cost tracking begins after the first Claude response.
      </div>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      {/* Big cost display */}
      <div style={{
        backgroundColor: 'var(--bg-hover)',
        borderRadius: 6,
        padding: '12px 16px',
        marginBottom: 16,
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
          {formatCost(costUsd)}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
          Total session cost
        </div>
      </div>

      {/* Token breakdown */}
      <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, fontWeight: 500 }}>
        Token Usage
      </div>
      {[
        { label: 'Input tokens', value: formatTokens(tokensIn), raw: tokensIn },
        { label: 'Output tokens', value: formatTokens(tokensOut), raw: tokensOut },
        { label: 'Cache write', value: formatTokens(cacheCreation), raw: cacheCreation },
        { label: 'Cache read', value: formatTokens(cacheRead), raw: cacheRead },
      ]
        .filter((r) => r.raw > 0)
        .map((row) => (
          <div
            key={row.label}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '5px 0',
              fontSize: 13,
              borderBottom: '1px solid var(--border)',
            }}
          >
            <span style={{ color: 'var(--text-secondary)' }}>{row.label}</span>
            <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{row.value}</span>
          </div>
        ))}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '5px 0',
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        <span style={{ color: 'var(--text-primary)' }}>Total</span>
        <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{formatTokens(totalTokens)}</span>
      </div>

      {/* Session info */}
      <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, fontWeight: 500 }}>
        Details
      </div>
      {[
        { label: 'Model', value: model || 'Unknown' },
        { label: 'API calls', value: messageCount.toLocaleString() },
      ].map((row) => (
        <div
          key={row.label}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '5px 0',
            fontSize: 13,
          }}
        >
          <span style={{ color: 'var(--text-secondary)' }}>{row.label}</span>
          <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{row.value}</span>
        </div>
      ))}
    </div>
  );
}

function PromptsTab({ session }: { session: Session }) {
  const [prompts, setPrompts] = useState<Array<{ text: string; timestamp: number | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  const fetchPrompts = () => {
    return api.sessions
      .prompts(session.id)
      .then((res) => {
        setPrompts(res.prompts);
      })
      .catch(() => {});
  };

  useEffect(() => {
    setLoading(true);
    fetchPrompts().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  // Live-refresh whenever a new user prompt arrives. After the SDK migration
  // (Phase 4+) the user-prompt signal is `session:user-message`, emitted by
  // AgentSessionManager when sendTurn pushes the user's text. Refetch so we
  // pick up the full text from the JSONL/prompts endpoint.
  useEffect(() => {
    const off = wsClient.on('session:user-message', (msg: any) => {
      const pid = msg?.processId || msg?.payload?.processId;
      if (pid === session.id) {
        fetchPrompts();
      }
    });
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  const filtered = useMemo(() => {
    if (!query.trim()) return prompts;
    const q = query.toLowerCase();
    return prompts.filter((p) => p.text.toLowerCase().includes(q));
  }, [prompts, query]);

  const formatTime = (ts: number | null, idx: number) => {
    if (ts) {
      const d = new Date(ts);
      return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    return `#${idx + 1}`;
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 8, color: 'var(--text-muted)', fontSize: 13, padding: 24 }}>
        <Spinner size="sm" /> Loading prompts...
      </div>
    );
  }

  if (prompts.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 8, color: 'var(--text-muted)', padding: 24 }}>
        <MessageSquare size={32} style={{ opacity: 0.4 }} />
        <span style={{ fontSize: 14, fontWeight: 500 }}>No prompts yet</span>
        <span style={{ fontSize: 12, textAlign: 'center' }}>
          User prompts in this session will appear here.
        </span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Search + count */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
          backgroundColor: 'var(--bg-primary)',
        }}
      >
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter prompts…"
          style={{
            flex: 1,
            fontSize: 12,
            padding: '4px 8px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--bg-elevated)',
            color: 'var(--text-primary)',
            outline: 'none',
          }}
        />
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
          {query.trim() ? `${filtered.length} / ${prompts.length}` : `${prompts.length} prompt${prompts.length === 1 ? '' : 's'}`}
        </span>
      </div>

      {/* Prompt list */}
      <div className="mt-scroll" style={{ flex: 1, overflow: 'auto', padding: 8 }}>
        {filtered.map((p, i) => {
          const idx = prompts.indexOf(p);
          return (
            <div
              key={idx}
              style={{
                padding: '8px 10px',
                marginBottom: 6,
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-elevated)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    fontVariantNumeric: 'tabular-nums',
                    backgroundColor: 'color-mix(in srgb, var(--bg-sidebar) 70%, transparent)',
                    padding: '2px 6px',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  {formatTime(p.timestamp, idx)}
                </span>
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  {p.text.length.toLocaleString()} chars
                </span>
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--text-primary)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  lineHeight: 1.45,
                }}
              >
                {p.text}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && query.trim() && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            No prompts match "{query}"
          </div>
        )}
      </div>
    </div>
  );
}

function NoteCard({
  note,
  onChange,
  onDelete,
  onRefine,
}: {
  note: Note;
  onChange: (patch: Partial<Pick<Note, 'title' | 'content' | 'scope'>>) => void;
  onDelete: () => void;
  onRefine: () => Promise<{ refined: string; original: string } | null>;
}) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [refining, setRefining] = useState(false);
  const [refineError, setRefineError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<{ refined: string; original: string } | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep local state in sync when the note object identity changes (e.g.
  // refresh after a scope toggle). Skip if user is mid-edit for the same id.
  useEffect(() => {
    setTitle(note.title);
    setContent(note.content);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id, note.updatedAt]);

  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
  }, []);

  const scheduleSave = (patch: Partial<Pick<Note, 'title' | 'content'>>) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      onChange(patch);
    }, 500);
  };

  const handleTitle = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    scheduleSave({ title: e.target.value });
  };

  const handleContent = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    scheduleSave({ content: e.target.value });
  };

  const toggleScope = () => {
    const next: 'session' | 'project' = note.scope === 'session' ? 'project' : 'session';
    onChange({ scope: next });
  };

  const handleRefine = async () => {
    setRefining(true);
    setRefineError(null);
    try {
      // Flush any pending save so the refine sees current content.
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
        onChange({ title, content });
      }
      const result = await onRefine();
      if (result) setSuggestion(result);
      else setRefineError('Refine failed — try again?');
    } catch (err: any) {
      setRefineError(err?.message || 'Refine failed');
    } finally {
      setRefining(false);
    }
  };

  const acceptSuggestion = () => {
    if (!suggestion) return;
    setContent(suggestion.refined);
    onChange({ content: suggestion.refined });
    setSuggestion(null);
  };

  const rejectSuggestion = () => setSuggestion(null);

  const isSession = note.scope === 'session';

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        backgroundColor: 'var(--bg-elevated)',
        marginBottom: 10,
        overflow: 'hidden',
      }}
    >
      {/* Header: title + scope pill + actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 10px',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'color-mix(in srgb, var(--bg-sidebar) 40%, transparent)',
        }}
      >
        <input
          value={title}
          onChange={handleTitle}
          placeholder="Untitled note"
          style={{
            flex: 1,
            minWidth: 0,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}
        />
        <button
          type="button"
          onClick={toggleScope}
          title={isSession ? 'Visible only in this session — click to share with project' : 'Visible in every session of this project — click to scope to this session'}
          style={{
            fontSize: 10,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            padding: '3px 8px',
            borderRadius: 'var(--radius-pill)',
            border: '1px solid',
            borderColor: isSession ? 'var(--border)' : 'var(--accent-blue)',
            color: isSession ? 'var(--text-muted)' : 'var(--accent-blue)',
            backgroundColor: isSession
              ? 'transparent'
              : 'color-mix(in srgb, var(--accent-blue) 12%, transparent)',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          {isSession ? 'Session' : 'Project'}
        </button>
        <button
          type="button"
          onClick={handleRefine}
          disabled={refining || !content.trim()}
          title="Rewrite this note as a refined prompt using AI"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 11,
            padding: '3px 8px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--accent-blue)',
            color: refining || !content.trim() ? 'var(--text-muted)' : 'var(--accent-blue)',
            backgroundColor: refining
              ? 'color-mix(in srgb, var(--accent-blue) 15%, transparent)'
              : 'transparent',
            cursor: refining || !content.trim() ? 'default' : 'pointer',
            opacity: refining || !content.trim() ? 0.6 : 1,
            flexShrink: 0,
          }}
        >
          <Sparkles size={12} />
          {refining ? 'Refining…' : 'AI refine'}
        </button>
        <button
          type="button"
          onClick={onDelete}
          title="Delete this note"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: 4,
            flexShrink: 0,
          }}
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Body: content */}
      <textarea
        value={content}
        onChange={handleContent}
        placeholder="Jot down an idea…"
        rows={Math.max(3, Math.min(14, content.split('\n').length + 1))}
        style={{
          width: '100%',
          resize: 'vertical',
          minHeight: 60,
          padding: 10,
          fontSize: 13,
          fontFamily: 'inherit',
          backgroundColor: 'transparent',
          color: 'var(--text-primary)',
          border: 'none',
          outline: 'none',
          boxSizing: 'border-box',
          lineHeight: 1.5,
        }}
      />

      {/* Refine error */}
      {refineError && (
        <div style={{ padding: '6px 10px', fontSize: 11, color: 'var(--status-error)', borderTop: '1px solid var(--border)' }}>
          {refineError}
        </div>
      )}

      {/* Refine suggestion preview */}
      {suggestion && (
        <div style={{ borderTop: '1px solid var(--border)', padding: 10, backgroundColor: 'color-mix(in srgb, var(--accent-blue) 8%, transparent)' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent-blue)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Sparkles size={11} /> Refined version
          </div>
          <pre
            className="mt-scroll"
            style={{
              fontSize: 12,
              color: 'var(--text-primary)',
              margin: 0,
              padding: 8,
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              maxHeight: 200,
              overflow: 'auto',
            }}
          >
            {suggestion.refined}
          </pre>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button
              type="button"
              onClick={acceptSuggestion}
              style={{
                fontSize: 10.5,
                padding: '3px 10px',
                borderRadius: 0,
                backgroundColor: 'transparent',
                color: 'var(--accent-amber)',
                border: '1px solid var(--accent-amber)',
                cursor: 'pointer',
                fontWeight: 500,
                fontFamily: 'inherit',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Replace note
            </button>
            <button
              type="button"
              onClick={rejectSuggestion}
              style={{
                fontSize: 11,
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'transparent',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border)',
                cursor: 'pointer',
              }}
            >
              Discard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function BrainstormTab({ session }: { session: Session }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'session' | 'project'>('all');

  const load = () => {
    return api.notes
      .listForSession(session.id, session.projectId)
      .then((res) => setNotes(res.notes))
      .catch(() => {});
  };

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id, session.projectId]);

  const addNote = async (scope: 'session' | 'project') => {
    const note = await api.notes.create({
      projectId: session.projectId,
      sessionId: scope === 'session' ? session.id : null,
      scope,
      title: '',
      content: '',
    });
    setNotes((prev) => [note, ...prev]);
  };

  const updateNote = async (id: string, patch: Partial<Pick<Note, 'title' | 'content' | 'scope'>>) => {
    // When flipping scope to 'project', the API clears session_id; flipping
    // back to 'session' needs the current session id.
    const payload: any = { ...patch };
    if (patch.scope === 'session') payload.sessionId = session.id;
    if (patch.scope === 'project') payload.sessionId = null;

    const updated = await api.notes.update(id, payload);
    setNotes((prev) => prev.map((n) => (n.id === id ? updated : n)));
  };

  const deleteNote = async (id: string) => {
    await api.notes.delete(id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const refineNote = async (id: string) => {
    try {
      return await api.notes.refine(id);
    } catch {
      return null;
    }
  };

  const filtered = useMemo(() => {
    if (filter === 'all') return notes;
    return notes.filter((n) => n.scope === filter);
  }, [notes, filter]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 8, color: 'var(--text-muted)', fontSize: 13, padding: 24 }}>
        <Spinner size="sm" /> Loading notes…
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 10px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
          backgroundColor: 'var(--bg-primary)',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', gap: 2, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
          {(['all', 'session', 'project'] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              style={{
                fontSize: 11,
                padding: '4px 10px',
                textTransform: 'capitalize',
                background: filter === id ? 'var(--accent-blue)' : 'transparent',
                color: filter === id ? 'white' : 'var(--text-secondary)',
                border: 'none',
                cursor: 'pointer',
                fontWeight: filter === id ? 600 : 500,
              }}
            >
              {id}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={() => addNote('session')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 11,
            padding: '4px 10px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            backgroundColor: 'var(--bg-elevated)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          <Plus size={12} /> Session note
        </button>
        <button
          type="button"
          onClick={() => addNote('project')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 11,
            padding: '4px 10px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--accent-blue)',
            backgroundColor: 'color-mix(in srgb, var(--accent-blue) 10%, transparent)',
            color: 'var(--accent-blue)',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          <Plus size={12} /> Project note
        </button>
      </div>

      {/* Notes list */}
      <div className="mt-scroll" style={{ flex: 1, overflow: 'auto', padding: 10 }}>
        {filtered.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, gap: 8, color: 'var(--text-muted)' }}>
            <MessageSquare size={32} style={{ opacity: 0.4 }} />
            <span style={{ fontSize: 14, fontWeight: 500 }}>No notes yet</span>
            <span style={{ fontSize: 12, textAlign: 'center', maxWidth: 280 }}>
              Capture ideas as you think of them. Click "AI refine" on any note to rewrite it as a clear prompt.
            </span>
          </div>
        ) : (
          filtered.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onChange={(patch) => updateNote(note.id, patch)}
              onDelete={() => deleteNote(note.id)}
              onRefine={() => refineNote(note.id)}
            />
          ))
        )}
      </div>
    </div>
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
          height: 38,
          display: 'flex',
          alignItems: 'center',
          backgroundColor: 'var(--bg-sidebar)',
          borderTop: '1px solid var(--border)',
          flexShrink: 0,
          paddingLeft: 8,
          paddingRight: 6,
          position: 'relative',
        }}
      >
        {TABS.map((tab) => {
          const active = detailPanelTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setDetailPanelTab(tab.id)}
              style={{
                position: 'relative',
                background: 'none',
                border: 'none',
                color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: 13,
                fontWeight: active ? 600 : 500,
                padding: '0 14px',
                height: '100%',
                cursor: 'pointer',
                transition: 'color var(--dur-fast) var(--ease-out)',
              }}
              onMouseEnter={(e) => {
                if (!active) (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                if (!active) (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)';
              }}
            >
              {tab.label}
              <span
                style={{
                  position: 'absolute',
                  left: 12,
                  right: 12,
                  bottom: 0,
                  height: 2,
                  backgroundColor: 'var(--accent-blue)',
                  borderRadius: '2px 2px 0 0',
                  transform: active ? 'scaleX(1)' : 'scaleX(0)',
                  transformOrigin: 'center',
                  transition: 'transform var(--dur-med) var(--ease-out)',
                }}
              />
            </button>
          );
        })}
        <div style={{ flex: 1 }} />
        <IconButton size="sm" onClick={() => setDetailPanelOpen(false)} label="Close detail panel">
          <X size={13} />
        </IconButton>
      </div>

      {/* Content */}
      <div className="mt-scroll" style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        {detailPanelTab === 'files' && <FilesTab projectId={projectId} />}
        {detailPanelTab === 'diff' && <DiffTab projectId={projectId} />}
        {detailPanelTab === 'cost' && <CostTab session={session} />}
        {detailPanelTab === 'prompts' && <PromptsTab session={session} />}
        {detailPanelTab === 'brainstorm' && <BrainstormTab session={session} />}
        {detailPanelTab === 'tasks' && <TasksTab sessionId={session.id} />}
      </div>
    </div>
  );
}
