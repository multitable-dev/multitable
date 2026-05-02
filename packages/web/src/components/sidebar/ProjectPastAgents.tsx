import React, { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useTranscripts } from '../../hooks/useTranscripts';
import { PastAgentsList } from './PastAgentsList';
import { resumePastSession, selectPinnedSession } from '../../lib/pastAgents';

interface Props {
  projectPath: string;
  projectId: string;
}

export function ProjectPastAgents({ projectPath }: Props) {
  const [collapsed, setCollapsed] = useState(true);
  const [resumingId, setResumingId] = useState<string | null>(null);

  const { data, loading, error, grouped, loadMoreForCwd } = useTranscripts({
    cwd: projectPath,
    enabled: !collapsed,
    limit: 20,
  });

  const group = useMemo(() => grouped[0] ?? null, [grouped]);

  const visibleCount = useMemo(() => {
    if (!group) return null;
    const filtered = group.sessions.filter((s) => !s.pinnedSessionId);
    const haveAll = group.sessions.length >= group.totalCount;
    if (haveAll) return filtered.length;
    return null;
  }, [group]);

  const handleSession = async (session: { sessionId: string; pinnedSessionId: string | null }) => {
    if (resumingId) return;
    if (session.pinnedSessionId) {
      await selectPinnedSession(session.pinnedSessionId);
      return;
    }
    setResumingId(session.sessionId);
    try {
      await resumePastSession(session.sessionId);
    } finally {
      setResumingId(null);
    }
  };

  const hasFetched = !!data && !loading;

  return (
    <div style={{ marginTop: 2 }}>
      <div
        onClick={() => setCollapsed((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '4px 16px 4px 22px',
          cursor: 'pointer',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          gap: 4,
          fontSize: 11,
          color: 'var(--text-muted)',
        }}
        title="Browse past agents for this project"
      >
        <ChevronRight
          size={10}
          style={{
            color: 'var(--text-faint)',
            flexShrink: 0,
            transform: collapsed ? 'rotate(0deg)' : 'rotate(90deg)',
            transition: 'transform var(--dur-fast) var(--ease-out)',
          }}
        />
        <span
          style={{
            textTransform: 'uppercase',
            letterSpacing: '0.16em',
            fontSize: 9.5,
            fontWeight: 500,
            color: 'var(--text-faint)',
          }}
        >
          Past agents
        </span>
        {visibleCount !== null && visibleCount > 0 && (
          <span style={{ marginLeft: 4, fontVariantNumeric: 'tabular-nums', color: 'var(--text-faint)' }}>
            ({visibleCount})
          </span>
        )}
      </div>
      {!collapsed && (
        <PastAgentsList
          mode="project"
          group={group}
          loading={loading}
          error={error}
          hasFetched={hasFetched}
          hidePinned
          perGroupLimit={5}
          inFlightSessionId={resumingId}
          onPickSession={handleSession}
          onLoadMore={() => {
            if (group) loadMoreForCwd(group.cwd, group.totalCount);
          }}
        />
      )}
    </div>
  );
}
