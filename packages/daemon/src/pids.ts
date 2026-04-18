import fs from 'fs';
import path from 'path';
import { getConfigDir } from './config/loader.js';

function getPidsPath(): string {
  return path.join(getConfigDir(), 'pids.json');
}

export function readPids(): Record<string, number> {
  try {
    const content = fs.readFileSync(getPidsPath(), 'utf8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

export function writePids(pids: Record<string, number>): void {
  const dir = getConfigDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(getPidsPath(), JSON.stringify(pids, null, 2), 'utf8');
}

export function addPid(processId: string, pid: number): void {
  const pids = readPids();
  pids[processId] = pid;
  writePids(pids);
}

export function removePid(processId: string): void {
  const pids = readPids();
  delete pids[processId];
  writePids(pids);
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function checkOrphanedPids(): Array<{ processId: string; pid: number }> {
  const pids = readPids();
  const orphaned: Array<{ processId: string; pid: number }> = [];

  for (const [processId, pid] of Object.entries(pids)) {
    if (isProcessAlive(pid)) {
      orphaned.push({ processId, pid });
    } else {
      // Clean up dead PID entry
      delete pids[processId];
    }
  }

  // Write back cleaned pids
  writePids(pids);

  return orphaned;
}
