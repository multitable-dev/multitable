import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Search, X } from 'lucide-react';
import { api } from '../../lib/api';
import { useAppStore } from '../../stores/appStore';
import toast from 'react-hot-toast';

interface TranscriptSession {
  sessionId: string;
  cwd: string;
  projectName: string;
  gitBranch: string | null;
  firstPrompt: string | null;
  mtime: number;
  pinnedSessionId: string | null;
}

interface TranscriptProject {
  cwd: string;
  projectName: string;
  sessionCount: number;
}

const REFRESH_EVENT = 'mt:past-sessions-refresh';

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo`;
  return `${Math.floor(mo / 12)}y`;
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + '\u2026';
}

const DEFAULT_PER_GROUP = 5;

export function PastSessions() {
  const store = useAppStore();
  const [sectionCollapsed, setSectionCollapsed] = useState(true);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [scopeCwd, setScopeCwd] = useState<string>('');
  const [data, setData] = useState<{ projects: TranscriptProject[]; sessions: TranscriptSession[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Per-group expanded override: true = forced open, false = forced closed,
  // missing = default behavior. Lets the user collapse a default-expanded
  // group AND expand a default-collapsed group.
  const [groupOverrides, setGroupOverrides] = useState<Map<string, boolean>>(new Map());
  // Per-group "show all" toggle (reveals beyond DEFAULT_PER_GROUP)
  const [groupShowAll, setGroupShowAll] = useState<Set<string>>(new Set());
  // Per-group "deep loaded from server" tracker
  const [groupDeepLoaded, setGroupDeepLoaded] = useState<Set<string>>(new Set());
  const [resumingId, setResumingId] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const fetchSeq = useRef(0);

  // Debounce query input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 150);
    return () => clearTimeout(t);
  }, [query]);

  // Fetch data when section opens, query/scope changes
  useEffect(() => {
    if (sectionCollapsed) return;
    const seq = ++fetchSeq.current;
    setLoading(true);
    setError(null);
    api.transcripts
      .list({ q: debouncedQuery || undefined, cwd: scopeCwd || undefined, limit: 200 })
      .then((res) => {
        if (seq !== fetchSeq.current) return;
        setData(res);
      })
      .catch((err) => {
        if (seq !== fetchSeq.current) return;
        setError(err?.message || 'Failed to load past sessions');
      })
      .finally(() => {
        if (seq !== fetchSeq.current) return;
        setLoading(false);
      });
  }, [sectionCollapsed, debouncedQuery, scopeCwd, refreshTick]);

  // Refresh when a session was deleted elsewhere (so unpinned items reappear)
  useEffect(() => {
    const handler = () => setRefreshTick((n) => n + 1);
    window.addEventListener(REFRESH_EVENT, handler);
    return () => window.removeEventListener(REFRESH_EVENT, handler);
  }, []);

  // Group sessions by cwd, preserving project ordering from data.projects
  const grouped = useMemo(() => {
    if (!data) return [];
    const byCwd = new Map<string, TranscriptSession[]>();
    for (const s of data.sessions) {
      const arr = byCwd.get(s.cwd) || [];
      arr.push(s);
      byCwd.set(s.cwd, arr);
    }
    // Order by data.projects (which is sorted by lastMtime desc on server),
    // and append any cwds present in sessions but missing from projects list.
    const ordered: { cwd: string; projectName: string; totalCount: number; sessions: TranscriptSession[] }[] = [];
    for (const p of data.projects) {
      const arr = byCwd.get(p.cwd);
      if (arr && arr.length > 0) {
        ordered.push({ cwd: p.cwd, projectName: p.projectName, totalCount: p.sessionCount, sessions: arr });
        byCwd.delete(p.cwd);
      }
    }
    for (const [cwd, arr] of byCwd) {
      ordered.push({ cwd, projectName: arr[0].projectName, totalCount: arr.length, sessions: arr });
    }
    return ordered;
  }, [data]);

  const handleSelectPinned = async (pinnedSessionId: string) => {
    // If already in the active project's sessions, just select it
    if (store.sessions[pinnedSessionId]) {
      store.setSelectedProcess(pinnedSessionId);
      return;
    }
    // Otherwise we need to find which project the session belongs to and switch
    try {
      const allProjects = store.projects;
      // Brute force: ask each project's sessions endpoint until we find it.
      // (Could be more efficient with a global /api/sessions list, but the
      // count of projects is small.)
      for (const p of allProjects) {
        const sessions = await api.sessions.list(p.id);
        if (sessions.find((s) => s.id === pinnedSessionId)) {
          store.setActiveProject(p.id);
          const [s, c, t] = await Promise.all([
            api.sessions.list(p.id),
            api.commands.list(p.id),
            api.terminals.list(p.id),
          ]);
          store.setSessions(s);
          store.setCommands(c);
          store.setTerminals(t);
          store.setSelectedProcess(pinnedSessionId);
          return;
        }
      }
      toast.error('Could not locate that session');
    } catch {
      toast.error('Could not switch to session');
    }
  };

  const handleResume = async (claudeSessionId: string) => {
    setResumingId(claudeSessionId);
    try {
      const res = await api.transcripts.resume(claudeSessionId);
      // Refresh projects list (a new project may have been auto-created)
      const projects = await api.projects.list();
      store.setProjects(projects);
      store.setActiveProject(res.projectId);
      const [s, c, t] = await Promise.all([
        api.sessions.list(res.projectId),
        api.commands.list(res.projectId),
        api.terminals.list(res.projectId),
      ]);
      store.setSessions(s);
      store.setCommands(c);
      store.setTerminals(t);
      store.setSelectedProcess(res.sessionId);
      // Refresh transcript list so the just-resumed session appears as pinned
      api.transcripts
        .list({ q: debouncedQuery || undefined, cwd: scopeCwd || undefined, limit: 200 })
        .then(setData)
        .catch(() => {});
      toast.success('Resumed session');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to resume');
    } finally {
      setResumingId(null);
    }
  };

  // Default state: top-3 projects expanded, rest collapsed. While searching,
  // expand all so matches are visible. The override map lets the user flip
  // any individual group either way.
  const isGroupExpanded = (cwd: string, idx: number): boolean => {
    if (groupOverrides.has(cwd)) return groupOverrides.get(cwd)!;
    if (debouncedQuery) return true;
    return idx < 3;
  };

  const toggleGroup = (cwd: string, idx: number) => {
    const currentlyExpanded = isGroupExpanded(cwd, idx);
    setGroupOverrides((prev) => {
      const next = new Map(prev);
      next.set(cwd, !currentlyExpanded);
      return next;
    });
  };

  const handleShowMore = async (cwd: string, totalCount: number) => {
    setGroupShowAll((prev) => new Set(prev).add(cwd));
    // If we don't already have everything for this cwd, fetch the rest.
    const haveCount = (data?.sessions ?? []).filter((s) => s.cwd === cwd).length;
    if (haveCount >= totalCount || groupDeepLoaded.has(cwd)) return;
    try {
      const res = await api.transcripts.list({ cwd, limit: 1000 });
      setData((prev) => {
        if (!prev) return res;
        const seen = new Map(prev.sessions.map((s) => [s.sessionId, s]));
        for (const s of res.sessions) seen.set(s.sessionId, s);
        return {
          projects: prev.projects,
          sessions: Array.from(seen.values()).sort((a, b) => b.mtime - a.mtime),
        };
      });
      setGroupDeepLoaded((prev) => new Set(prev).add(cwd));
    } catch {
      toast.error('Failed to load more sessions');
    }
  };

  const handleShowLess = (cwd: string) => {
    setGroupShowAll((prev) => {
      const next = new Set(prev);
      next.delete(cwd);
      return next;
    });
  };

  return (
    <div
      style={{
        borderTop: '2px solid var(--border)',
        paddingBottom: 8,
        backgroundColor: 'var(--bg-primary)',
      }}
    >
      {/* Header */}
      <div
        onClick={() => setSectionCollapsed((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '8px 16px',
          cursor: 'pointer',
        }}
      >
        {sectionCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--text-muted)',
            letterSpacing: '0.05em',
            marginLeft: 4,
          }}
        >
          PAST SESSIONS
        </span>
        <div style={{ flex: 1, height: 1, backgroundColor: 'var(--border)', margin: '0 8px' }} />
      </div>

      {!sectionCollapsed && (
        <>
          {/* Search input */}
          <div style={{ padding: '4px 12px 6px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                padding: '4px 6px',
              }}
            >
              <Search size={12} style={{ color: 'var(--text-muted)', marginRight: 4 }} />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={'Search past sessions\u2026'}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  minWidth: 0,
                }}
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex' }}
                  aria-label="Clear search"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Project filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px 6px' }}>
            <select
              value={scopeCwd}
              onChange={(e) => setScopeCwd(e.target.value)}
              style={{
                flex: 1,
                fontSize: 11,
                padding: '2px 4px',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                borderRadius: 3,
                minWidth: 0,
              }}
            >
              <option value="">All projects</option>
              {data?.projects.map((p) => (
                <option key={p.cwd} value={p.cwd}>
                  {p.projectName} ({p.sessionCount})
                </option>
              ))}
            </select>
          </div>

          {/* Status / errors */}
          {loading && !data && (
            <div style={{ padding: '6px 16px', fontSize: 11, color: 'var(--text-muted)' }}>{'Scanning\u2026'}</div>
          )}
          {error && (
            <div style={{ padding: '6px 16px', fontSize: 11, color: 'var(--danger, #f55)' }}>{error}</div>
          )}
          {data && data.sessions.length === 0 && !loading && (
            <div style={{ padding: '6px 16px', fontSize: 11, color: 'var(--text-muted)' }}>
              {debouncedQuery ? 'No matches' : 'No past sessions found'}
            </div>
          )}

          {/* Grouped list */}
          {grouped.map((group, idx) => {
            const expanded = isGroupExpanded(group.cwd, idx);
            const showAll = groupShowAll.has(group.cwd);
            const visibleSessions = showAll
              ? group.sessions
              : group.sessions.slice(0, DEFAULT_PER_GROUP);
            const hiddenLocally = group.sessions.length - visibleSessions.length;
            const hasMoreOnServer = group.totalCount > group.sessions.length;
            return (
              <div key={group.cwd} style={{ marginBottom: 4 }}>
                <div
                  onClick={() => toggleGroup(group.cwd, idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '4px 16px',
                    cursor: 'pointer',
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                  }}
                  title={group.cwd}
                >
                  {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                  <span style={{ marginLeft: 4, fontWeight: 500 }}>{group.projectName}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)' }}>
                    {group.totalCount}
                  </span>
                </div>
                {expanded && (
                  <>
                    {visibleSessions.map((s) => {
                      const isLinked = !!s.pinnedSessionId;
                      const isResuming = resumingId === s.sessionId;
                      return (
                        <div
                          key={s.sessionId}
                          onClick={() => {
                            if (isResuming) return;
                            if (isLinked && s.pinnedSessionId) handleSelectPinned(s.pinnedSessionId);
                            else handleResume(s.sessionId);
                          }}
                          style={{
                            padding: '4px 16px 4px 30px',
                            cursor: isResuming ? 'wait' : 'pointer',
                            fontSize: 12,
                            color: isLinked ? 'var(--text-muted)' : 'var(--text-primary)',
                            opacity: isLinked ? 0.7 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                          title={
                            (isLinked
                              ? '(already pinned — click to switch)\n'
                              : '(click to resume)\n') +
                            (s.firstPrompt || '(no prompt yet)') +
                            `\n\n${s.cwd}\nsession: ${s.sessionId}`
                          }
                        >
                          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {truncate(s.firstPrompt || '(no prompt)', 80)}
                          </span>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
                            {relativeTime(s.mtime)}
                          </span>
                        </div>
                      );
                    })}
                    {(hiddenLocally > 0 || hasMoreOnServer) && !showAll && (
                      <div
                        onClick={() => handleShowMore(group.cwd, group.totalCount)}
                        style={{
                          padding: '3px 16px 3px 30px',
                          fontSize: 11,
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          fontStyle: 'italic',
                        }}
                      >
                        Show more ({group.totalCount - DEFAULT_PER_GROUP} more)
                      </div>
                    )}
                    {showAll && group.sessions.length > DEFAULT_PER_GROUP && (
                      <div
                        onClick={() => handleShowLess(group.cwd)}
                        style={{
                          padding: '3px 16px 3px 30px',
                          fontSize: 11,
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          fontStyle: 'italic',
                        }}
                      >
                        Show less
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
