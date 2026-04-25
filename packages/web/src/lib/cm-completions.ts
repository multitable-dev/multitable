import type {
  Completion,
  CompletionContext,
  CompletionResult,
} from '@codemirror/autocomplete';
import { api } from './api';

// ─── File mentions (@-triggered) ─────────────────────────────────────────────

interface FileIndexEntry {
  path: string;
  name: string;
  isDir: boolean;
}

interface FileIndex {
  projectId: string;
  loadedAt: number;
  entries: FileIndexEntry[];
}

// In-memory index per project, refreshed at most every 20s. Walks the project
// tree one level at a time because the backend returns flat listings per path
// — we BFS up to a reasonable depth / cap to keep latency low.
const indexCache = new Map<string, FileIndex>();
const INDEX_TTL_MS = 20_000;
const MAX_ENTRIES = 8000;
const MAX_DEPTH = 5;
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.turbo', '.cache', 'coverage']);

async function walkProject(projectId: string): Promise<FileIndexEntry[]> {
  const out: FileIndexEntry[] = [];
  const queue: Array<{ path: string; depth: number }> = [{ path: '', depth: 0 }];
  while (queue.length && out.length < MAX_ENTRIES) {
    const { path, depth } = queue.shift()!;
    let entries: Array<{ name: string; path: string; type: string }> = [];
    try {
      entries = (await api.projects.files(projectId, path || undefined)) as any;
    } catch {
      continue;
    }
    for (const e of entries) {
      if (SKIP_DIRS.has(e.name)) continue;
      const isDir = e.type === 'directory';
      out.push({ path: e.path, name: e.name, isDir });
      if (isDir && depth < MAX_DEPTH) {
        queue.push({ path: e.path, depth: depth + 1 });
      }
    }
  }
  return out;
}

async function getIndex(projectId: string): Promise<FileIndexEntry[]> {
  const cached = indexCache.get(projectId);
  if (cached && Date.now() - cached.loadedAt < INDEX_TTL_MS) {
    return cached.entries;
  }
  const entries = await walkProject(projectId);
  indexCache.set(projectId, { projectId, loadedAt: Date.now(), entries });
  return entries;
}

// Kick the index early (e.g. when the composer mounts) so the first @ is fast.
export function warmProjectIndex(projectId: string): void {
  getIndex(projectId).catch(() => {});
}

// Manual invalidation — call if files are known to have changed.
export function invalidateProjectIndex(projectId: string): void {
  indexCache.delete(projectId);
}

function fuzzyScore(query: string, candidate: string): number {
  // Lightweight subsequence match: returns -1 if q isn't a subsequence of c.
  // Otherwise returns a score — lower is better (tighter / earlier match).
  if (!query) return 0;
  const q = query.toLowerCase();
  const c = candidate.toLowerCase();
  // Fast path: substring match scores highest.
  const idx = c.indexOf(q);
  if (idx >= 0) return idx; // earlier substring = lower score
  // Subsequence fallback.
  let ci = 0;
  let spread = 0;
  for (let qi = 0; qi < q.length; qi++) {
    const found = c.indexOf(q[qi], ci);
    if (found < 0) return -1;
    spread += found - ci;
    ci = found + 1;
  }
  return 1000 + spread; // always worse than substring but still ranked.
}

export function fileMentionSource(projectIdGetter: () => string | null) {
  return async (ctx: CompletionContext): Promise<CompletionResult | null> => {
    const match = ctx.matchBefore(/@[\w./\-]*/);
    if (!match) return null;
    // Require the char before '@' to be whitespace/start — avoids triggering
    // inside emails etc.
    if (match.from > 0) {
      const prev = ctx.state.sliceDoc(match.from - 1, match.from);
      if (!/\s/.test(prev)) return null;
    }
    if (!match.text.startsWith('@')) return null;
    const query = match.text.slice(1);
    const projectId = projectIdGetter();
    if (!projectId) return null;

    const entries = await getIndex(projectId).catch(() => [] as FileIndexEntry[]);
    const scored: Array<{ e: FileIndexEntry; score: number }> = [];
    for (const e of entries) {
      if (e.isDir) continue;
      const s = fuzzyScore(query, e.path);
      if (s < 0) continue;
      scored.push({ e, score: s });
    }
    scored.sort((a, b) => a.score - b.score);

    const options: Completion[] = scored.slice(0, 40).map(({ e }) => {
      const dir = e.path.includes('/') ? e.path.slice(0, e.path.lastIndexOf('/')) : '';
      return {
        label: e.name,
        detail: dir || undefined,
        type: 'file',
        apply: `@${e.path} `,
        boost: -entries.indexOf(e), // stable tie-break
      };
    });

    return {
      from: match.from,
      options,
      validFor: /^@[\w./\-]*$/,
    };
  };
}

// Slash-command autocomplete used to live here. It was removed because
// Claude Code's slash commands are interactive TUI features (confirmation
// modals, pickers, ephemeral screen output) that don't round-trip through a
// raw stdin pipe. Submitting `/clear`, `/model`, `/compact`, etc. from the
// chat view silently opens a modal that then eats the user's next message.
// If we want slash-command support in the future, it should go through a
// MultiTable-managed flow (explicit API, rendered modal UI) rather than
// pushing text into the PTY.
