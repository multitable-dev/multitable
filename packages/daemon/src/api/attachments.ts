import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { getDataDir } from '../config/loader.js';

const MAX_BYTES = 20 * 1024 * 1024;

const ALLOWED_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/bmp': '.bmp',
  'image/svg+xml': '.svg',
  'image/heic': '.heic',
  'image/heif': '.heif',
  'image/avif': '.avif',
};

function attachmentsRoot(): string {
  return path.join(getDataDir(), 'attachments');
}

export function attachmentDirFor(id: string): string {
  return path.join(attachmentsRoot(), id);
}

export function removeAttachmentDir(id: string): void {
  try {
    fs.rmSync(attachmentDirFor(id), { recursive: true, force: true });
  } catch {
    // best-effort — swallow
  }
}

function sanitizeFilename(name: string): { base: string; ext: string } {
  const ext = path.extname(name).toLowerCase().replace(/[^a-z0-9.]/g, '');
  const base = path
    .basename(name, path.extname(name))
    .replace(/[^A-Za-z0-9._-]/g, '_')
    .slice(0, 80) || 'image';
  return { base, ext };
}

const rawParser = express.raw({
  type: () => true,
  limit: MAX_BYTES,
});

// express.raw() with a 20MB cap. Wraps the raw parser so a payload-too-large
// (or any other body-parser error) becomes a JSON response, matching the
// rest of the API rather than escaping to the default HTML error handler.
export function rawAttachmentBody(req: Request, res: Response, next: NextFunction): void {
  rawParser(req, res, (err?: any) => {
    if (!err) return next();
    const status = typeof err.status === 'number' ? err.status : 400;
    res.status(status).json({ error: err.message || 'Invalid upload' });
  });
}

export interface AttachmentTarget {
  // Returns an id if the resource exists, else null.
  resolve(id: string): string | null;
}

export function createAttachmentHandler(target: AttachmentTarget) {
  return (req: Request, res: Response) => {
    const id = target.resolve(req.params.id);
    if (!id) return res.status(404).json({ error: 'Not found' });

    const contentType = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (!contentType.startsWith('image/')) {
      return res.status(415).json({ error: 'Only image uploads are supported' });
    }

    const body = req.body;
    if (!body || !Buffer.isBuffer(body) || body.length === 0) {
      return res.status(400).json({ error: 'Empty upload' });
    }
    if (body.length > MAX_BYTES) {
      return res.status(413).json({ error: 'File too large' });
    }

    const headerName = req.headers['x-filename'];
    const rawName = typeof headerName === 'string' ? safeDecode(headerName) : '';
    const { base, ext: nameExt } = sanitizeFilename(rawName || 'image');
    const mimeExt = ALLOWED_EXT[contentType] ?? '';
    const ext = nameExt || mimeExt || '.bin';

    const dir = attachmentDirFor(id);
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed to create attachments dir' });
    }

    const filename = `${Date.now()}-${base}${ext}`;
    const fullPath = path.join(dir, filename);

    try {
      fs.writeFileSync(fullPath, body);
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed to write attachment' });
    }

    res.status(201).json({ path: fullPath, filename, size: body.length });
  };
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
