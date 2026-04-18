import { spawn } from 'child_process';

export async function generateSessionLabel(userMessages: string[]): Promise<string | null> {
  if (!userMessages || userMessages.length === 0) return null;

  const prompt = `Summarize what this user is working on in one sentence (max 12 words):\n\n${userMessages.join('\n---\n')}`;

  return new Promise((resolve) => {
    let child: ReturnType<typeof spawn>;

    const timeout = setTimeout(() => {
      try { child.kill(); } catch {}
      resolve(null);
    }, 10000);

    try {
      child = spawn('claude', ['--model', 'claude-haiku-4-5', '--print', prompt]);
    } catch {
      clearTimeout(timeout);
      resolve(null);
      return;
    }

    let output = '';

    child.stdout?.on('data', (d: Buffer) => {
      output += d.toString();
    });

    child.on('close', () => {
      clearTimeout(timeout);
      resolve(output.trim() || null);
    });

    child.on('error', () => {
      clearTimeout(timeout);
      resolve(null);
    });
  });
}
