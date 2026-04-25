import fs from 'fs';
import path from 'path';
import os from 'os';

export interface Usage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

export type Message =
  | { id: string; ts: number; kind: 'user'; text: string }
  | { id: string; ts: number; kind: 'assistant'; text: string; model: string; usage?: Usage }
  | {
      id: string;
      ts: number;
      kind: 'tool_use';
      parentId: string;
      toolUseId: string;
      toolName: string;
      input: any;
    }
  | {
      id: string;
      ts: number;
      kind: 'tool_result';
      toolUseId: string;
      output: string;
      isError?: boolean;
    }
  | { id: string; ts: number; kind: 'system'; text: string };

// Claude Code encodes the absolute project path by replacing every "/" with "-",
// including the leading slash. /home/user/foo → -home-user-foo.
function encodePath(projectPath: string): string {
  return projectPath.replace(/\//g, '-');
}

export function getSessionJsonlPath(projectPath: string, claudeSessionId: string): string {
  const claudeProjectsDir = path.join(os.homedir(), '.claude', 'projects');
  return path.join(claudeProjectsDir, encodePath(projectPath), `${claudeSessionId}.jsonl`);
}

// Strip Claude's injected <system-reminder>, <ide_selection>, etc. so the
// returned text is only what the user actually typed.
function stripContextWrappers(text: string): string {
  let t = text;
  t = t.replace(/<[a-z][a-z0-9_-]*>[\s\S]*?<\/[a-z][a-z0-9_-]*>/gi, '');
  t = t.replace(/<[a-z][a-z0-9_-]*[^>]*\/>/gi, '');
  return t.trim();
}

function parseTs(v: unknown): number {
  if (typeof v !== 'string') return 0;
  const n = Date.parse(v);
  return isNaN(n) ? 0 : n;
}

function toolResultToString(output: any): string {
  if (typeof output === 'string') return output;
  if (Array.isArray(output)) {
    return output
      .map((b) => {
        if (typeof b === 'string') return b;
        if (b?.type === 'text' && typeof b.text === 'string') return b.text;
        if (b?.type === 'image') return '[image]';
        return '';
      })
      .join('');
  }
  if (output && typeof output === 'object') {
    try {
      return JSON.stringify(output, null, 2);
    } catch {
      return '';
    }
  }
  return '';
}

export function parseTranscriptContent(content: string): Message[] {
  const messages: Message[] = [];
  const lines = content.split('\n');
  let fallbackCounter = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let entry: any;
    try {
      entry = JSON.parse(trimmed);
    } catch {
      continue;
    }
    const ts = parseTs(entry.timestamp);
    const parentUuid = typeof entry.uuid === 'string' && entry.uuid ? entry.uuid : `gen-${fallbackCounter++}`;

    if (entry.type === 'user' && entry.message) {
      const msgContent = entry.message.content;
      if (typeof msgContent === 'string') {
        const text = stripContextWrappers(msgContent);
        if (text) messages.push({ id: parentUuid, ts, kind: 'user', text });
      } else if (Array.isArray(msgContent)) {
        let blockIdx = 0;
        for (const block of msgContent) {
          if (!block || typeof block !== 'object') continue;
          if (block.type === 'tool_result') {
            messages.push({
              id: `${parentUuid}-r${blockIdx++}`,
              ts,
              kind: 'tool_result',
              toolUseId: block.tool_use_id || '',
              output: toolResultToString(block.content),
              isError: !!block.is_error,
            });
          } else if (block.type === 'text' && typeof block.text === 'string') {
            const text = stripContextWrappers(block.text);
            if (text) {
              messages.push({
                id: `${parentUuid}-t${blockIdx++}`,
                ts,
                kind: 'user',
                text,
              });
            }
          }
        }
      }
    } else if (entry.type === 'assistant' && entry.message) {
      const msgContent = entry.message.content;
      const model = typeof entry.message.model === 'string' ? entry.message.model : '';
      const usage: Usage | undefined = entry.message.usage;
      let blockIdx = 0;
      let usageAttached = false;
      if (Array.isArray(msgContent)) {
        for (const block of msgContent) {
          if (!block || typeof block !== 'object') continue;
          if (block.type === 'text' && typeof block.text === 'string') {
            if (block.text.trim()) {
              const attachUsage = !usageAttached && !!usage;
              messages.push({
                id: `${parentUuid}-t${blockIdx++}`,
                ts,
                kind: 'assistant',
                text: block.text,
                model,
                usage: attachUsage ? usage : undefined,
              });
              if (attachUsage) usageAttached = true;
            }
          } else if (block.type === 'tool_use') {
            messages.push({
              id: `${parentUuid}-u${blockIdx++}`,
              ts,
              kind: 'tool_use',
              parentId: parentUuid,
              toolUseId: typeof block.id === 'string' ? block.id : '',
              toolName: typeof block.name === 'string' ? block.name : '',
              input: block.input ?? {},
            });
          }
        }
        // Assistant turn had only tool_use blocks — attach usage to a
        // zero-text assistant marker so cost shows up. Skip if nothing.
        if (!usageAttached && usage && blockIdx > 0) {
          messages.push({
            id: `${parentUuid}-u`,
            ts,
            kind: 'assistant',
            text: '',
            model,
            usage,
          });
        }
      } else if (typeof msgContent === 'string' && msgContent.trim()) {
        messages.push({ id: parentUuid, ts, kind: 'assistant', text: msgContent, model, usage });
      }
    } else if (entry.type === 'system') {
      const text = typeof entry.content === 'string' ? entry.content.trim() : '';
      if (text) messages.push({ id: parentUuid, ts, kind: 'system', text });
    }
  }
  return messages;
}

export interface ParseResult {
  messages: Message[];
  endOffset: number;
}

// Read a JSONL file from the given byte offset to EOF, parse complete lines
// only, and return both the messages and the new end offset (on a line
// boundary). Callers should pass the returned endOffset back on the next call
// to get only newly-appended entries.
export function parseTranscript(jsonlPath: string, fromOffset = 0): ParseResult {
  let fd: number;
  try {
    fd = fs.openSync(jsonlPath, 'r');
  } catch {
    return { messages: [], endOffset: 0 };
  }
  try {
    const stat = fs.fstatSync(fd);
    const start = Math.max(0, Math.min(fromOffset, stat.size));
    if (start >= stat.size) return { messages: [], endOffset: stat.size };
    const length = stat.size - start;
    const buf = Buffer.alloc(length);
    fs.readSync(fd, buf, 0, length, start);
    const content = buf.toString('utf8');
    const lastNewline = content.lastIndexOf('\n');
    if (lastNewline < 0) {
      // No complete line in this window yet — don't advance.
      return { messages: [], endOffset: start };
    }
    const completeContent = content.slice(0, lastNewline + 1);
    const endOffset = start + Buffer.byteLength(completeContent, 'utf8');
    return { messages: parseTranscriptContent(completeContent), endOffset };
  } finally {
    try {
      fs.closeSync(fd);
    } catch {}
  }
}
