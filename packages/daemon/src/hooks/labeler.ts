import { spawn } from 'child_process';
import os from 'os';

export interface LabelResult {
  ok: true;
  title: string;
}

export interface LabelError {
  ok: false;
  error: string;
}

const SYSTEM_PROMPT = [
  'You generate short titles for coding-agent sessions.',
  'Read the user prompts and output ONE title that captures what the user is working on.',
  'Constraints: max 6 words, max 50 characters. No preamble, no quotes, no trailing punctuation, no markdown.',
  'Output the title and nothing else.',
].join(' ');

const TIMEOUT_MS = 30_000;
// Cap how much we send to Haiku so a long-running session doesn't blow past
// argv limits or pad the prompt with stale context that drowns out the topic.
const MAX_PROMPTS = 8;
const MAX_PROMPT_CHARS = 500;

export async function generateSessionLabel(
  userMessages: string[]
): Promise<LabelResult | LabelError> {
  if (!userMessages || userMessages.length === 0) {
    return { ok: false, error: 'No prompts to summarize' };
  }

  const trimmed = userMessages
    .slice(0, MAX_PROMPTS)
    .map((m) => (m.length > MAX_PROMPT_CHARS ? m.slice(0, MAX_PROMPT_CHARS) + '…' : m));
  const prompt = `User prompts:\n- ${trimmed.join('\n- ')}\n\nTitle:`;

  return new Promise((resolve) => {
    let child: ReturnType<typeof spawn>;
    let resolved = false;
    const finish = (value: LabelResult | LabelError) => {
      if (resolved) return;
      resolved = true;
      resolve(value);
    };

    const timeout = setTimeout(() => {
      try {
        child?.kill();
      } catch {}
      finish({ ok: false, error: `claude CLI timed out after ${TIMEOUT_MS / 1000}s` });
    }, TIMEOUT_MS);

    try {
      // Spawn from os.tmpdir() so the project's CLAUDE.md isn't injected and
      // tilt the agent toward conversational responses. --system-prompt
      // replaces the default coding-agent prompt with the title-only one.
      child = spawn(
        'claude',
        [
          '--model', 'claude-haiku-4-5',
          '--system-prompt', SYSTEM_PROMPT,
          '--print', prompt,
        ],
        { cwd: os.tmpdir() }
      );
    } catch (err: any) {
      clearTimeout(timeout);
      finish({ ok: false, error: `Failed to spawn claude: ${err?.message || err}` });
      return;
    }

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (d: Buffer) => {
      stdout += d.toString();
    });
    child.stderr?.on('data', (d: Buffer) => {
      stderr += d.toString();
    });

    child.on('close', (code) => {
      clearTimeout(timeout);
      const out = stdout.trim();
      if (out) {
        finish({ ok: true, title: out });
        return;
      }
      const reason = stderr.trim() || `claude exited with code ${code ?? 'null'} and no output`;
      console.error('[labeler] empty stdout:', reason);
      finish({ ok: false, error: reason });
    });

    child.on('error', (err) => {
      clearTimeout(timeout);
      console.error('[labeler] spawn error:', err);
      finish({ ok: false, error: err.message || 'claude CLI failed to start' });
    });
  });
}
