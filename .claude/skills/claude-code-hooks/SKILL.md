---
name: claude-code-hooks
description: Author, read, debug, and modify Claude Code hooks — the user-defined shell commands, HTTP endpoints, or LLM prompts that run automatically at lifecycle events like PreToolUse, PostToolUse, Stop, SessionStart, UserPromptSubmit, and many more. Use this skill whenever the user mentions "hooks", "Claude Code hooks", a `.claude/settings.json` hooks block, auto-formatting on edit, blocking dangerous commands, Stop/PreToolUse/PostToolUse/SessionStart/etc., hook input JSON, `hookSpecificOutput`, `permissionDecision`, exit code 2 behavior, `CLAUDE_PROJECT_DIR` in hook scripts, or wants to guard, observe, or automate anything at a specific point in Claude Code's execution. Also use when the user asks to write a script that "runs before/after" a tool call, runs "when Claude finishes", or wants deterministic guardrails the model can't ignore.
---

# Claude Code Hooks

Hooks are the deterministic-control layer for Claude Code. A settings entry binds a **hook event** (when it fires) to a **matcher group** (which cases it applies to) to one or more **hook handlers** (what runs). When the event fires and the matcher matches, Claude Code serializes context as JSON, hands it to the handler, and acts on the handler's response.

Unlike instructions in CLAUDE.md, hooks always execute. That's the whole point: use them for the things the model must not forget or skip.

## When to reach for which event

Most hook work lands on one of six events. If a request fits one of these, start here; reach for `references/events.md` for the full list.

- **PreToolUse** — runs *before* a tool call. Can block, allow, ask, or rewrite the input. Use for guardrails (block `rm -rf`, protect `.env`, enforce branch policy).
- **PostToolUse** — runs *after* a tool call succeeds. Cannot block (it already ran), but can feed stderr back to Claude. Use for formatters, linters, auto-stage, cost tracking.
- **UserPromptSubmit** — runs when the user hits enter, before Claude sees the prompt. Can block the prompt or inject extra context. Use for redacting secrets, adding project state, blocking dangerous asks.
- **SessionStart** — runs when a session begins, resumes, clears, or recovers from compaction. Use to inject dynamic context (recent commits, current sprint) or persist env vars via `CLAUDE_ENV_FILE`.
- **Stop** — runs when Claude thinks it's done. Can send Claude back with feedback ("tests still failing, keep going"). Use for test/lint gates before a turn ends.
- **Notification** — runs when Claude Code surfaces a notification (waiting for input, permission prompt). Use for desktop alerts, Slack/Discord pings.

For the other 20-ish events (PermissionRequest, PermissionDenied, SubagentStart/Stop, TaskCreated/Completed, ConfigChange, CwdChanged, FileChanged, InstructionsLoaded, PreCompact/PostCompact, WorktreeCreate/Remove, Elicitation/ElicitationResult, SessionEnd, StopFailure, PostToolUseFailure, TeammateIdle), read `references/events.md`.

## Configuration anatomy

Hooks live in settings JSON. The nesting is the thing people get wrong most often — there are two `hooks` keys, not one.

```json
{
  "hooks": {                         // ← outer: the hooks map on the settings object
    "PreToolUse": [                  // ← event name
      {
        "matcher": "Bash",           // ← matcher group
        "hooks": [                   // ← inner: list of handlers for this group
          {
            "type": "command",
            "command": "/path/to/script.sh"
          }
        ]
      }
    ]
  }
}
```

**Where to put it** (narrowest wins in conflict, but all matching hooks run):

| Location | Scope |
|---|---|
| `~/.claude/settings.json` | All projects, your machine only |
| `.claude/settings.json` | One project, committed to repo |
| `.claude/settings.local.json` | One project, gitignored |
| Plugin `hooks/hooks.json` | When plugin is enabled |
| Skill/agent frontmatter | While component is active |

When adding a hook to a settings file that already has a `hooks` key, add the new event *inside* the existing `hooks` object — don't replace the whole block. This is the #1 mistake.

## Matcher rules (surprising edge cases)

The matcher filters *which* tool/event variant triggers the handler. Its syntax depends on the characters in the string:

- `"*"`, `""`, or omitted → matches everything
- Only letters, digits, `_`, `|` → exact string or pipe-separated list of exact strings (`Bash`, `Edit|Write`)
- Any other character → JavaScript regex (`^Notebook`, `mcp__memory__.*`)

Two pitfalls worth calling out:

1. **MCP tools need `.*` suffix.** `mcp__memory` contains only letters and underscores, so it's an exact match — and matches nothing, because real MCP tool names look like `mcp__memory__create_entities`. Always write `mcp__memory__.*` to match a whole server.
2. **Some events ignore matchers entirely.** `UserPromptSubmit`, `Stop`, `TeammateIdle`, `TaskCreated`, `TaskCompleted`, `WorktreeCreate`, `WorktreeRemove`, and `CwdChanged` always fire on every occurrence. A matcher on these is silently ignored.

For finer filtering on tool events, add the optional `if` field on the handler itself. It uses permission-rule syntax:

```json
{
  "type": "command",
  "if": "Bash(git *)",
  "command": "./hooks/git-guard.sh"
}
```

`if` is evaluated *after* the matcher and *before* spawning the process. It's how you avoid a shell process every single time Bash runs when you only care about `git` commands. `if` only applies to tool events — on other events a handler with `if` set will never run.

## Hook handler types

Four handler types, same frontmatter shape plus type-specific fields. `type: "command"` covers 90% of real use. Common fields on every type: `type`, `if`, `timeout`, `statusMessage`, `once`.

### `type: "command"` — shell command

Receives event JSON on stdin, communicates via exit code + stdout + stderr.

Extra fields: `command` (required), `async` (runs in background, doesn't block), `asyncRewake` (background + wakes Claude on exit 2 with stderr as a system reminder), `shell` (`bash` default or `powershell`).

### `type: "http"` — POST to a URL

Sends the same event JSON as the POST body. Returns decisions in the response body using the same JSON schema as command hooks.

Extra fields: `url` (required), `headers`, `allowedEnvVars` (whitelist for `$VAR` interpolation in header values — required for interpolation to work).

**Gotcha:** HTTP hooks can't signal blocking via status code. A 500 is just a non-blocking error. To actually block, return 2xx with a JSON body containing `decision: "block"` or `permissionDecision: "deny"`.

### `type: "prompt"` — LLM evaluation

Sends a prompt to a fast Claude model, substituting `$ARGUMENTS` with the event JSON. Model returns a JSON decision. Use when deterministic rules are too brittle — "is this commit message informative?", "does this test actually test something?"

Extra fields: `prompt` (required), `model`.

### `type: "agent"` — subagent with tools

Spawns a subagent with Read/Grep/Glob/etc. access. Multi-turn, can inspect files before deciding. Slower and pricier than prompt hooks; use when the hook needs to actually investigate something.

Extra fields: `prompt` (required), `model`.

## Input and output

### Input (common fields on every event)

```json
{
  "session_id": "abc123",
  "transcript_path": "/.../transcript.jsonl",
  "cwd": "/home/user/project",
  "permission_mode": "default",
  "hook_event_name": "PreToolUse"
}
```

Command hooks get this on stdin; HTTP hooks get it as the POST body. Event-specific fields are layered on top (e.g. `tool_name` + `tool_input` for tool events, `prompt` for UserPromptSubmit, `source` + `model` for SessionStart). Inside a subagent call, `agent_id` and `agent_type` also appear.

### Output — two mutually exclusive styles

**Style 1: exit codes + stderr (simple allow/block).** Exit 0 means "proceed, maybe with stdout as context." Exit 2 means "block, show stderr to Claude/user." Any other non-zero exit code is a non-blocking error — the action proceeds and the transcript shows a `<hook> hook error` notice.

Exit 2 behavior depends on the event. `PreToolUse` blocks the tool, `UserPromptSubmit` erases the prompt, `Stop` forces Claude to continue, `PostToolUse` just surfaces stderr to Claude (can't unblock the past). The full table is in `references/events.md`.

**Style 2: exit 0 + JSON on stdout (fine-grained control).** Different events read different fields:

- `PreToolUse` → `hookSpecificOutput.permissionDecision` (`allow` | `deny` | `ask` | `defer`) with `permissionDecisionReason`. Can also include `hookSpecificOutput.updatedInput` to rewrite the tool call before it runs.
- `PermissionRequest` → `hookSpecificOutput.decision.behavior` (`allow` | `deny`) with optional `updatedInput` or `updatedPermissions`.
- `UserPromptSubmit`, `PostToolUse`, `PostToolUseFailure`, `Stop`, `SubagentStop`, `ConfigChange`, `PreCompact` → top-level `decision: "block"` with `reason`.
- `SessionStart`, `UserPromptSubmit` → `hookSpecificOutput.additionalContext` to inject text into the conversation.

Universal JSON fields that work on any event: `continue` (set to `false` to halt Claude entirely), `stopReason` (shown to user when continuing is halted), `suppressOutput`, `systemMessage`.

**Do not mix the two styles.** If you exit 2, Claude Code ignores any JSON you wrote. Either signal with an exit code *or* exit 0 and print JSON.

Context injected via `additionalContext`, `systemMessage`, or plain stdout is capped at 10,000 characters. Over the limit, it's spilled to a file and replaced with a preview.

## Writing hook scripts — the idioms

A minimal block-on-pattern `PreToolUse` command hook:

```bash
#!/bin/bash
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if echo "$COMMAND" | grep -qE 'rm -rf( /|$| ~)'; then
  echo "Blocked: destructive rm -rf pattern" >&2
  exit 2
fi
exit 0
```

The same thing with structured output instead of exit 2 (lets you send a richer reason):

```bash
#!/bin/bash
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if echo "$COMMAND" | grep -qE 'rm -rf( /|$| ~)'; then
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "Destructive rm -rf pattern blocked by hook"
    }
  }'
  exit 0
fi
exit 0
```

A `PostToolUse` formatter that runs on every file edit:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "jq -r '.tool_input.file_path' | xargs -r npx prettier --write"
          }
        ]
      }
    ]
  }
}
```

A `SessionStart` hook that re-injects context after compaction only:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "compact",
        "hooks": [
          {
            "type": "command",
            "command": "echo 'Reminder: bun, not npm. Current branch: $(git branch --show-current)'"
          }
        ]
      }
    ]
  }
}
```

## Referencing scripts by path

Relative paths break when Claude `cd`s around. Always anchor scripts with one of these env vars:

- `$CLAUDE_PROJECT_DIR` — project root. Wrap in quotes: `"\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/guard.sh"`.
- `${CLAUDE_PLUGIN_ROOT}` — plugin install dir (changes each update; bundled scripts go here).
- `${CLAUDE_PLUGIN_DATA}` — plugin persistent data dir (survives updates).

`$CLAUDE_ENV_FILE` is only available in `SessionStart`, `CwdChanged`, and `FileChanged` hooks. Append `export VAR=value` lines to it to persist env vars for subsequent Bash tool calls.

## Debugging

When a hook seems not to fire or misbehaves:

1. **Check `/hooks`** in Claude Code — the read-only browser shows every hook that loaded, from which source file, with the full resolved command. If your hook isn't there, the JSON didn't parse or the path is wrong.
2. **Run `claude --debug`** — stderr and hook output go to the debug log. The first line of stderr is also shown in the transcript as a `<name> hook error` notice when a hook exits with a non-blocking error.
3. **Log the input** — `cat >> /tmp/hook-input.log` at the top of a script captures exactly what Claude Code sends, which is the fastest way to debug matcher and field issues.
4. **Check executable bit** — on macOS/Linux, `chmod +x` the script or the command will fail silently.
5. **Watch for stray stdout** — if your shell profile prints a greeting, it'll corrupt JSON output. Hook scripts should be careful about what they emit. One stray `echo "done"` in a PreToolUse hook that's supposed to output JSON will break parsing.

For a `Stop` hook that loops forever, remember: exit 2 on Stop means "don't stop yet" — Claude keeps going and may hit Stop again, which runs your hook again. Always have a terminating condition (e.g., check a counter in a file, or `jq -r '.stop_hook_active'` in the input and bail if it's already true).

## Security

Hooks run with your full user permissions. No sandbox. A bad hook can delete files, exfiltrate secrets, or brick your shell. Treat hook scripts like production code:

- **Quote variables.** `"$FILE_PATH"`, not `$FILE_PATH`. Tool inputs can contain spaces or shell metacharacters.
- **Use `jq` to parse JSON**, not regex or shell substring tricks. Claude Code's input is JSON and `jq -r` handles escaping correctly.
- **Validate file paths before acting on them.** A `PostToolUse` hook that blindly runs `rm` on `.tool_input.file_path` is a footgun.
- **Don't echo secrets to stdout** — on `UserPromptSubmit` and `SessionStart`, stdout becomes context and flows into the conversation transcript.
- **Prefer project-scoped `.claude/settings.json`** for team-shared guardrails so everyone gets them via git. Reserve `settings.local.json` for personal tweaks.
- **For orgs:** `allowManagedHooksOnly` in managed policy settings blocks user/project/local hooks, letting admins distribute vetted hooks only via plugins in `enabledPlugins`.

## Step-by-step: the common tasks

### Create a new hook

1. Decide the event. If in doubt, skim the "When to reach for which event" section above or `references/events.md`.
2. Write the handler. For anything non-trivial, put it in `.claude/hooks/<name>.sh` and `chmod +x` it. Trivial one-liners can inline in the JSON.
3. Add the JSON to the right settings file (project vs. user vs. local — see the scope table).
4. If there's already a `hooks` key, add your event *inside* it. Don't overwrite.
5. Reference the script with `$CLAUDE_PROJECT_DIR` or `${CLAUDE_PLUGIN_ROOT}`, never a relative path.
6. Open `/hooks` in Claude Code to confirm it loaded. Trigger the event to test.

### Read / audit existing hooks

1. Look at `~/.claude/settings.json`, `.claude/settings.json`, and `.claude/settings.local.json` in order.
2. Check `.claude/hooks/` or wherever scripts are stored for the actual handler code.
3. For plugin-defined hooks, look inside the plugin's `hooks/hooks.json`.
4. For skill/agent-defined hooks, the frontmatter is in the skill's `SKILL.md` or agent file.
5. Running Claude Code is not required — you can audit statically — but `/hooks` is the most authoritative view of what's actually loaded.

### Debug a misbehaving hook

Follow the Debugging section above. Start with `/hooks` and logging input to `/tmp`.

### Disable hooks temporarily

Set `"disableAllHooks": true` in a settings file. No way to disable one individual hook while keeping the config — comment it out by removing the entry, or guard the script itself with an env-var check.

## What goes in `references/`

- `references/events.md` — full table of all 25+ hook events with their matchers, input schemas, decision patterns, and exit-code behavior. Read this when the request involves an event not in the "big six" above, or when you need the exact JSON field names for a specific event.
