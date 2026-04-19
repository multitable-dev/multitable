import fs from 'fs';
import path from 'path';

// Claude Code hook format:
// { "hooks": { "SessionStart": [{ "matcher": "", "hooks": [{ "type": "command", "command": "..." }] }] } }
interface HookCommand {
  type: 'command';
  command: string;
}

interface HookMatcherGroup {
  matcher: string;
  hooks: HookCommand[];
}

interface ClaudeSettings {
  hooks?: Record<string, HookMatcherGroup[]>;
  [key: string]: any;
}

// All observational-safe Claude Code hook events. Every one either:
//   - accepts an empty {} response without changing behavior, or
//   - is ignored entirely (StopFailure, PermissionDenied, etc.)
//
// Intentionally skipped:
//   FileChanged   - matcher is a pipe-list of literal filenames, not "*".
//                   An empty matcher watches nothing, so registering here
//                   would be a no-op. Re-add per-project with explicit paths.
//   WorktreeCreate - stdout is consumed as the worktree path, and any
//                    non-zero exit fails creation. Safer to leave unhooked
//                    until we have a real worktree flow to wire up.
const HOOK_EVENTS = [
  // Session & context
  'SessionStart',
  'SessionEnd',
  'InstructionsLoaded',
  'UserPromptSubmit',
  'PreCompact',
  'PostCompact',
  // Tool lifecycle
  'PreToolUse',
  'PostToolUse',
  'PostToolUseFailure',
  'PermissionRequest',
  'PermissionDenied',
  // Agent & task
  'SubagentStart',
  'SubagentStop',
  'TaskCreated',
  'TaskCompleted',
  'TeammateIdle',
  // Turn
  'Stop',
  'StopFailure',
  // Observability
  'Notification',
  'ConfigChange',
  'CwdChanged',
  // Worktree
  'WorktreeRemove',
  // MCP
  'Elicitation',
  'ElicitationResult',
] as const;

function eventToEndpoint(event: string): string {
  return event
    .replace(/([A-Z])/g, (m, c, i) => (i > 0 ? '-' : '') + c.toLowerCase())
    .replace(/^-/, '');
}

function buildHookCommand(event: string, port: number): string {
  const endpoint = eventToEndpoint(event);
  // Claude Code pipes hook data JSON to stdin; curl reads it with @-
  return `curl -s -X POST http://localhost:${port}/api/hooks/${endpoint} -H 'Content-Type: application/json' -d @-`;
}

function hookCommandMatchesUs(command: string, port: number): boolean {
  return command.includes(`localhost:${port}/api/hooks/`);
}

export class HookManager {
  async installForProject(projectPath: string, port: number): Promise<void> {
    const claudeDir = path.join(projectPath, '.claude');
    const settingsPath = path.join(claudeDir, 'settings.json');

    fs.mkdirSync(claudeDir, { recursive: true });

    let settings: ClaudeSettings = {};
    try {
      const content = fs.readFileSync(settingsPath, 'utf8');
      settings = JSON.parse(content);
    } catch {
      settings = {};
    }

    if (!settings.hooks) settings.hooks = {};

    let changed = false;

    for (const event of HOOK_EVENTS) {
      const command = buildHookCommand(event, port);

      if (!Array.isArray(settings.hooks[event])) {
        settings.hooks[event] = [];
      }

      const groups = settings.hooks[event] as HookMatcherGroup[];

      // Check if our hook command already exists in any matcher group
      const alreadyInstalled = groups.some((g) =>
        g.hooks?.some((h) => h.type === 'command' && hookCommandMatchesUs(h.command, port))
      );

      if (!alreadyInstalled) {
        // Add as a catch-all matcher group (empty matcher = match everything)
        groups.push({
          matcher: '',
          hooks: [{ type: 'command', command }],
        });
        changed = true;
      }
    }

    if (changed) {
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
    }

    this.ensureGitignoreEntry(projectPath, '.claude/settings.json');
  }

  async removeForProject(projectPath: string, port: number): Promise<void> {
    const settingsPath = path.join(projectPath, '.claude', 'settings.json');

    let settings: ClaudeSettings = {};
    try {
      const content = fs.readFileSync(settingsPath, 'utf8');
      settings = JSON.parse(content);
    } catch {
      return;
    }

    if (!settings.hooks) return;

    let changed = false;

    for (const event of HOOK_EVENTS) {
      if (!Array.isArray(settings.hooks[event])) continue;

      const groups = settings.hooks[event] as HookMatcherGroup[];
      const before = groups.length;

      // Remove matcher groups that contain our hook command
      settings.hooks[event] = groups.filter((g) =>
        !g.hooks?.some((h) => h.type === 'command' && hookCommandMatchesUs(h.command, port))
      );

      if ((settings.hooks[event] as HookMatcherGroup[]).length !== before) changed = true;
    }

    if (changed) {
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
    }
  }

  private ensureGitignoreEntry(projectPath: string, entry: string): void {
    const gitignorePath = path.join(projectPath, '.gitignore');
    let content = '';

    try {
      content = fs.readFileSync(gitignorePath, 'utf8');
    } catch {}

    const lines = content.split('\n');
    if (!lines.some((l) => l.trim() === entry)) {
      const newContent = content + (content.endsWith('\n') || content === '' ? '' : '\n') + entry + '\n';
      try {
        fs.writeFileSync(gitignorePath, newContent, 'utf8');
      } catch {}
    }
  }
}
