import fs from 'fs';
import path from 'path';
import os from 'os';
import type { Message } from './parser.js';

// Codex CLI persists each thread to ~/.codex/sessions/<YYYY>/<MM>/<DD>/
// rollout-<timestamp>-<thread_id>.jsonl. Both the codex TUI and the SDK write
// to the same tree (different `originator` field in the session_meta header).
//
// The format is JSONL with three primary line types:
//   - session_meta:   one-time header carrying { id, cwd, originator, ... }
//   - event_msg:      high-level UI events with a payload.type subtype
//   - response_item:  raw model API exchanges (function_call, message, ...)
//   - turn_context:   per-turn config (sandbox policy, approval policy, ...)
//   - compacted:      replacement_history after a context compaction
//
// We consume `event_msg` because its payload is already shaped for UI rendering
// (parsed commands, aggregated stdout, success flags). `response_item` carries
// the raw API exchanges and would force us to redo the same parsing the codex
// CLI already did.

const CODEX_SESSIONS_DIR = path.join(os.homedir(), '.codex', 'sessions');

interface CodexLine {
  timestamp?: string;
  type?: string;
  payload?: Record<string, unknown> | unknown;
}

interface SessionMetaPayload {
  id?: string;
  cwd?: string;
  originator?: string;
  cli_version?: string;
}

export interface CodexThreadHeader {
  threadId: string;
  cwd: string | null;
  originator: string | null;
  cliVersion: string | null;
  startedAt: number | null;
  filePath: string;
}

// Walk the date-bucketed sessions tree and return all rollout files. Cheap
// because we only stat directories; no JSONL parsing here.
function listRolloutFiles(): string[] {
  const out: string[] = [];
  function walk(dir: string) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.startsWith('rollout-') && entry.name.endsWith('.jsonl')) {
        out.push(full);
      }
    }
  }
  walk(CODEX_SESSIONS_DIR);
  return out;
}

// Find the rollout file for a given thread id. Match on filename suffix
// (`-<threadId>.jsonl`) — falling back to a header parse if filename naming
// drifts in a future codex CLI release.
export function findCodexSessionFile(threadId: string): string | null {
  if (!threadId) return null;
  const files = listRolloutFiles();
  const suffix = `-${threadId}.jsonl`;
  const hit = files.find((f) => f.endsWith(suffix));
  if (hit) return hit;
  for (const file of files) {
    const header = readSessionMeta(file);
    if (header?.threadId === threadId) return file;
  }
  return null;
}

function readSessionMeta(filePath: string): CodexThreadHeader | null {
  try {
    const fd = fs.openSync(filePath, 'r');
    try {
      const buf = Buffer.alloc(64 * 1024);
      const n = fs.readSync(fd, buf, 0, buf.length, 0);
      const text = buf.subarray(0, n).toString('utf8');
      const firstLine = text.split('\n', 1)[0];
      if (!firstLine) return null;
      const parsed = JSON.parse(firstLine) as CodexLine;
      if (parsed.type !== 'session_meta') return null;
      const p = (parsed.payload ?? {}) as SessionMetaPayload;
      if (!p.id) return null;
      return {
        threadId: p.id,
        cwd: p.cwd ?? null,
        originator: p.originator ?? null,
        cliVersion: p.cli_version ?? null,
        startedAt: parsed.timestamp ? Date.parse(parsed.timestamp) || null : null,
        filePath,
      };
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return null;
  }
}

// List every codex thread on disk, sorted newest first. Optional cwd filter
// matches threads whose session_meta.cwd equals the supplied path.
export function listCodexThreads(opts: { cwd?: string; limit?: number } = {}): CodexThreadHeader[] {
  const headers: CodexThreadHeader[] = [];
  for (const file of listRolloutFiles()) {
    const header = readSessionMeta(file);
    if (!header) continue;
    if (opts.cwd && header.cwd !== opts.cwd) continue;
    headers.push(header);
  }
  headers.sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0));
  if (opts.limit && opts.limit > 0) headers.length = Math.min(headers.length, opts.limit);
  return headers;
}

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

// Convert one codex JSONL file into our shared Message[] shape. Matches the
// live `codexItemToMessages` mapping in agent/manager.ts so on-disk and live
// events render identically.
export function parseCodexThread(threadId: string): Message[] {
  const file = findCodexSessionFile(threadId);
  if (!file) return [];
  return parseCodexFile(file);
}

export function parseCodexFile(filePath: string): Message[] {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch {
    return [];
  }

  const messages: Message[] = [];
  const seenIds = new Set<string>();

  const push = (msg: Message) => {
    if (seenIds.has(msg.id)) return;
    seenIds.add(msg.id);
    messages.push(msg);
  };

  let synthCounter = 0;
  const newId = (prefix: string) => `${prefix}-${++synthCounter}`;

  const lines = raw.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    let parsed: CodexLine;
    try {
      parsed = JSON.parse(line) as CodexLine;
    } catch {
      continue;
    }
    const ts = parsed.timestamp ? Date.parse(parsed.timestamp) || Date.now() : Date.now();
    if (parsed.type !== 'event_msg') continue;
    const p = (parsed.payload ?? {}) as Record<string, unknown>;
    const sub = asString(p.type);

    switch (sub) {
      case 'user_message': {
        const text = asString(p.message);
        if (!text) break;
        push({ id: newId('user'), ts, kind: 'user', text });
        break;
      }
      case 'agent_message': {
        const text = asString(p.message);
        if (!text) break;
        push({ id: newId('assistant'), ts, kind: 'assistant', text, model: 'codex' });
        break;
      }
      case 'exec_command_end': {
        const callId = asString(p.call_id) || newId('exec');
        const cmd = asArray<string>(p.command).join(' ') || asString(p.command);
        const output = asString(p.aggregated_output) || asString(p.stdout) || asString(p.stderr) || '';
        const isError = (p as { exit_code?: number }).exit_code !== 0;
        push({
          id: `${callId}-use`,
          ts,
          kind: 'tool_use',
          parentId: callId,
          toolUseId: callId,
          toolName: 'Command',
          input: { command: cmd },
        });
        push({
          id: `${callId}-result`,
          ts,
          kind: 'tool_result',
          toolUseId: callId,
          output,
          isError,
        });
        break;
      }
      case 'patch_apply_end': {
        const callId = asString(p.call_id) || newId('patch');
        const success = (p as { success?: boolean }).success !== false;
        const stdout = asString(p.stdout);
        const stderr = asString(p.stderr);
        const changes = (p as { changes?: Record<string, unknown> }).changes ?? {};
        push({
          id: `${callId}-use`,
          ts,
          kind: 'tool_use',
          parentId: callId,
          toolUseId: callId,
          toolName: 'Patch',
          input: { changes },
        });
        push({
          id: `${callId}-result`,
          ts,
          kind: 'tool_result',
          toolUseId: callId,
          output: stdout || stderr || (success ? 'Patch applied' : 'Patch failed'),
          isError: !success,
        });
        break;
      }
      case 'web_search_end': {
        const callId = asString(p.call_id) || newId('search');
        const action = (p as { action?: { query?: string } }).action;
        const query = action?.query ?? '';
        push({
          id: `${callId}-use`,
          ts,
          kind: 'tool_use',
          parentId: callId,
          toolUseId: callId,
          toolName: 'WebSearch',
          input: { query },
        });
        break;
      }
      case 'item_completed': {
        const item = (p as { item?: { id?: string; type?: string; text?: string } }).item;
        if (!item) break;
        const itemType = asString(item.type);
        if (itemType === 'Plan') {
          push({
            id: asString(item.id) || newId('plan'),
            ts,
            kind: 'system',
            text: `Plan: ${asString(item.text)}`,
          });
        }
        break;
      }
      case 'turn_aborted': {
        push({
          id: newId('aborted'),
          ts,
          kind: 'system',
          text: `Turn aborted (${asString((p as { reason?: string }).reason) || 'unknown'})`,
        });
        break;
      }
      default:
        break;
    }
  }

  return messages;
}
