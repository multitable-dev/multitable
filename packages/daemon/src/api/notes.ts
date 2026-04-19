import { Router } from 'express';
import type { Request, Response } from 'express';
import { spawn } from 'child_process';
import {
  listNotesForSession,
  listProjectNotes,
  getNote,
  createNote,
  updateNote,
  deleteNote,
} from '../db/store.js';
import type { NoteScope } from '../db/store.js';

const REFINE_TIMEOUT_MS = 30000;

// System prompt for the refine action. The AI only sees the note content —
// no session history, no project context, no files. Output is plain text.
const REFINE_SYSTEM = [
  'You rewrite rough brainstorm notes into clear, actionable prompts that a coding assistant can execute.',
  'Preserve the author\'s intent. Keep the same scope — do not invent features they did not mention.',
  'Output only the refined prompt, with no preamble, explanation, or markdown fences.',
  'Structure the prompt with clear sections when useful (goal, constraints, acceptance criteria), but keep it concise.',
].join(' ');

function refineWithClaude(content: string): Promise<string | null> {
  const prompt = `${REFINE_SYSTEM}\n\nNote:\n${content}\n\nRefined prompt:`;
  return new Promise((resolve) => {
    let child: ReturnType<typeof spawn>;
    const timeout = setTimeout(() => {
      try { child.kill(); } catch {}
      resolve(null);
    }, REFINE_TIMEOUT_MS);

    try {
      child = spawn('claude', ['--model', 'claude-haiku-4-5', '--print', prompt]);
    } catch {
      clearTimeout(timeout);
      resolve(null);
      return;
    }

    let output = '';
    child.stdout?.on('data', (d: Buffer) => { output += d.toString(); });
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

export function createNotesRouter(): Router {
  const router = Router();

  // GET /api/notes?sessionId=... (returns session-scoped + project-scoped)
  // GET /api/notes?projectId=... (returns project-scoped only)
  router.get('/', (req: Request, res: Response) => {
    const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : '';
    const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : '';

    if (sessionId && projectId) {
      return res.json({ notes: listNotesForSession(sessionId, projectId) });
    }
    if (projectId) {
      return res.json({ notes: listProjectNotes(projectId) });
    }
    res.status(400).json({ error: 'sessionId+projectId or projectId is required' });
  });

  // POST /api/notes { projectId, sessionId?, scope, title?, content? }
  router.post('/', (req: Request, res: Response) => {
    const { projectId, sessionId, scope, title, content } = req.body || {};
    if (!projectId || (scope !== 'session' && scope !== 'project')) {
      return res.status(400).json({ error: 'projectId and valid scope are required' });
    }
    if (scope === 'session' && !sessionId) {
      return res.status(400).json({ error: 'sessionId required for session-scope notes' });
    }
    const note = createNote({
      projectId,
      sessionId: sessionId ?? null,
      scope: scope as NoteScope,
      title,
      content,
    });
    res.json(note);
  });

  // PUT /api/notes/:id
  router.put('/:id', (req: Request, res: Response) => {
    const { title, content, scope, sessionId } = req.body || {};
    const updated = updateNote(req.params.id, {
      title,
      content,
      scope: scope === 'session' || scope === 'project' ? scope : undefined,
      sessionId,
    });
    if (!updated) return res.status(404).json({ error: 'Note not found' });
    res.json(updated);
  });

  // DELETE /api/notes/:id
  router.delete('/:id', (req: Request, res: Response) => {
    deleteNote(req.params.id);
    res.status(204).send();
  });

  // POST /api/notes/:id/refine — rewrites the note's content into a refined
  // prompt via a Haiku call. Does NOT auto-save; returns the suggestion so
  // the user can review and accept/reject from the UI.
  router.post('/:id/refine', async (req: Request, res: Response) => {
    const note = getNote(req.params.id);
    if (!note) return res.status(404).json({ error: 'Note not found' });
    if (!note.content.trim()) {
      return res.status(400).json({ error: 'Note is empty — add content before refining' });
    }

    const refined = await refineWithClaude(note.content);
    if (!refined) {
      return res.status(502).json({ error: 'AI refine failed or timed out' });
    }
    res.json({ refined, original: note.content });
  });

  return router;
}
