# Hook Events Reference

Complete reference for every Claude Code hook event: what it fires on, what matcher it supports, what input it receives, and how to control its outcome. The "big six" (PreToolUse, PostToolUse, UserPromptSubmit, SessionStart, Stop, Notification) are in the main SKILL.md with more narrative; this file is the flat lookup table for everything.

## Contents

- [Lifecycle overview](#lifecycle-overview)
- [Exit code 2 behavior per event](#exit-code-2-behavior-per-event)
- Session & context events: [SessionStart](#sessionstart), [SessionEnd](#sessionend), [InstructionsLoaded](#instructionsloaded), [UserPromptSubmit](#userpromptsubmit), [PreCompact](#precompact), [PostCompact](#postcompact)
- Tool lifecycle events: [PreToolUse](#pretooluse), [PostToolUse](#posttooluse), [PostToolUseFailure](#posttoolusefailure), [PermissionRequest](#permissionrequest), [PermissionDenied](#permissiondenied)
- Agent & task events: [SubagentStart](#subagentstart), [SubagentStop](#subagentstop), [TaskCreated](#taskcreated), [TaskCompleted](#taskcompleted), [TeammateIdle](#teammateidle)
- Turn events: [Stop](#stop), [StopFailure](#stopfailure)
- Observability events: [Notification](#notification), [ConfigChange](#configchange), [CwdChanged](#cwdchanged), [FileChanged](#filechanged)
- Worktree events: [WorktreeCreate](#worktreecreate), [WorktreeRemove](#worktreeremove)
- MCP events: [Elicitation](#elicitation), [ElicitationResult](#elicitationresult)

## Lifecycle overview

Events fall into three cadences:

- **Once per session**: `SessionStart`, `SessionEnd`
- **Once per turn**: `UserPromptSubmit`, `Stop`, `StopFailure`
- **Inside the agentic loop (every tool call)**: `PreToolUse`, `PermissionRequest`, `PermissionDenied`, `PostToolUse`, `PostToolUseFailure`, `SubagentStart`, `SubagentStop`, `TaskCreated`, `TaskCompleted`, `Elicitation`, `ElicitationResult`

The rest (`Notification`, `ConfigChange`, `CwdChanged`, `FileChanged`, `InstructionsLoaded`, `PreCompact`, `PostCompact`, `WorktreeCreate`, `WorktreeRemove`, `TeammateIdle`) fire asynchronously when their trigger happens.

Every event's JSON input includes: `session_id`, `transcript_path`, `cwd`, `hook_event_name`. Most also include `permission_mode`. Inside a subagent, `agent_id` and `agent_type` are added.

## Exit code 2 behavior per event

Exit 2 is how a hook signals "stop, don't do this." Effect depends on whether the event represents a future action (blockable) or a past action (not).

| Event | Can block? | Effect of exit 2 |
|---|---|---|
| `PreToolUse` | Yes | Blocks the tool call |
| `PermissionRequest` | Yes | Denies the permission |
| `UserPromptSubmit` | Yes | Blocks and erases the prompt |
| `Stop` | Yes | Forces Claude to continue |
| `SubagentStop` | Yes | Forces subagent to continue |
| `TeammateIdle` | Yes | Prevents teammate from going idle |
| `TaskCreated` | Yes | Rolls back task creation |
| `TaskCompleted` | Yes | Prevents marking as completed |
| `ConfigChange` | Yes | Blocks the config change (except `policy_settings`) |
| `PreCompact` | Yes | Blocks compaction |
| `Elicitation` | Yes | Denies the elicitation |
| `ElicitationResult` | Yes | Blocks the response (becomes decline) |
| `WorktreeCreate` | Yes | *Any* non-zero exit fails creation |
| `PostToolUse` | No | Shows stderr to Claude |
| `PostToolUseFailure` | No | Shows stderr to Claude |
| `PermissionDenied` | No | Ignored — use `hookSpecificOutput.retry: true` |
| `StopFailure` | No | Ignored entirely |
| `Notification`, `SubagentStart`, `SessionStart`, `SessionEnd`, `CwdChanged`, `FileChanged`, `PostCompact`, `WorktreeRemove` | No | Shows stderr to user only |
| `InstructionsLoaded` | No | Ignored |

---

## SessionStart

Fires when a session begins, resumes, clears, or recovers from compaction. Only `type: "command"` supported. Runs on every session — keep fast.

**Matchers**: `startup` | `resume` | `clear` | `compact`

**Input adds**: `source` (matches the matcher values), `model`, optionally `agent_type`.

**Output**: stdout is added to Claude's context. For structured output:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "..."
  }
}
```

**Special env var**: `CLAUDE_ENV_FILE` — append `export VAR=value` lines to persist env vars for subsequent Bash tool calls in the session.

## SessionEnd

Fires when a session terminates. No decision control — pure observability.

**Matchers**: `clear` | `resume` | `logout` | `prompt_input_exit` | `bypass_permissions_disabled` | `other`

## InstructionsLoaded

Fires when a `CLAUDE.md` or `.claude/rules/*.md` file is loaded — at session start (eager) or during the session (lazy, e.g. nested CLAUDE.md or `paths:` glob match). No blocking. Pure audit/observability.

**Matchers**: `session_start` | `nested_traversal` | `path_glob_match` | `include` | `compact`

**Input adds**: `file_path`, `memory_type` (`User` | `Project` | `Local` | `Managed`), `load_reason`, optionally `globs`, `trigger_file_path`, `parent_file_path`.

## UserPromptSubmit

Fires when user submits a prompt, before Claude sees it. Can block or inject context.

**Matcher**: none (ignored).

**Input adds**: `prompt` (the user's text).

**Output**:
- Plain stdout → added as context, visible in transcript.
- JSON `additionalContext` → added as context, more discreet.
- JSON with `decision: "block"` and `reason` → prompt is rejected and erased from context.
- JSON `sessionTitle` → renames the session (same as `/rename`).

```json
{
  "decision": "block",
  "reason": "Prompt contains a raw API key",
  "hookSpecificOutput": {
    "hookEventName": "UserPromptSubmit",
    "additionalContext": "...",
    "sessionTitle": "auth refactor"
  }
}
```

## PreCompact

Fires before context compaction. Can block it (exit 2 or `decision: "block"`).

**Matchers**: `manual` | `auto`

## PostCompact

Fires after compaction completes. No decision control. Use for logging or triggering re-indexing.

---

## PreToolUse

Fires before a tool call. The workhorse event for guardrails.

**Matcher**: tool name. Exact (`Bash`), pipe list (`Edit|Write|MultiEdit`), or regex (`mcp__github__.*`). Narrow further with handler-level `if: "Bash(git *)"` or `if: "Edit(*.ts)"`.

**Input adds**: `tool_name`, `tool_input` (tool-specific arg object), `tool_use_id`.

**Decision control** via `hookSpecificOutput`:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "..."
  }
}
```

`permissionDecision` values:
- `"allow"` — skip interactive permission prompt (deny rules still apply)
- `"deny"` — cancel the tool call, feed reason to Claude
- `"ask"` — show the permission prompt
- `"defer"` — non-interactive mode only (`-p` flag); suspends so an SDK wrapper can collect input

Can also include `updatedInput` to rewrite the tool args before they run:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow",
    "updatedInput": { "command": "npm run lint --fix" }
  }
}
```

## PostToolUse

Fires after a tool call succeeds. Cannot block (tool already ran).

**Matcher**: tool name, same rules as PreToolUse.

**Input adds**: `tool_name`, `tool_input`, `tool_response`, `tool_use_id`.

**Output**: top-level `decision: "block"` with `reason` sends feedback to Claude (e.g., "tests failed, fix before continuing"). Exit 2 with stderr does the same.

## PostToolUseFailure

Fires after a tool call fails. Same shape as PostToolUse but fires on the failure path. Useful for retry logic or error reporting. Cannot block.

## PermissionRequest

Fires when a permission dialog is about to appear. Lets a hook answer on the user's behalf.

**Matcher**: tool name.

**Decision control**:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PermissionRequest",
    "decision": {
      "behavior": "allow",
      "updatedInput": { ... },
      "updatedPermissions": [
        { "type": "setMode", "mode": "acceptEdits", "destination": "session" }
      ]
    }
  }
}
```

`behavior`: `"allow"` or `"deny"`. `updatedInput` rewrites the tool call. `updatedPermissions` can `setMode` (`default`, `acceptEdits`, `bypassPermissions`, etc.) or add permission rules so the user isn't re-asked.

**Warning**: keep the matcher narrow. A `.*` matcher here auto-approves *every* permission, including file writes and shell commands. `bypassPermissions` mode only works if the session was launched with bypass already available.

## PermissionDenied

Fires when a tool call is denied by the auto-mode classifier. Exit code and stderr are ignored (denial already happened).

**Decision control**: set `hookSpecificOutput.retry: true` to tell the model it may retry the denied call.

---

## SubagentStart

Fires when a subagent is spawned. No blocking.

**Matchers**: agent type — built-ins like `Bash`, `Explore`, `Plan`, or custom agent names.

## SubagentStop

Fires when a subagent finishes. Can block (exit 2 forces the subagent to continue). Same matchers as SubagentStart. Hooks defined in a subagent's frontmatter with a `Stop` event get auto-converted to `SubagentStop`.

## TaskCreated

Fires when a task is being created via `TaskCreate`. Exit 2 rolls back the creation. JSON `continue: false` halts entirely.

**Matcher**: none (ignored).

## TaskCompleted

Fires when a task is being marked completed. Exit 2 prevents the completion. Use for final verification ("task claims done but tests fail"). Same matcher behavior as TaskCreated.

## TeammateIdle

Fires when an agent-teams teammate is about to go idle. Exit 2 prevents idle (teammate continues). No matcher.

---

## Stop

Fires when Claude thinks it's finished the turn. Exit 2 forces continuation. Top-level `decision: "block"` with `reason` does the same with a richer message. No matcher.

**Warning — infinite loop risk**: if your Stop hook always blocks, Claude loops. Check `stop_hook_active` in the input JSON and let it pass on subsequent fires, or use a counter in a tmp file:

```bash
INPUT=$(cat)
if [ "$(echo "$INPUT" | jq -r '.stop_hook_active // false')" = "true" ]; then
  exit 0
fi
# ... your check, exit 2 if not satisfied ...
```

## StopFailure

Fires when the turn ends due to an API error. Output and exit code are ignored — observability only.

**Matchers**: `rate_limit` | `authentication_failed` | `billing_error` | `invalid_request` | `server_error` | `max_output_tokens` | `unknown`

---

## Notification

Fires when Claude Code shows a notification (needs input, permission prompt, auth success, etc.). Desktop alerts live here.

**Matchers**: `permission_prompt` | `idle_prompt` | `auth_success` | `elicitation_dialog`

**Input adds**: `message` (the notification text), `title`.

No decision control — stderr shown to user only.

## ConfigChange

Fires when a configuration file changes during a session.

**Matchers**: `user_settings` | `project_settings` | `local_settings` | `policy_settings` | `skills`

Can block (exit 2 or `decision: "block"`), except `policy_settings` which always applies.

## CwdChanged

Fires when the working directory changes (e.g., Claude runs `cd`). Useful for direnv-style env reloading.

**Matcher**: none (always fires).

**Special env var**: `CLAUDE_ENV_FILE` available. Typical handler: `direnv export bash >> "$CLAUDE_ENV_FILE"`.

## FileChanged

Fires when a watched file changes on disk.

**Matcher**: here the matcher is special — it's a pipe-separated list of *literal filenames to watch*, not a regex. Example: `.envrc|.env`. The same matcher then also filters which handler groups run when a file changes.

**Special env var**: `CLAUDE_ENV_FILE` available (same as CwdChanged).

**Output**: can include `watchPaths` to dynamically add paths to the watch list.

---

## WorktreeCreate

Fires when a worktree is being created via `--worktree` or `isolation: "worktree"`. Replaces default git behavior.

**Matcher**: none.

**Output**: command hook prints the worktree path on stdout; HTTP hook returns `hookSpecificOutput.worktreePath`. *Any* non-zero exit fails creation.

## WorktreeRemove

Fires when a worktree is being removed. No decision control — failures are logged in debug mode only.

---

## Elicitation

Fires when an MCP server requests user input during a tool call. Can block (becomes a decline).

**Matcher**: MCP server name.

**Output** via `hookSpecificOutput.action` + `content`:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "Elicitation",
    "action": "accept",
    "content": { "field1": "value" }
  }
}
```

`action`: `"accept"` | `"decline"` | `"cancel"`.

## ElicitationResult

Fires after user responds to an elicitation, before the response is sent back to the server. Can override the response.

**Matcher**: MCP server name.

**Output**: same shape as Elicitation — `action` and `content` override the user's response.

---

## Event-by-decision-pattern cheat sheet

Quick lookup: what kind of JSON output does each event expect when you want structured control?

| Pattern | Events |
|---|---|
| Top-level `decision: "block"` + `reason` | `UserPromptSubmit`, `PostToolUse`, `PostToolUseFailure`, `Stop`, `SubagentStop`, `ConfigChange`, `PreCompact` |
| `hookSpecificOutput.permissionDecision` | `PreToolUse` |
| `hookSpecificOutput.decision.behavior` | `PermissionRequest` |
| `hookSpecificOutput.retry: true` | `PermissionDenied` |
| `hookSpecificOutput.action` + `content` | `Elicitation`, `ElicitationResult` |
| `hookSpecificOutput.additionalContext` | `SessionStart`, `UserPromptSubmit` |
| Exit code or `continue: false` only | `TeammateIdle`, `TaskCreated`, `TaskCompleted` |
| Command hook prints path on stdout | `WorktreeCreate` |
| No decision control | `SessionEnd`, `PostCompact`, `Notification`, `SubagentStart`, `StopFailure`, `CwdChanged`, `FileChanged`, `InstructionsLoaded`, `WorktreeRemove` |
