export type AttachmentKind = 'session' | 'terminal';

export interface UploadResult {
  path: string;
  filename: string;
  size: number;
}

export async function uploadAttachment(
  kind: AttachmentKind,
  id: string,
  file: File | Blob,
  filename?: string,
): Promise<UploadResult> {
  const name = filename ?? (file as File).name ?? 'image';
  const url = `/api/${kind}s/${encodeURIComponent(id)}/attachments`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'X-Filename': encodeURIComponent(name),
    },
    body: file,
  });

  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const data = await res.json();
      if (data?.error) msg = data.error;
    } catch {
      // response was not JSON — keep the status/statusText fallback
    }
    throw new Error(msg);
  }

  return (await res.json()) as UploadResult;
}

// Quote a path for safe injection into a shell-like prompt:
// - if it has no spaces / special chars, return as-is
// - otherwise wrap in single quotes and escape any embedded single quote
export function quotePath(p: string): string {
  if (/^[A-Za-z0-9._\-/]+$/.test(p)) return p;
  return `'${p.replace(/'/g, `'\\''`)}'`;
}
