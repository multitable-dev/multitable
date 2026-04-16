# MultiTable — Complete Product Specification

## Web App + Node.js Daemon · React Frontend · TypeScript Full Stack

---

## Table of Contents

### Part I: Product Definition
1. [Product Overview](#1-product-overview)
2. [Design Principles](#2-design-principles)
3. [Core Concepts & Glossary](#3-core-concepts--glossary)
4. [Information Architecture](#4-information-architecture)

### Part II: Architecture & Tech Stack
5. [System Architecture](#5-system-architecture)
6. [Tech Stack](#6-tech-stack)
7. [Monorepo Structure](#7-monorepo-structure)
8. [Data Storage](#8-data-storage)

### Part III: UI Design System
9. [Layout & Window Structure](#9-layout--window-structure)
10. [Design Tokens](#10-design-tokens)
11. [Typography](#11-typography)
12. [Spacing & Layout Primitives](#12-spacing--layout-primitives)
13. [Component Library](#13-component-library)

### Part IV: UI Specification (MVP Views)
14. [Sidebar](#14-sidebar)
15. [Main Pane: Terminal View](#15-main-pane-terminal-view)
16. [Main Pane: Dashboard View](#16-main-pane-dashboard-view)
17. [Main Pane: Project Overview](#17-main-pane-project-overview)
18. [Main Pane: Session Detail Panels](#18-main-pane-session-detail-panels)
19. [Status Bar](#19-status-bar)
20. [Modals & Dialogs](#20-modals--dialogs)
21. [Context Menus](#21-context-menus)
22. [Command Palette](#22-command-palette)
23. [Keyboard Shortcuts](#23-keyboard-shortcuts)

### Part V: Backend Specification (MVP)
24. [Daemon Lifecycle & Process Engine](#24-daemon-lifecycle--process-engine)
25. [API Contract: REST Endpoints](#25-api-contract-rest-endpoints)
26. [API Contract: WebSocket Protocol](#26-api-contract-websocket-protocol)
27. [CLI Specification](#27-cli-specification)
28. [Configuration System](#28-configuration-system)
29. [Cost & Token Tracking](#29-cost--token-tracking)
30. [Conflict Detection Engine](#30-conflict-detection-engine)
31. [Claude Code Integration](#31-claude-code-integration)
32. [Agent Permission System](#32-agent-permission-system)

### Part VI: Security, Notifications & Theme
33. [Security & Trust Model](#33-security--trust-model)
34. [Notification System](#34-notification-system)
35. [Theme System](#35-theme-system)

### Part VII: Roadmap & Future
36. [MVP Build Phases](#36-mvp-build-phases)
37. [Future Features](#37-future-features)
38. [Open Questions](#38-open-questions)

### Appendices
- [A. Brand & Distribution](#appendix-a-brand--distribution)
- [B. Data Flow Diagrams](#appendix-b-data-flow-diagrams)
- [C. Dependency Manifest](#appendix-c-dependency-manifest)

---

# Part I: Product Definition

## 1. Product Overview

### What It Is

A **unified process dashboard and terminal workspace** served as a web app from a local Node.js daemon. MultiTable gives developers a single interface to manage AI coding agents (Claude Code, Codex, Gemini CLI, Aider, Amp, Goose) alongside their development stack (dev servers, queue workers, databases, build watchers, log tailers).

### What It Is Not

- Not an IDE or code editor
- Not a terminal replacement (though it includes terminal functionality)
- Not an AI model provider — it has no built-in AI
- Not a container orchestrator (not a Docker replacement)
- Not a desktop app — it runs in any browser

### The Problem It Solves

Developers running agentic coding workflows end up with 6-12 terminal tabs: one for Claude Code, one for Codex, one for the dev server, one for the queue worker, one for logs. When something crashes, they don't know. Their AI agents can't see the dev server output, so they generate code against a broken stack. There's no shared way to define "here's everything this project needs running."

### The Solution

Define all your processes in a single YAML file. Start the daemon, and everything spins up together in one browser window. See status at a glance. Auto-restart crashes. Commit the config and your whole team gets the same stack. Access your sessions from any device on your network.

### Key Differentiators

- **Access from anywhere** — browser-based UI reachable from any device on your network or via Tailscale
- **Claude Code first** — optimized for Claude Code workflows, with agent-agnostic architecture for other tools
- **Team-shareable config** — `mt.yml` commits to version control
- **All TypeScript** — single language, single ecosystem, low contributor barrier
- **Multi-user for free** — multiple browsers can connect to the same daemon simultaneously
- **Process supervisor, not a platform** — deliberately narrow scope

---

## 2. Design Principles

| Principle | Description |
|---|---|
| **Agent-agnostic** | Runs any CLI tool — Claude Code, Codex, Gemini CLI, or a custom script. No vendor lock-in. |
| **Local-first** | All data stays on the user's machine. No telemetry. No cloud dependency. |
| **Access-anywhere** | Browser-based UI accessible from localhost, LAN, or Tailscale. Not locked to a single screen. |
| **All-TypeScript** | One language for daemon, frontend, and CLI. Any JS/TS developer can contribute immediately. |
| **Session-aware** | Every interaction is tracked and searchable. Cost, diffs, timelines — all per-session. |
| **Config-as-code** | Project configuration lives in `mt.yml`, committed to the repo and shared with the team. |

---

## 3. Core Concepts & Glossary

### Project

A directory on disk that contains code and (optionally) an `mt.yml` configuration file. Each project has its own set of sessions, terminals, and commands. Multiple projects can be registered simultaneously, but only one is "active" (visible in the main pane) at a time.

### Session

An AI agent interaction within a project. Sessions are the primary unit of work in MultiTable — they run Claude Code (or another agent) as an interactive terminal process. Sessions are tracked with cost/token data, file diffs, and structured activity timelines. Sessions can be archived and searched after completion.

### Terminal

A standalone interactive shell session (bash, zsh, fish, etc.) not tied to a specific command or agent. The user can open as many as they want via `Ctrl+T`. These are general-purpose terminals for ad-hoc work.

### Command

A non-agent process: dev servers, queue workers, build watchers, log tailers, database processes. Commands can be auto-started when the project opens and auto-restarted when they crash. Commands can also be configured with file watchers that trigger restarts when matching files change on disk.

### Dashboard

The overview of all registered projects and their active sessions. Shows project cards with status indicators, session counts, and aggregate cost data. Provides global search across all session histories.

### Storage Modes

Each process (session, command, or terminal) is stored in one of two places:

- **`mt.yml`** — committed to the repo, shared with the team
- **Local only** — stored in the daemon's local data directory, personal to this machine

A process can be moved between these modes at any time.

---

## 4. Information Architecture

```
App
└── Projects[] (the user can have many projects registered)
    ├── Project Metadata
    │   ├── name: string
    │   ├── path: string (absolute path to project directory)
    │   ├── icon: auto-detected or custom
    │   └── is_active: boolean
    │
    ├── Sessions[]
    │   ├── name: string (e.g., "Claude Code")
    │   ├── command: string (e.g., "claude")
    │   ├── working_directory: string (optional, defaults to project root)
    │   ├── autostart: boolean
    │   ├── status: running | idle | stopped | error
    │   ├── subtitle: string (live activity description from agent output)
    │   ├── pid: number | null
    │   ├── cpu_percent: float
    │   ├── memory_bytes: number
    │   ├── tokens_in: number
    │   ├── tokens_out: number
    │   ├── cost_usd: number
    │   └── storage: "yml" | "local"
    │
    ├── Terminals[]
    │   ├── name: string (e.g., "Terminal 1")
    │   ├── shell: string (default system shell)
    │   ├── status: running | stopped
    │   └── pid: number | null
    │
    └── Commands[]
        ├── name: string (e.g., "npm:dev")
        ├── command: string (e.g., "npm run dev")
        ├── working_directory: string (optional)
        ├── autostart: boolean
        ├── autorestart: boolean
        ├── autorestart_max: number (rate limit, default 5)
        ├── autorestart_delay_ms: number (default 2000)
        ├── terminal_alerts: boolean (notify on bell character)
        ├── file_watching: string[] (glob patterns, e.g., ["src/**/*.ts"])
        ├── status: running | stopped | error
        ├── pid: number | null
        ├── port: number | null (auto-detected from output)
        ├── cpu_percent: float
        ├── memory_bytes: number
        ├── uptime_seconds: number
        └── storage: "yml" | "local"
```

---

# Part II: Architecture & Tech Stack

## 5. System Architecture

MultiTable is a **web app + local daemon**. The daemon runs on your dev machine and manages terminals, files, and state. The UI is a React app served by the daemon, accessible from any browser — locally or over the network.

```
┌──────────────────────────────────────────────────┐
│            Any browser, any device                │
│      (laptop, iPad over Tailscale, phone)         │
│                                                   │
│    React UI ←── WebSocket ──→ Terminal streams     │
│              ←── REST API ──→ Project/session CRUD │
└──────────────────┬────────────────────────────────┘
                   │ localhost or Tailscale / LAN
┌──────────────────┴────────────────────────────────┐
│               mt daemon (Node.js)                  │
│                                                    │
│  ┌──────────────┐  ┌───────────────────────────┐   │
│  │ Express /    │  │ WebSocket server           │   │
│  │ REST API     │  │ (per-terminal stream)      │   │
│  └──────────────┘  └───────────────────────────┘   │
│  ┌──────────────┐  ┌───────────────────────────┐   │
│  │ node-pty     │  │ chokidar (file watcher)    │   │
│  │ (PTY         │  │                            │   │
│  │  sessions)   │  │                            │   │
│  └──────────────┘  └───────────────────────────┘   │
│  ┌──────────────┐  ┌───────────────────────────┐   │
│  │ SQLite       │  │ simple-git (git ops)       │   │
│  │ (state +     │  │                            │   │
│  │  history)    │  │                            │   │
│  └──────────────┘  └───────────────────────────┘   │
│  ┌──────────────┐  ┌───────────────────────────┐   │
│  │ Token/cost   │  │ Conflict detection engine  │   │
│  │ tracker      │  │                            │   │
│  └──────────────┘  └───────────────────────────┘   │
│                                                    │
│             Your actual machine                    │
│      (has the code, runs the agents)               │
└────────────────────────────────────────────────────┘
```

### Why Web + Daemon (Not a Desktop App)

- **Access from any device.** Open your dashboard from your iPad over Tailscale, your phone, a second laptop. A native app only works on the machine it's installed on.
- **Multi-user for free.** Multiple people can connect to the same daemon. Pair programming on agents — you watch session 1, your teammate watches session 3, same machine.
- **Zero install friction for the UI.** The daemon serves the frontend. No app store, no download, no updates to the client.
- **Simpler stack.** One language (TypeScript), one ecosystem (npm), one contributor pool.
- **Tailscale-native.** Join your tailnet, and your dev machine's MultiTable is reachable at `your-machine.tail1234.ts.net:3000` from anywhere in the world.

### Communication Model

- **REST API** — CRUD operations for projects, sessions, commands, terminals, and configuration
- **WebSocket** — Real-time terminal streams (PTY output), process state changes, metrics updates, and notifications

---

## 6. Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React + TypeScript | UI framework |
| Build | Vite | Frontend bundling and dev server |
| Terminal UI | xterm.js | Terminal emulation in the browser |
| Styling | TailwindCSS | Utility-first CSS |
| State | Zustand | Lightweight state management (sliced architecture) |
| Command Palette | cmdk | Fuzzy search command palette |
| Icons | lucide-react | Icon set |
| Scratchpad | CodeMirror 6 | Per-session notepad with markdown support |
| Notifications | react-hot-toast | In-app toast notifications |
| Backend | Node.js + TypeScript | Daemon runtime |
| HTTP | Express | REST API server |
| WebSocket | ws | Real-time terminal streams and events |
| PTY | node-pty | Pseudo-terminal session management |
| Database | better-sqlite3 | Session state, history, cost tracking |
| File Watching | chokidar | File system change detection |
| Git | simple-git | Git operations (diff, status, log) |
| CLI | commander | CLI argument parsing |

**The entire stack is TypeScript.** No Rust, no Go, no second language. Any JavaScript/TypeScript developer can contribute immediately.

---

## 7. Monorepo Structure

```
multitable/
├── README.md
├── LICENSE                     # MIT
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── package.json                # Monorepo root (npm workspaces)
├── tsconfig.json               # Base TypeScript config
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.yml
│   │   └── feature_request.yml
│   ├── pull_request_template.md
│   ├── CODEOWNERS
│   └── workflows/
│       ├── ci.yml              # Lint + test on PR
│       └── release.yml         # Publish to npm on tag
├── docs/
│   └── SPEC.md                 # This document
├── packages/
│   ├── daemon/                 # Backend (Node.js)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts        # Entry point
│   │       ├── server.ts       # Express + WebSocket setup
│   │       ├── pty/            # Terminal session management
│   │       │   ├── manager.ts  # Spawn, resize, kill PTYs
│   │       │   └── stream.ts   # WebSocket <-> PTY bridge
│   │       ├── api/            # REST routes
│   │       │   ├── projects.ts # Project CRUD
│   │       │   ├── sessions.ts # Session CRUD
│   │       │   ├── commands.ts # Command CRUD
│   │       │   └── search.ts   # Session history/search
│   │       ├── git/            # Git operations
│   │       ├── watcher/        # File system watching
│   │       ├── tracker/        # Token/cost tracking
│   │       ├── conflict/       # Cross-session conflict detection
│   │       ├── config/         # Configuration loading
│   │       └── db/             # SQLite schema and queries
│   │           ├── schema.sql
│   │           └── store.ts
│   ├── web/                    # Frontend (React)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   ├── tailwind.config.js
│   │   ├── index.html
│   │   └── src/
│   │       ├── App.tsx
│   │       ├── main.tsx
│   │       ├── components/
│   │       │   ├── sidebar/
│   │       │   │   ├── Sidebar.tsx
│   │       │   │   ├── ProjectHeader.tsx
│   │       │   │   ├── SidebarSection.tsx
│   │       │   │   ├── SidebarItem.tsx
│   │       │   │   ├── ProjectList.tsx
│   │       │   │   └── CollapsibleProject.tsx
│   │       │   ├── main-pane/
│   │       │   │   ├── MainPane.tsx
│   │       │   │   ├── TerminalView.tsx
│   │       │   │   ├── DashboardView.tsx
│   │       │   │   ├── ProjectOverview.tsx
│   │       │   │   ├── SessionDetail.tsx
│   │       │   │   └── ProcessSettings.tsx
│   │       │   ├── status-bar/
│   │       │   │   └── StatusBar.tsx
│   │       │   ├── modals/
│   │       │   │   ├── AddProcessModal.tsx
│   │       │   │   ├── AddAgentModal.tsx
│   │       │   │   ├── TrustDialog.tsx
│   │       │   │   └── OrphanDialog.tsx
│   │       │   └── command-palette/
│   │       │       └── CommandPalette.tsx
│   │       ├── hooks/
│   │       │   ├── useProcess.ts
│   │       │   ├── useTerminal.ts
│   │       │   ├── useKeyboardShortcuts.ts
│   │       │   └── useTheme.ts
│   │       ├── stores/
│   │       │   ├── appStore.ts         # Composed store from slices
│   │       │   ├── projectSlice.ts     # Project CRUD state
│   │       │   ├── processSlice.ts     # Sessions + commands + terminals
│   │       │   ├── uiSlice.ts          # Active selection, theme, sidebar
│   │       │   ├── permissionSlice.ts  # Pending permission prompts
│   │       │   └── optionSlice.ts      # Current option prompt
│   │       ├── lib/
│   │       │   ├── terminalManager.ts
│   │       │   ├── ws.ts       # WebSocket client helpers
│   │       │   ├── api.ts      # REST client helpers
│   │       │   └── types.ts    # Shared types
│   │       └── styles/
│   │           ├── globals.css
│   │           └── themes.css
│   └── cli/                    # CLI wrapper
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           └── index.ts        # mt start, mt stop, etc.
└── .local/                     # Gitignored local notes
```

---

## 8. Data Storage

### SQLite Schema

The daemon stores all persistent state in a SQLite database at `~/.config/multitable/multitable.db`.

**Core tables:**

- `projects` — registered project directories
- `sessions` — agent sessions with cost/token data, status, timestamps
  - Includes `claude_session_id TEXT` for Claude Code resume capability (Section 31)
  - Includes `scrollback_data BLOB` for persistent scrollback (flushed from 512KB ring buffer every 3s)
  - Includes `scratchpad TEXT` for per-session notepad content (debounced save, 500ms)
- `session_events` — structured activity log per session (files read, files written, tools called)
- `commands` — configured commands per project
- `cost_records` — per-session token/cost snapshots over time

### File System Paths

```
~/.config/multitable/                # App configuration root
├── config.yml                       # Global app settings
├── multitable.db                    # SQLite database
├── pids.json                        # PID tracking for orphan recovery
└── projects/
    ├── {project_hash_1}/
    │   ├── local.yml                # Local-only processes
    │   └── trust.json               # Last approved mt.yml hash
    └── {project_hash_2}/
        ├── local.yml
        └── trust.json
```

### `mt.yml` Project Config

The project-level configuration file committed to version control:

```yaml
# mt.yml — committed to the repository
name: "my-project"

sessions:
  - name: "Claude Code"
    command: "claude"
    autostart: true

commands:
  - name: "npm:dev"
    command: "npm run dev"
    autostart: true
    autorestart: false
    terminal_alerts: true
    file_watching:
      - "src/**/*.ts"

  - name: "Queue"
    command: "php artisan queue:work"
    autostart: true
    autorestart: true
```

### Global Config

```yaml
# ~/.config/multitable/config.yml
theme: "system"              # "light" | "dark" | "system"
default_editor: "code"       # "code" | "zed" | "cursor" | custom path
default_shell: "/bin/bash"
terminal_font_size: 13
terminal_scrollback: 10000
notifications: true
port: 3000                   # daemon port, 0 = auto-assign
host: "127.0.0.1"            # "0.0.0.0" for LAN/Tailscale

projects:
  - path: "/home/user/code/my-project"
    shortcut: 1
  - path: "/home/user/code/other-project"
    shortcut: 2
```

---

# Part III: UI Design System

## 9. Layout & Window Structure

```
┌──────────────────────────────────────────────────────────┐
│  Browser Tab: "MultiTable - project-name - session"      │
├─────────────┬────────────────────────────────────────────┤
│             │                                            │
│  Sidebar    │  Main Pane                                 │
│  ~300px     │  (terminal output OR dashboard OR          │
│  fixed      │   project overview OR session detail)      │
│             │                                            │
│  ┌────────┐ │                                            │
│  │PROJECT │ │                                            │
│  │────────│ │                                            │
│  │SESSIONS│ │                                            │
│  │ ● item │ │                                            │
│  │ ● item │ │                                            │
│  │TERMS   │ │                                            │
│  │ ● item │ │                                            │
│  │COMMANDS│ │                                            │
│  │ ● item │ │                                            │
│  │ ● item │ │                                            │
│  │────────│ │                                            │
│  │Project2│ │                                            │
│  │Project3│ │                                            │
│  └────────┘ │                                            │
│             │                                            │
├─────────────┴────────────────────────────────────────────┤
│  Status Bar: [Focus][Pause][Clear][Stop][Restart]  CPU…  │
└──────────────────────────────────────────────────────────┘
```

- **Sidebar**: Fixed ~300px, left side, vertically scrollable when content overflows
- **Main Pane**: Fills remaining width, displays terminal or content views
- **Status Bar**: Fixed ~36px at the bottom, always visible
- **Minimum viewport**: 800px wide, 500px tall
- **Browser tab title**: Updates to reflect `"MultiTable - {project} - {selected item}"`

---

## 10. Design Tokens

| Token | Light Mode Value | Dark Mode Value |
|---|---|---|
| `--bg-primary` | `#FFFFFF` | `#1a1a1a` |
| `--bg-sidebar` | `#FAFAFA` | `#141414` |
| `--bg-statusbar` | `#F5F5F5` | `#1e1e1e` |
| `--text-primary` | `#111111` | `#e5e5e5` |
| `--text-secondary` | `#6b7280` | `#9ca3af` |
| `--text-muted` | `#9ca3af` | `#6b7280` |
| `--border` | `#e5e7eb` | `#2e2e2e` |
| `--accent-blue` | `#3b82f6` | `#60a5fa` |
| `--status-running` | `#22c55e` | `#22c55e` |
| `--status-idle` | `#22c55e` (outline only) | `#22c55e` (outline only) |
| `--status-warning` | `#f59e0b` | `#f59e0b` |
| `--status-error` | `#ef4444` | `#ef4444` |
| `--status-stopped` | `#9ca3af` | `#6b7280` |
| `--selection-bg` | `transparent` | `transparent` |
| `--selection-border` | `#3b82f6` | `#60a5fa` |

These tokens map to TailwindCSS theme extensions in `tailwind.config.js`.

---

## 11. Typography

| Element | Font | Size | Weight | Color |
|---|---|---|---|---|
| Sidebar project name | System sans-serif | 15px | 600 | `--text-primary` |
| Sidebar section header | System sans-serif | 11px | 600 | `--text-muted` |
| Sidebar item name | System sans-serif | 14px | 400 | `--text-primary` |
| Sidebar item subtitle | System sans-serif | 12px | 400 | `--text-secondary` |
| Sidebar metrics | System sans-serif | 12px | 400 | `--text-muted` |
| Main pane header | System sans-serif | 16px | 600 | `--text-primary` |
| Settings label | System sans-serif | 14px | 600 | `--text-primary` |
| Settings description | System sans-serif | 13px | 400 | `--text-secondary` |
| Status bar text | System sans-serif | 12px | 400 | `--text-secondary` |
| Status bar process name | Monospace | 12px | 500 | `--text-primary` |
| Terminal output | Monospace (Menlo/Consolas/monospace) | 13px | 400 | per ANSI |
| Command value display | Monospace | 13px | 400 | `--text-primary` |
| Badge/tag text | System sans-serif | 11px | 500 | `--text-secondary` |

### Font Stacks

- **System sans-serif**: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`
- **Monospace**: `"Menlo", "Consolas", "DejaVu Sans Mono", "Liberation Mono", monospace`

---

## 12. Spacing & Layout Primitives

| Context | Value |
|---|---|
| Sidebar horizontal padding | 16px |
| Sidebar item vertical padding | 8px |
| Sidebar section gap | 4px |
| Sidebar section header margin-top | 16px |
| Status dot size | 10px |
| Status dot left margin from edge | 16px |
| Item text left margin from dot | 12px |
| Main pane padding | 0px (terminal fills) or 32px (settings/overview) |
| Settings section separator | 1px `--border` with 24px vertical margin |
| Modal padding | 32px |
| Modal max-width | 600px |
| Modal border radius | 12px |
| Status bar height | 36px |
| Card border radius | 8px |
| Badge border radius | 999px (pill) |
| Button border radius | 6px |

---

## 13. Component Library

### StatusDot

A 10px circle indicating process state.

| State | Appearance |
|---|---|
| Running (active) | Filled green `#22c55e` |
| Running (idle) | Green outline, hollow center |
| Warning / transitional | Filled orange `#f59e0b` |
| Standby / paused | Orange outline |
| Stopped | Filled gray `#9ca3af` |
| Error / crashed | Filled red `#ef4444` |

### Badge / Tag

Pill-shaped label with 1px border, 11px uppercase text, `--text-secondary` color. Used for "AUTO", "YML", "LOCAL" indicators on processes.

### Toggle Switch

- **On**: Blue track (`--accent-blue`), white knob
- **Off**: Gray track, white knob
- Height: 20px, Width: 36px

### Button

| Variant | Appearance |
|---|---|
| Primary | Filled `--accent-blue` background, white text |
| Secondary | 1px `--border` outline, `--text-primary` text |
| Text-only | No border/background, `--accent-blue` text |
| Destructive | Filled `#ef4444` background, white text |

### Text Input

- 1px `--border` border
- `--bg-primary` background
- 14px system font
- 8px vertical padding, 12px horizontal padding
- Border radius: 6px
- Focus: `--accent-blue` border

### Textarea

- Same as Text Input but multi-line
- Monospace font for command inputs
- Resizable vertically

### Toast Notification

- Appears top-right of main pane
- Auto-dismiss after 5 seconds
- `--bg-primary` background with shadow
- Border radius: 8px
- Padding: 12px 16px
- Status icon (color-coded) + message text

### Modal Overlay

- Backdrop: semi-transparent black with blur
- Content: `--bg-primary` background, centered
- Max-width: 600px
- Border radius: 12px
- Padding: 32px
- Close on Escape or backdrop click

---

# Part IV: UI Specification (MVP Views)

## 14. Sidebar

### Structure

The sidebar is a fixed-width panel (~300px) on the left side. It has a `--bg-sidebar` background and is separated from the main pane by a 1px `--border` line. It is vertically scrollable when content overflows.

### Active Project Header

At the top of the sidebar:

```
✓  [icon] my-project       Alt+1
```

- Green checkmark indicates the project is active/healthy
- Project icon (auto-detected from framework or custom)
- Project name in semibold 15px
- Keyboard shortcut hint on the right (Alt+1, Alt+2, etc.)

### Section: SESSIONS

```
v  SESSIONS ————————— 2/3   Alt+S
   ○ Claude Code
     Editing src/api/routes.ts...
   ● Codex
     Running tests...
   ● Aider
```

- Section header: "SESSIONS" in uppercase 11px muted, dashed line extending to the count badge "2/3" (running/total), keyboard shortcut
- Each session has a status dot (10px, colored per state)
- Session name in 14px regular
- Optional subtitle below in 12px secondary text (truncated with ellipsis) — updates in real-time based on agent output
- Status dot colors for sessions:
  - Filled green: actively working / processing
  - Open green: running but idle, waiting for input
  - Filled orange: transitional state
  - Filled gray: stopped
  - Filled red: crashed

### Section: TERMINALS

```
v  TERMINALS ————————— 1/1   Alt+T
   ● Terminal 1
```

- Same header format as SESSIONS
- Items show name and status dot only

### Section: COMMANDS

```
v  COMMANDS —————————— 4/5   Alt+C
   ● npm:dev           5174
   ● Logs              0.0% · 416KB
   ● Queue
   ● Scheduler
   ○ Pint
```

- Each command shows: status dot, name, and right-aligned metrics
- Metrics can include: port number, CPU%, memory usage
- Metrics format: `{port} · {cpu}% · {mem}` — fields shown only when available
- On hover: inline action icons (edit, restart, stop)
- Selected item: 3px `--accent-blue` left border

### Other Projects List

Below the active project's sections, other registered projects appear collapsed:

```
>  [icon] Other Project     Alt+2
>  [icon] Another One       Alt+3
```

- Click to expand and see that project's commands/sessions inline
- Double-click to switch active project

### Sidebar Interactions

| Interaction | Result |
|---|---|
| Click an item | Select it; main pane shows its terminal output |
| Double-click a project | Switch to it as the active project |
| Right-click an item | Open context menu |
| Hover an item | Show inline action icons (edit, restart, stop) |
| Click section header | Toggle collapse/expand |

---

## 15. Main Pane: Terminal View

Displayed when a session, terminal, or running command is selected.

- Full-bleed xterm.js instance filling the entire main pane (0px padding)
- Full ANSI color and formatting support
- Interactive — keystrokes are sent to the process's PTY stdin via WebSocket
- Monospace font (Menlo on macOS, Consolas on Windows, system monospace on Linux)
- The terminal renders the full output history of the process since it started
- Scrollback buffer: configurable, default 10,000 lines
- Cursor blinking enabled

For sessions, the terminal shows whatever the agent's native TUI renders — Claude Code's interface, Codex's prompt, etc. No special treatment; it's just a PTY.

### Terminal Instance Management

A singleton `TerminalManager` manages xterm.js instances, creating them lazily and caching them so switching between processes doesn't destroy terminal state:

```typescript
class TerminalManager {
    private terminals: Map<string, Terminal> = new Map();

    getOrCreate(processId: string): Terminal { /* ... */ }
    attach(processId: string, container: HTMLDivElement): void { /* ... */ }
    detach(processId: string): void { /* preserve scrollback */ }
    destroy(processId: string): void { /* dispose */ }
}
```

### Terminal Resize Flow

```
Window resized → ResizeObserver fires → fitAddon.fit()
    → terminal.cols/rows updated → WebSocket message: pty-resize
    → daemon calls pty.resize(cols, rows)
    → PTY sends SIGWINCH to child process
    → Child process redraws
```

---

## 16. Main Pane: Dashboard View

The overview shown on first load or when clicking the Dashboard navigation item.

- Grid of project cards with mini status previews
- Each card shows:
  - Project name and icon
  - Status indicators (idle, running, waiting, errored, completed)
  - Session/command counts (e.g., "3 sessions, 5 commands")
  - Aggregate cost for active sessions
  - Error badge if any process has crashed
- Click a card to switch to that project
- Global search bar at the top for full-text search across all session histories

---

## 17. Main Pane: Project Overview

Displayed when clicking the project name/header itself (not a specific item).

```
┌──────────────────────────────────────────────────┐
│  my-project  [edit]  │  ● 4/5 Running            │
│──────────────────────────────────────────────────│
│                                                  │
│  ┌──────────────────────────────────────────┐    │
│  │  v [icon] npm:dev  [AUTO] [YML]          │    │
│  │    npm run dev                           │    │
│  │                                          │    │
│  │  Name:           npm:dev                 │    │
│  │  Command:        npm run dev             │    │
│  │  Auto-start:     [toggle on]             │    │
│  │  Auto-restart:   [toggle off]            │    │
│  │  Terminal alerts: [toggle on]            │    │
│  │  File watching:  src/**/*.ts  [x]        │    │
│  │  Storage:        mt.yml [Make local]     │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
│  (repeat for each process)                       │
│                                                  │
│  [+ Add Session]  [+ Add Command]  [+ Add Term]  │
└──────────────────────────────────────────────────┘
```

- Header: project name + edit icon + vertical divider + green dot + "4/5 Running" badge
- Each process is an expandable card:
  - Collapsed: icon, name, badges (AUTO/YML), command text, status
  - Expanded: full settings form with toggle switches

### Settings Fields

| Field | Type | Description |
|---|---|---|
| Name | Text display + "Rename" action link | The display name |
| Command | Monospace text display + "Edit" action link | The shell command |
| Auto-start | Toggle switch | "Start when project opens" |
| Auto-restart | Toggle switch | "Restart if process exits" |
| Terminal alerts | Toggle switch | "Notify on bell character" |
| File watching | Text input + "Add" button | Glob patterns as removable chips |
| Storage | Label + action link | "mt.yml" or "local". Link: "Make local" / "Save to mt.yml" |

---

## 18. Main Pane: Session Detail Panels

Per-session side panels accessible from the session view. These are toggled via a tabbed panel below the terminal or a slide-out drawer.

### File Explorer

- Project file tree scoped to the session's working directory
- Expandable/collapsible folders
- Click to open in editor (via `default_editor` config)
- Highlights files modified during the current session

### Diff Viewer

- Git diff of changes made during the session
- File-by-file display with added/removed line counts
- Syntax-highlighted unified diff format
- Powered by `simple-git`

### Session Timeline

Structured log of agent actions with timestamps:

- Files read
- Files written / modified
- Tools called
- Commands executed
- Backtracking points

Not just terminal output — the agent's activity trail parsed from output.

### Cost Summary

- Tokens in / tokens out for this session
- Total cost in USD
- Model used (if detectable)
- Per-operation cost breakdown (when available)

### Scratchpad

A per-session notepad for jotting down constraints, TODOs, context, and notes while working with an agent.

- **Editor**: CodeMirror 6 with markdown syntax highlighting
- **Persistence**: Content saved to SQLite (`scratchpad` column on sessions table) with 500ms debounce
- **Layout**: Appears as a tab alongside File Explorer, Diff Viewer, Timeline, and Cost Summary
- **Default content**: Empty (no template)
- **Markdown preview**: Toggle button switches between edit mode and rendered markdown preview

---

## 19. Status Bar

A thin bar (~36px) at the bottom, present at all times.

### Left Side — Action Buttons

Shown only when a process is selected. Each is a small text button with an icon:

| Button | Icon | Action |
|---|---|---|
| Focus | circular arrow | Scroll terminal to bottom and follow output |
| Pause | pause bars | Stop auto-scrolling |
| Clear | circle-slash | Clear the terminal buffer |
| Stop | square | Send SIGTERM to the process |
| Restart | refresh | Stop and re-start the process |

### Right Side — Metrics

Always shows metrics for the currently selected process:

```
CPU 2.1%  MEM 43 MB  npm:dev  ● Running
```

- CPU and memory in regular text
- Process name in monospace
- Status dot with label (Running, Stopped, Error)
- For sessions: a second dot showing idle/working state

---

## 20. Modals & Dialogs

### 20.1 Add Process Modal

Triggered by "Add command...", "Add terminal", or via command palette.

**Layout:** Centered modal overlay with backdrop blur. Max-width ~600px. Rounded corners (12px). `--bg-primary` background.

**Fields:**

| Field | Type | Details |
|---|---|---|
| Command | Textarea (monospace) | Placeholder: "e.g., npm run dev" |
| Working directory | Text input | Pre-filled with project root. Placeholder: "Leave empty for project root" |
| Auto-start when project starts | Checkbox | Default: checked |
| Auto-restart if process exits | Checkbox | Default: unchecked |
| Where to save | Radio group | |
| → Save to mt.yml | Radio (default) | "Share with your team via version control" |
| → Store locally only | Radio | "Keep this just for yourself on this machine" |

**Footer:** "Cancel" (text-only button) + "Add process" (filled blue button)

### 20.2 Add Agent Modal

Variant of Add Process modal. Shows a selector for known agent types (Claude Code, Codex, Gemini CLI, Amp, Aider, Goose) that pre-fills the command, plus a "Custom" option. Claude Code is listed first and highlighted as recommended.

### 20.3 Confirm Trust Dialog

Triggered when `mt.yml` changes since last approved hash (e.g., after `git pull`).

- Warning icon + "mt.yml has changed"
- Diff view showing added/modified commands
- "The following commands were added or modified:" + list
- Buttons: "Cancel" / "Accept and Run"

### 20.4 Orphaned Processes Dialog

Triggered on daemon startup when PIDs from a previous run are still alive.

- "Found orphaned processes from a previous session"
- List of process names and PIDs
- Buttons: "Kill All" / "Reattach" / "Ignore"

---

## 21. Context Menus

Right-clicking any sidebar item opens a context menu (rendered as a web component, not native OS menu).

### Command Context Menu

```
Stop                    (or "Start" when stopped)
Restart
──────────────
Copy command
Clear output
──────────────
Toggle notifications
──────────────
Edit command...
──────────────
Add command...
Add terminal
Add session             >  (submenu: Claude Code, Codex, ...)
──────────────
Delete command "npm:dev"
```

### Session Context Menu

```
Stop
Restart
──────────────
Clear output
──────────────
Edit session...
──────────────
Delete session "Claude Code"
```

### Terminal Context Menu

```
Close terminal
──────────────
Rename...
──────────────
Clear output
```

### Project Context Menu

```
Open in editor
Open in terminal
──────────────
Open project directory
──────────────
Start all
Stop all
Restart all
──────────────
Project settings...
──────────────
Remove project
```

---

## 22. Command Palette

Triggered by `Ctrl+K`.

**Layout:** Centered overlay near the top of the window. Text input at top, filtered results list below.

**Searchable Items:**

| Category | Examples |
|---|---|
| Processes | "Claude Code", "npm:dev", "Queue" |
| Actions | "Start all", "Stop all", "Restart all" |
| Projects | "my-project", "other-project" |
| Navigation | "Go to Sessions", "Go to Commands" |
| Creation | "Add command", "Add terminal", "Add session" |
| Settings | "Open project settings", "Toggle theme" |

**Behavior:**

- Fuzzy matching on item names
- Results grouped by category with light headers
- Arrow keys to navigate, Enter to select, Escape to close
- Recently used items appear first when the palette opens with an empty query

---

## 23. Keyboard Shortcuts

### Global

| Shortcut | Action |
|---|---|
| `Ctrl+K` | Open command palette |
| `Ctrl+T` | New terminal |
| `Ctrl+W` | Close current terminal |
| `Ctrl+,` | Open settings |

### Navigation

| Shortcut | Action |
|---|---|
| `Alt+1` – `Alt+9` | Switch to project 1-9 |
| `Alt+S` | Jump to Sessions section |
| `Alt+T` | Jump to Terminals section |
| `Alt+C` | Jump to Commands section |
| `Alt+Up` / `Alt+Down` | Move between sidebar items |
| `Enter` | Select/activate highlighted item |

### Process Control

| Shortcut | Action |
|---|---|
| `Ctrl+Shift+S` | Start all processes |
| `Ctrl+Shift+X` | Stop all processes |
| `Ctrl+Shift+R` | Restart selected process |
| `Ctrl+Shift+L` | Clear selected terminal |

Note: These are browser-compatible shortcuts, not native app shortcuts. Conflicts with browser defaults are avoided.

---

# Part V: Backend Specification (MVP)

## 24. Daemon Lifecycle & Process Engine

### Startup Sequence

1. Read `~/.config/multitable/config.yml` — load project list, theme, port
2. Check `pids.json` for orphaned processes
   - If found: hold startup, notify frontend to show OrphanDialog
3. For each project: read `mt.yml` + `local.yml`
   - Compare `mt.yml` hash against `trust.json`
   - If changed: notify frontend to show TrustDialog
4. Open SQLite database (create if first run)
5. **Initialize HookManager** — check `~/.claude/settings.json` for MultiTable hooks; install if missing (see Section 31)
6. **Initialize PermissionManager** — create pending request map and auto-defer tool list (see Section 32)
7. **Register HookReceiver routes** — Express routes at `/api/hooks/:eventName` for Claude Code callbacks
8. Set active project (last active, or first)
9. For active project: start all autostart processes
   - For each: spawn PTY via node-pty, start monitor, update PID tracker
10. Start file watcher on `mt.yml` + configured watch patterns
11. Start metrics polling (every 2 seconds)
12. Serve React frontend as static files
13. Begin listening on configured host:port
14. Ready.

### Process State Machine

```
         ┌──────────┐
         │  Created  │
         └────┬─────┘
              │ start()
              v
         ┌──────────┐      crash/exit
    ┌───>│ Running   │─────────────────┐
    │    └────┬─────┘                  │
    │         │ user stops             v
    │         │                  ┌───────────┐
    │         v                  │  Errored   │
    │    ┌──────────┐            └─────┬─────┘
    │    │ Stopped   │                 │ autorestart?
    │    └──────────┘                  │ yes -> restart()
    │                                  │ no  -> stay Errored
    │         ┌────────────────────────┘
    │         │
    └─────────┘
         restart()
```

### Process Spawning

Each process is spawned in its own PTY via `node-pty`. This gives full terminal emulation including ANSI colors, cursor movement, and interactive input (required for agents like Claude Code that use TUI frameworks).

```typescript
interface ManagedProcess {
    id: string;
    name: string;
    command: string;
    workingDir: string;
    config: ProcessConfig;
    state: ProcessState;
    pty: IPty | null;
    pid: number | null;
    startedAt: Date | null;
    restartCount: number;
    outputBuffer: RingBuffer;  // scrollback
    metrics: ProcessMetrics;
}

interface ProcessConfig {
    autostart: boolean;
    autorestart: boolean;
    autorestartMax: number;        // default 5
    autorestartDelayMs: number;    // default 2000
    autorestartWindowSecs: number; // reset restartCount after this (default 60)
    autorespawn: boolean;          // respawn PTY on subscribe if dead (default true for sessions, false for commands)
    terminalAlerts: boolean;
    fileWatchPatterns: string[];
    storage: "yml" | "local";
}

interface ProcessMetrics {
    cpuPercent: number;
    memoryBytes: number;
    detectedPort: number | null;
}
```

### Auto-Restart Logic

```
on process_exit(process, exitCode):
    if process.config.autorestart === false:
        setState(process, "errored")
        sendNotification(`${process.name} crashed`)
        return

    if process.restartCount >= process.config.autorestartMax:
        setState(process, "errored")
        sendNotification(`${process.name} crashed too many times, giving up`)
        return

    process.restartCount += 1
    await sleep(process.config.autorestartDelayMs)
    restart(process)
    sendNotification(`${process.name} restarted automatically`)
```

The `restartCount` resets to 0 after `autorestartWindowSecs` of stable running.

### File Watch Restart Logic

```
on file_changed(path):
    for process of allProcesses:
        for pattern of process.config.fileWatchPatterns:
            if globMatch(pattern, path):
                restart(process)
                break
```

Debounce: file changes within 500ms are batched into a single restart.

### Port Detection

The engine scans process stdout for common port patterns:
- `localhost:{port}`
- `http://0.0.0.0:{port}`
- `listening on port {port}`
- `VITE v*.*.* ready in * ms` — extract port from the URL line

Detected ports are stored in `ProcessMetrics.detectedPort` and displayed in the sidebar.

### PID Tracking & Orphan Recovery

On startup, the daemon reads `pids.json`. For each PID:
1. Check if the process is still running (via `process.kill(pid, 0)`)
2. If running: show the Orphaned Processes Dialog
3. If not running: clean up the entry

On shutdown, all child processes receive SIGTERM, then SIGKILL after a 5-second grace period.

---

## 25. API Contract: REST Endpoints

### Project Management

| Method | Path | Description | Request Body | Response |
|---|---|---|---|---|
| `GET` | `/api/projects` | List all projects | — | `Project[]` |
| `POST` | `/api/projects` | Register a project | `{ path: string }` | `Project` |
| `GET` | `/api/projects/:id` | Get project details | — | `Project` |
| `PUT` | `/api/projects/:id` | Update project | `Partial<Project>` | `Project` |
| `DELETE` | `/api/projects/:id` | Remove project | — | `204` |
| `PUT` | `/api/projects/:id/active` | Set as active project | — | `200` |

### Session Management

| Method | Path | Description | Request Body | Response |
|---|---|---|---|---|
| `GET` | `/api/projects/:id/sessions` | List sessions | — | `Session[]` |
| `POST` | `/api/projects/:id/sessions` | Create session | `{ name, command, ... }` | `Session` |
| `PUT` | `/api/sessions/:id` | Update session config | `Partial<Session>` | `Session` |
| `DELETE` | `/api/sessions/:id` | Delete session | — | `204` |

### Command Management

| Method | Path | Description | Request Body | Response |
|---|---|---|---|---|
| `GET` | `/api/projects/:id/commands` | List commands | — | `Command[]` |
| `POST` | `/api/projects/:id/commands` | Create command | `{ name, command, ... }` | `Command` |
| `PUT` | `/api/commands/:id` | Update command | `Partial<Command>` | `Command` |
| `DELETE` | `/api/commands/:id` | Delete command | — | `204` |

### Process Lifecycle

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/processes/:id/start` | Start a process |
| `POST` | `/api/processes/:id/stop` | Stop a process (SIGTERM) |
| `POST` | `/api/processes/:id/restart` | Restart a process |
| `POST` | `/api/projects/:id/start-all` | Start all autostart processes |
| `POST` | `/api/projects/:id/stop-all` | Stop all running processes |

### Configuration

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/config` | Get global config |
| `PUT` | `/api/config` | Update global config |
| `GET` | `/api/projects/:id/mt-yml` | Get project's mt.yml |

### Search

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/search?q={query}` | Full-text search across session histories |

### Trust

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/projects/:id/trust/approve` | Approve mt.yml changes |
| `POST` | `/api/projects/:id/trust/reject` | Reject mt.yml changes |

### Claude Code Hooks

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/hooks/pre-tool-use` | PreToolUse hook callback. **Holds response open** until user permission decision or 110s timeout. See Section 32. |
| `POST` | `/api/hooks/post-tool-use` | PostToolUse hook callback. Updates session state (tool, tokens). |
| `POST` | `/api/hooks/stop` | Stop hook callback. Triggers option detection. See Section 31. |
| `POST` | `/api/hooks/session-start` | SessionStart hook callback. Captures Claude session ID. |
| `POST` | `/api/hooks/session-end` | SessionEnd hook callback. Clears session state. |
| `POST` | `/api/hooks/subagent-start` | SubagentStart hook callback. Tracks subagent count. |
| `POST` | `/api/hooks/subagent-stop` | SubagentStop hook callback. Decrements subagent count. |

### Claude Session Management

| Method | Path | Description | Request Body |
|---|---|---|---|
| `POST` | `/api/sessions/:id/spawn-claude` | Spawn Claude in an existing PTY | — |
| `POST` | `/api/sessions/:id/resume-claude` | Resume Claude with stored session ID | — |

---

## 26. API Contract: WebSocket Protocol

A **single multiplexed WebSocket** connection per browser tab is established at `ws://host:port/ws`. All session I/O is multiplexed over this one connection via subscribe/unsubscribe messages. All messages use a JSON envelope:

```typescript
interface WsMessage {
    type: string;
    processId?: string;
    payload: any;
}
```

### Connection Management

**Heartbeat:** The server sends a WebSocket `ping` frame every 30 seconds. Clients must respond with `pong` within 10 seconds. Failure to respond terminates the connection.

**Reconnection:** The client implements exponential backoff reconnection: starting at 1 second, doubling on each failure, capping at 30 seconds. On successful reconnect, the backoff resets to 1 second. After reconnecting, the client automatically:
1. Re-subscribes to the currently active process
2. Fetches current session state via REST
3. Fetches any pending permission prompts

**Server-Side Client State:**

```typescript
interface WsClientState {
    subscribedProcess: string | null;  // processId currently subscribed to
    cleanups: Array<() => void>;       // listener unsubscribe functions
    alive: boolean;                     // heartbeat tracking
}
```

### Client -> Server Messages

| Type | Payload | Description |
|---|---|---|
| `pty-input` | `{ processId: string, data: string }` | Send keystrokes to a process's PTY |
| `pty-resize` | `{ processId: string, cols: number, rows: number }` | Resize a process's PTY |
| `subscribe` | `{ processId: string }` | Subscribe to a process's output stream |
| `unsubscribe` | `{ processId: string }` | Unsubscribe from a process's output |
| `permission:respond` | `{ id: string, decision: "allow" \| "deny" \| "always-allow" }` | Respond to a permission prompt (Section 32) |
| `option:dismiss` | `{ id: string }` | Dismiss an option prompt |

### Server -> Client Messages

| Type | Payload | Description |
|---|---|---|
| `pty-output` | `{ processId: string, data: string }` | Terminal output from a process (base64 or UTF-8) |
| `scrollback` | `{ processId: string, data: string }` | Full scrollback buffer replay on subscribe (see below) |
| `process-state-changed` | `{ processId: string, state: ProcessState, exitCode?: number }` | Process state transition |
| `process-metrics` | `{ processId: string, cpu: number, memory: number, port?: number }` | Metrics update (every 2s) |
| `session:updated` | `{ session: Session }` | Session metadata/state changed (tool, tokens, status) |
| `session:created` | `{ session: Session }` | New session created |
| `session:deleted` | `{ sessionId: string }` | Session removed |
| `agent-subtitle` | `{ processId: string, subtitle: string }` | Live activity text for sessions |
| `notification` | `{ type: "crash" \| "restart" \| "bell" \| "info", processId: string, message: string }` | Notification event |
| `trust-changed` | `{ projectId: string, changes: ConfigDiff }` | mt.yml changed on disk |
| `permission:prompt` | `{ prompt: PermissionPrompt }` | Tool permission request from Claude (Section 32) |
| `permission:resolved` | `{ id: string }` | Permission request resolved |
| `permission:expired` | `{ id: string }` | Permission request timed out |
| `option:prompt` | `{ sessionId: string, question: string, options: string[] }` | Claude presented numbered options (Section 31) |

### Subscribe Flow

1. Client sends `{ type: "subscribe", processId }`
2. Server unsubscribes from any previously subscribed process (cleanup listeners)
3. If PTY is dead and `autorespawn` is enabled → respawn (see Section 31)
4. Server sends `scrollback` message with full buffer content
5. Server registers `onData` listener → forwards `pty-output` to this client
6. Server registers `onExit` listener → forwards `process-state-changed` to this client

### Scrollback Replay

The server stores scrollback in a 512KB ring buffer per process, flushed to SQLite every 3 seconds. On subscribe, the full buffer is sent as a `scrollback` message.

**Client-side chunked writing** prevents main thread blocking during large buffer replay:
- If data ≤ 16KB: write to xterm.js in a single call
- If data > 16KB: split into 16KB chunks, write each with `setTimeout(0)` yield between chunks
- Call `terminal.scrollToBottom()` after each chunk

### WS-Broadcast-First State Updates

Create, delete, and update operations follow the **broadcast-first** pattern for multi-client consistency:
1. Client sends REST request (e.g., `POST /api/sessions`)
2. Server performs the operation
3. Server broadcasts the result via WebSocket (e.g., `session:created`)
4. **All** connected clients (including the originator) update their local state from the broadcast
5. Clients do **not** optimistically update state from REST responses — they wait for the WS broadcast

This ensures all connected browsers see the same state, which is critical since MultiTable supports multiple browsers connecting to the same daemon.

---

## 27. CLI Specification

The `mt` command is the CLI interface to the MultiTable daemon.

### Commands

```bash
mt start                        # Start the daemon and open browser
mt start --port 8080            # Custom port
mt start --host 0.0.0.0         # Allow LAN/Tailscale access
mt stop                         # Stop the daemon and all processes
mt status                       # Show running projects and sessions

mt project create <path>        # Register a new project
mt project list                 # List all registered projects
mt project remove <name>        # Unregister a project

mt session new                  # Start a new agent session in current project
mt session new --agent claude   # Start a Claude Code session
mt session list                 # List all sessions
mt session stop <id>            # Stop a session

mt open                         # Open dashboard in default browser
mt open <project>               # Open a specific project's view
```

### Global Flags

| Flag | Description |
|---|---|
| `--help`, `-h` | Show help |
| `--version`, `-v` | Show version |
| `--json` | Output in JSON format |
| `--quiet`, `-q` | Suppress non-essential output |

### Example Output

```bash
$ mt status
MultiTable v0.1.0 — http://localhost:3000

  my-project (active)
    SESSIONS  2/3 running
      ● Claude Code     running   $0.42
      ● Codex           running   $0.18
      ○ Aider           stopped
    COMMANDS  4/5 running
      ● npm:dev         :5174     0.1% CPU  43 MB
      ● Logs            running
      ● Queue           running
      ● Scheduler       running
      ○ Pint            stopped
```

---

## 28. Configuration System

### `mt.yml` Format

The project-level configuration file. Committed to version control and shared with the team.

```yaml
# mt.yml
name: "my-project"

sessions:
  - name: "Claude Code"
    command: "claude"
    autostart: true

  - name: "Codex"
    command: "codex"
    autostart: false

commands:
  - name: "npm:dev"
    command: "npm run dev"
    autostart: true
    autorestart: false
    terminal_alerts: true
    file_watching:
      - "src/**/*.ts"
      - "resources/**/*.blade.php"

  - name: "Queue"
    command: "php artisan queue:work"
    autostart: true
    autorestart: true

  - name: "Scheduler"
    command: "php artisan schedule:work"
    autostart: true
```

### Local Configuration

Processes stored locally are saved per-project:

```
~/.config/multitable/projects/{project_hash}/local.yml
```

Same format as `mt.yml` but never committed to version control.

### App-Level Configuration

```yaml
# ~/.config/multitable/config.yml
theme: "system"              # "light" | "dark" | "system"
default_editor: "code"       # "code" | "zed" | "cursor" | custom path
default_shell: "/bin/bash"
terminal_font_size: 13
terminal_scrollback: 10000
notifications: true
port: 3000
host: "127.0.0.1"

projects:
  - path: "/home/user/code/my-project"
    shortcut: 1
  - path: "/home/user/code/other-project"
    shortcut: 2
```

### Framework Auto-Detection

When a new project is added, MultiTable scans for known framework indicators and suggests commands:

| File/Pattern | Framework | Suggested Commands |
|---|---|---|
| `package.json` with `dev` script | Node.js | `npm run dev` |
| `artisan` | Laravel | `php artisan serve`, `php artisan queue:work` |
| `Cargo.toml` | Rust | `cargo run`, `cargo watch` |
| `manage.py` | Django | `python manage.py runserver` |
| `Gemfile` with `rails` | Rails | `rails server`, `rails console` |
| `docker-compose.yml` | Docker | `docker compose up` |
| `next.config.*` | Next.js | `npm run dev` or `next dev` |
| `nuxt.config.*` | Nuxt | `npm run dev` or `nuxt dev` |

Auto-detected commands are marked with the "AUTO" badge in the UI.

---

## 29. Cost & Token Tracking

### Strategy

MultiTable tracks per-session cost using two complementary approaches:

1. **Hook-based (Claude Code primary):** The `PostToolUse` hook provides structured token/cost data directly. No regex parsing needed. This is the preferred approach for Claude Code sessions (see Section 31).

2. **Regex-based (fallback for other agents):** Parse agent CLI output for token count and cost lines. Used for agents that don't support hooks (Codex, Aider, Gemini CLI, etc.). Each agent type registers output patterns for extracting cost data. Manual cost entry via UI as a last resort.

### Agent-Specific Parsers

**Claude Code (primary):** Uses `PostToolUse` hook data. Token counts and cost are updated in real-time as each tool completes. No regex maintenance burden.

**Other agents:** Extensible parser system. Each agent type registers output patterns for extracting cost data. Fallback: manual cost entry via the UI.

### Data Model

```typescript
interface CostRecord {
    id: string;
    sessionId: string;
    timestamp: Date;
    tokensIn: number;
    tokensOut: number;
    costUsd: number;
    model: string | null;
}
```

Stored in SQLite `cost_records` table.

### Aggregate Views

- **Per-session**: Total cost and token count for a single session
- **Per-project**: Sum of all session costs within a project
- **Per-day**: Daily cost across all projects

Displayed in the Session Detail panel and on project cards in the Dashboard.

---

## 30. Conflict Detection Engine

### How It Works

MultiTable detects when concurrent sessions touch the same files within a project.

### Implementation

1. **File watching**: chokidar watches the project directory for file changes
2. **Attribution**: When a file changes, determine which session(s) were active and likely responsible (via git status diffing or file event timing)
3. **Overlap detection**: When two or more sessions have modified the same file, flag a conflict
4. **Event emission**: Emit a `conflict-warning` WebSocket event to the frontend with the conflicting session IDs and file paths

### UI Representation

- Warning badge (orange dot) on affected sessions in the sidebar
- Expandable detail panel showing which files conflict and which sessions are involved
- Toast notification on first detection

### Limitations

This is heuristic-based in MVP. Accurate attribution requires either:
- Sessions working on separate git branches (ideal)
- Timestamp-based correlation of file events to session activity

More sophisticated approaches (git worktrees per session, etc.) are deferred to future versions.

---

## 31. Claude Code Integration

MultiTable is agent-agnostic, but Claude Code is the primary agent. This section specifies deep integration via Claude Code's hook system, providing structured event data instead of fragile regex parsing.

### Agent Adapter Architecture

```typescript
interface AgentAdapter {
    type: string;                           // "claude-code", "codex", "aider", etc.
    install(sessionId: string): Promise<void>;    // setup hooks/watchers for this agent
    uninstall(sessionId: string): Promise<void>;  // teardown
    getSessionId(): string | null;          // agent-native session ID (for resume)
    canResume(): boolean;                   // does this agent support session resume?
    getResumeCommand(sessionId: string): string;  // e.g., "claude --resume {id}"
}
```

`ClaudeCodeAdapter` is the first (and MVP-only) implementation. Other agents fall back to regex-based output parsing for cost/token tracking.

### Hook System

Claude Code supports hooks — HTTP callbacks fired at key lifecycle events. MultiTable registers these hooks in `~/.claude/settings.json` at daemon startup.

#### Hook Installation

The `HookManager` checks `~/.claude/settings.json` on startup. If MultiTable's hooks are not present, it adds them:

```jsonc
// ~/.claude/settings.json (managed entries)
{
  "hooks": {
    "PreToolUse": [
      { "type": "command", "command": "curl -s -X POST http://localhost:{port}/api/hooks/pre-tool-use -H 'Content-Type: application/json' -d \"$HOOK_DATA\"" }
    ],
    "PostToolUse": [
      { "type": "command", "command": "curl -s -X POST http://localhost:{port}/api/hooks/post-tool-use -H 'Content-Type: application/json' -d \"$HOOK_DATA\"" }
    ],
    "Stop": [
      { "type": "command", "command": "curl -s -X POST http://localhost:{port}/api/hooks/stop -H 'Content-Type: application/json' -d \"$HOOK_DATA\"" }
    ],
    "SessionStart": [
      { "type": "command", "command": "curl -s -X POST http://localhost:{port}/api/hooks/session-start -H 'Content-Type: application/json' -d \"$HOOK_DATA\"" }
    ],
    "SessionEnd": [
      { "type": "command", "command": "curl -s -X POST http://localhost:{port}/api/hooks/session-end -H 'Content-Type: application/json' -d \"$HOOK_DATA\"" }
    ],
    "SubagentStart": [
      { "type": "command", "command": "curl -s -X POST http://localhost:{port}/api/hooks/subagent-start -H 'Content-Type: application/json' -d \"$HOOK_DATA\"" }
    ],
    "SubagentStop": [
      { "type": "command", "command": "curl -s -X POST http://localhost:{port}/api/hooks/subagent-stop -H 'Content-Type: application/json' -d \"$HOOK_DATA\"" }
    ]
  }
}
```

The `HookManager` preserves any existing user hooks — it only adds MultiTable's entries, never removes others. On daemon shutdown, hooks are left in place (they fail silently when the daemon is not running).

#### Hook Receiver

Express routes at `/api/hooks/:eventName` receive callbacks from Claude Code. Each hook maps to enriched session state:

| Hook | Payload (from Claude) | MultiTable Action |
|---|---|---|
| `PreToolUse` | `{ tool_name, tool_input, session_id }` | Route to Permission System (Section 32). **Holds HTTP response open** until user decision. |
| `PostToolUse` | `{ tool_name, tool_input, tool_result, session_id }` | Update `currentTool`, increment `toolCount`, update `tokenCount`, set status `active`. Emit `session:updated` WS. |
| `Stop` | `{ session_id, stop_reason }` | Clear `currentTool`, set status `idle`. Trigger Option Detection (see below). Emit `session:updated` WS. |
| `SessionStart` | `{ session_id }` | Capture and store `claude_session_id` in SQLite. |
| `SessionEnd` | `{ session_id }` | Clear `currentTool`, set status `idle`. |
| `SubagentStart` | `{ session_id, subagent_id }` | Track active subagent count. Set status `active`. |
| `SubagentStop` | `{ session_id, subagent_id }` | Decrement subagent count. |

### Enriched Session State

Claude Code sessions carry additional volatile state beyond the generic `ProcessState`:

```typescript
interface ClaudeSessionState {
    claudeSessionId: string | null;  // Claude's native session ID (for resume)
    currentTool: string | null;      // tool currently being executed
    toolCount: number;               // total tools used in this session
    tokenCount: number;              // total tokens consumed
    lastActivity: number;            // Unix timestamp of latest hook event
    activeSubagents: number;         // count of running subagents
}
```

This state is stored in-memory (volatile) and updated by hook callbacks. It supplements the generic `ManagedProcess` state. The `claudeSessionId` is also persisted to SQLite for resume capability.

### Session ID Tracking

When a Claude Code session starts, the `SessionStart` hook provides the Claude session ID. This is stored in the `sessions` table (`claude_session_id` column) and enables resume.

**Fallback (for sessions started before hooks were installed):** Poll `~/.claude/projects/{encoded-cwd}/` for new `.jsonl` session files. Snapshot existing files before spawning Claude, then poll every 500ms for up to 15 seconds to detect the new file. Path encoding follows Claude Code's convention (e.g., `/home/user/project` → directory name under `~/.claude/projects/`).

### Session Resume

When a session's PTY is alive but Claude is not running, the user can resume the previous Claude conversation:

1. User clicks "Resume" button in session header (visible when `claude_session_id` is set and Claude is not active)
2. Frontend calls `POST /api/sessions/:id/resume-claude`
3. Daemon writes `claude --resume {claudeSessionId}\r` to the session's PTY
4. Claude Code reconnects to the existing conversation

### Session Respawn on Subscribe

When a client subscribes to a session whose PTY has exited:

1. Server detects PTY is dead
2. If session config has `autorespawn: true` (default for sessions, `false` for commands):
   - Spawn a new PTY with the session's stored shell and cwd
   - Send scrollback from DB to the client
   - If `claude_session_id` is set: write `claude --resume {id}\r` to auto-resume
   - Emit `process-state-changed` with new status
3. If `autorespawn: false`: send scrollback only (for reviewing completed sessions)

### Option Detection

When Claude presents numbered options (e.g., "Which approach do you prefer? 1. Option A, 2. Option B"), MultiTable detects this and shows clickable buttons.

**Detection flow:**

1. `Stop` hook fires → daemon receives `session_id`
2. Read last assistant message from Claude's JSONL transcript file at `~/.claude/projects/{encoded-cwd}/{session_id}.jsonl`
3. Parse for consecutive numbered items (1 through N, where 2 ≤ N ≤ 8)
4. Each option must be ≤ 150 characters
5. Check surrounding text for question signal words: "which", "what", "choose", "select", "prefer", "option", "pick"
6. If match: broadcast `option:prompt` WS message

**UI:**

- `OptionSelector` component appears below the terminal when `option:prompt` received
- Shows the question text and numbered buttons for each option
- **Keyboard**: digit keys (1-9) select an option
- **Click**: button click sends `pty-input` with `{number}\r`
- **Auto-clear**: dismissed when new PTY output detected (user already answered via terminal)
- **Manual dismiss**: Escape key or close button

---

## 32. Agent Permission System

MultiTable intercepts Claude Code's tool permission requests, allowing the user to approve or deny tools from the browser UI instead of requiring direct terminal interaction. This is critical for managing multiple concurrent sessions — the user can approve permissions across all sessions from one place.

### Architecture

Claude Code's `PreToolUse` hook fires an HTTP request **before** executing any tool. MultiTable's daemon receives this request and **holds the HTTP response open** until the user makes a decision or a timeout expires. This is the held-response pattern: Claude Code blocks waiting for the HTTP response, and MultiTable controls the flow.

### PermissionManager

```typescript
class PermissionManager {
    pending: Map<string, {
        prompt: PermissionPrompt;
        res: express.Response;       // held-open Express response
        timer: ReturnType<typeof setTimeout>;
        claudeSessionId: string;
        sessionId: string;           // MultiTable session ID
    }>;
    alwaysAllowed: Set<string>;      // "${claudeSessionId}:${toolName}"
}

interface PermissionPrompt {
    id: string;                      // unique request ID
    sessionId: string;               // MultiTable session ID
    claudeSessionId: string;
    toolName: string;
    toolInput: Record<string, any>;
    createdAt: number;               // Unix timestamp
    timeoutMs: number;               // 110000 (110s)
}
```

### Decision Flow

```
1. Claude Code: POST /api/hooks/pre-tool-use { tool_name, tool_input, session_id }
2. PermissionManager.createRequest(payload, res):
   a. If tool is in auto-defer list → respond immediately with empty body (defer to Claude's native system)
   b. If "${claudeSessionId}:${toolName}" in alwaysAllowed → respond with { permissionDecision: "allow" }
   c. Otherwise → hold response, start 110s timer, broadcast permission:prompt via WS
3. UI shows PermissionCard with tool details and countdown
4. User clicks Allow / Deny / Always Allow
5. Client sends WS: { type: "permission:respond", id, decision }
6. PermissionManager.resolveRequest(id, decision):
   a. If "always-allow" → add to alwaysAllowed set, respond with allow
   b. If "allow" → respond: 200 { hookSpecificOutput: { permissionDecision: "allow" } }
   c. If "deny" → respond: 200 { hookSpecificOutput: { permissionDecision: "deny" } }
   d. Clear timer
7. Claude Code proceeds (or skips tool if denied)
```

### Auto-Defer List

Safe, read-only tools are deferred to Claude's native permission system (no UI prompt needed):

```typescript
const DEFAULT_AUTO_DEFER_TOOLS = [
    "Read", "Grep", "Glob", "LS",
    "TodoRead", "TodoGet", "WebSearch"
];
```

This list is configurable per-project in `mt.yml`:

```yaml
# mt.yml
permissions:
  auto_defer:
    - Read
    - Grep
    - Glob
    - LS
    - TodoRead
    - TodoGet
```

### Timeout Behavior

- **Server timeout**: 110 seconds (10s buffer before Claude's 120s timeout)
- On timeout: auto-deny the request, respond with `{ hookSpecificOutput: { permissionDecision: "deny" } }`
- Broadcast `permission:expired` WS message to clear UI

### Always Allow Scope

- Scoped to `${claudeSessionId}:${toolName}` — a new Claude session resets all "Always Allow" decisions
- Stored in-memory only (not persisted to DB), so daemon restart also resets
- This is intentional: permissions should not be permanently auto-granted

### UI: PermissionBar

The `PermissionBar` component shows stacked permission cards above the status bar (or inline in the terminal view for the active session):

- **Tool name** in bold
- **Tool input** as formatted JSON (collapsible for large inputs)
- **Session name** (which session is asking)
- **Countdown bar** — animated from 100% to 0% width over the timeout period, using `requestAnimationFrame` and CSS `transform: scaleX()`
- **Three buttons**: Allow (green), Deny (red), Always Allow (blue)
- Cards stack vertically when multiple permissions are pending across sessions

---

# Part VI: Security, Notifications & Theme

## 33. Security & Trust Model

### Principles

1. **Never auto-run untrusted commands.** MultiTable only runs commands the user explicitly added or previously approved.
2. **Detect config changes.** If `mt.yml` changes (e.g., after `git pull`), MultiTable shows a diff and asks for confirmation before running new or modified commands.
3. **No API key access.** MultiTable never reads, stores, or transmits agent API keys. Agents use whatever credentials are configured on the user's machine.
4. **Local-first.** All data stays on the user's machine. No telemetry.
5. **Localhost by default.** The daemon binds to `127.0.0.1` by default. Binding to `0.0.0.0` for LAN/Tailscale access requires explicit opt-in via config or CLI flag.
6. **Agent tool permissions.** Claude Code tool executions are gated through the Permission System (Section 32). Users approve or deny tool use from the browser UI, with configurable auto-defer for safe read-only tools.

### Trust Flow

```
git pull → mt.yml modified
    → daemon detects file change (chokidar watching mt.yml)
    → computes diff against last known good version
    → emits trust-changed WebSocket event
    → frontend shows Trust Dialog with changes
    → user approves or rejects
    → if approved: new config loaded, SHA-256 hash updated in trust.json
    → if rejected: old config persists
```

### Hash Tracking

```json
// ~/.config/multitable/projects/{hash}/trust.json
{
  "last_approved_hash": "a1b2c3d4...",
  "approved_at": "2026-04-15T10:30:00Z"
}
```

---

## 34. Notification System

### Notification Triggers

| Event | Notification Type | Content |
|---|---|---|
| Process crashed | Browser notification | "{name} crashed in {project}" |
| Process auto-restarted | In-app toast | "{name} restarted automatically" |
| Auto-restart limit reached | Browser notification | "{name} crashed {n} times, stopped trying" |
| Terminal bell character (`\x07`) | Browser notification (if `terminal_alerts` enabled) | "{name} needs attention" |
| `mt.yml` changed | In-app dialog | Trust confirmation dialog |
| Orphaned processes found | In-app dialog | Orphan recovery dialog |
| Permission prompt pending | In-app overlay (PermissionBar) | Tool name, input, countdown timer |
| Permission expired | In-app toast | "{session}: {tool} permission timed out" |
| Option prompt detected | In-app overlay (OptionSelector) | Clickable numbered option buttons |
| Session respawned | In-app toast | "{session} respawned automatically" |

### In-App Toasts

Small notification banners appearing top-right of the main pane. Auto-dismiss after 5 seconds. Used for non-critical events like auto-restarts.

### Browser Notifications

Uses the Browser Notification API for OS-level alerts. Requires user permission grant on first use. Used for critical events like process crashes.

---

## 35. Theme System

### Modes

- **Light** — white backgrounds, dark text
- **Dark** — dark backgrounds, light text
- **System** — follows OS preference via `prefers-color-scheme`, switches automatically

### Implementation

CSS custom properties defined at `:root`, switched by adding `data-theme="dark"` to `<html>`. The daemon reads theme preference from config and the frontend respects it. System mode uses `window.matchMedia('(prefers-color-scheme: dark)')`.

### Terminal Theming

xterm.js theme object is swapped when the app theme changes:

```typescript
const lightTheme = {
    background: '#FFFFFF',
    foreground: '#111111',
    cursor: '#111111',
    black: '#000000',
    red: '#ef4444',
    green: '#22c55e',
    yellow: '#eab308',
    blue: '#3b82f6',
    magenta: '#a855f7',
    cyan: '#06b6d4',
    white: '#e5e7eb',
    // bright variants...
};

const darkTheme = {
    background: '#1a1a1a',
    foreground: '#e5e5e5',
    cursor: '#e5e5e5',
    // ... adjusted for dark backgrounds
};
```

TailwindCSS dark mode uses the `class` strategy, toggled by the `data-theme` attribute.

---

# Part VII: Roadmap & Future

## 36. MVP Build Phases

### v0.1 — Foundation

1. Daemon boots and serves the React app
2. Single embedded terminal using xterm.js + node-pty + WebSocket
3. Create / switch between projects
4. Multiple terminals per project

### v0.2 — Persistence & Dashboard

5. Session/process persistence (survive daemon restart via SQLite)
6. Dashboard view — grid overview of all projects
7. Status indicators (idle, running, errored, completed)

### v0.3 — Git Integration

8. Diff viewer per session (via simple-git)
9. Rollback to pre-session git state
10. File explorer panel

### v0.4 — Claude Code Integration

11. Claude Code hook system (Section 31) — structured state tracking, session ID capture
12. Permission system (Section 32) — approve/deny tool use from browser UI
13. Option detection — clickable numbered option buttons
14. Session resume — `claude --resume` for session continuity
15. Session respawn on subscribe — auto-respawn dead PTYs

### v0.5 — Intelligence

16. Token / cost tracking per session (hook-based for Claude, regex fallback for others)
17. Session timeline (structured agent activity log)
18. Session archive with full-text search
19. Scratchpad per session (CodeMirror 6)

### v0.6 — Polish

20. Conflict detection (cross-session file overlap)
21. CLI (`mt` commands)
22. Notification system (browser notifications + in-app toasts)
23. Trust model for mt.yml changes

---

## 37. Future Features

**Multi-User / Tailscale Access** — Multiple browsers connecting to the same daemon, with presence indicators and role-based access (operator vs spectator).

**Session Templates** — Pre-loaded contexts: "debugging session", "feature session", "refactor session" — each with tailored instructions and constraints.

**Plugin System** — Community-contributed custom panels (Jira integration, test runner view, monitoring dashboard).

**Session Fork & Handoff** — Duplicate a session's context and branch in a different direction. Transfer context from one session to seed another.

**Agent Memory** — Persistent project notes that carry forward across sessions: "this project uses pnpm", "don't touch the legacy auth module." Auto-injected into new sessions.

**Dependency Graph Overlay** — Visualize how the code Session A is building connects to what Session B is modifying.

**Merge Queue** — When concurrent sessions finish, determine the cleanest order to land their changes.

**MCP Server** — Expose process state to AI agents via Model Context Protocol. Agents can list processes, read logs, restart services, and see project info.

**Split-Pane Terminal** — Show two terminals side-by-side in the main pane.

**Process Grouping** — Group related commands (e.g., "Backend" group with server + queue + scheduler).

**Remote Projects** — SSH into a remote machine and manage processes there.

**Mobile Support** — Responsive layout for iPad/phone access over Tailscale: bottom sheet sidebar, ComposeBar textarea for terminal input, touch toolbar for special keys (Ctrl+C, arrows, Tab, Esc), pinch-to-zoom for font scaling, touch-to-mouse translation for xterm selection, wide scrollbars for touch targets.

**Conversation Browser** — Browse past Claude Code session transcripts. List `.jsonl` files from `~/.claude/projects/`, read/search their contents, view structured conversation history alongside the terminal.

---

## 38. Open Questions

- **Default layout**: Sidebar + single main pane, or support grid/split views from the start?
- **State management**: ~~Zustand vs Jotai vs other lightweight store?~~ **Resolved: Zustand with sliced architecture** (projectSlice, processSlice, uiSlice, permissionSlice, optionSlice). WS-broadcast-first pattern for multi-client consistency.
- **Monorepo tooling**: npm workspaces (current) vs Turborepo for build caching?
- **Conflict detection strategy**: Git worktrees per session vs timestamp-based file attribution?
- **Auth model**: For multi-user/Tailscale access — Tailscale identity, token-based, or open by default?
- **Licensing model**: Fully open source (MIT) vs open core with paid team features?
- **Hook installation UX**: Should the daemon auto-install Claude Code hooks silently, or show a confirmation dialog first? Current design: auto-install silently, hooks fail gracefully when daemon is offline.
- **Permission auto-defer scope**: Per-project (via `mt.yml`) vs global config. Current design: per-project with global defaults.

---

# Appendices

## Appendix A: Brand & Distribution

| Channel | Name |
|---|---|
| Website | `multitable.dev` |
| GitHub | `github.com/multitable-dev/multitable` |
| npm | `multitable` |
| CLI binary | `mt` |
| Tagline | *"Stop single-tabling your code."* |

Note: The "MultiTable" name is retained as a brand. User-facing terminology uses standard developer terms (projects, sessions, dashboard) rather than the original poker metaphor.

---

## Appendix B: Data Flow Diagrams

### Daemon Startup Flow

```
1. Daemon launches
2. Read ~/.config/multitable/config.yml → load projects, theme, port
3. Check pids.json for orphaned processes
   → If found: notify frontend to show OrphanDialog
4. For each project: read mt.yml + local.yml
   → Compare mt.yml hash against trust.json
   → If changed: notify frontend to show TrustDialog
5. Open SQLite database
6. Set active project (last active, or first)
7. For active project: start all autostart processes
   → For each: spawn PTY, start monitor, update PID tracker
8. Start file watcher on mt.yml + configured watch patterns
9. Start metrics polling (every 2 seconds)
10. Serve frontend static files + begin listening
11. Ready.
```

### User Selects a Process

```
1. User clicks "Claude Code" in sidebar
2. Frontend: setSelectedProcess("claude_code_id")
3. Frontend: TerminalManager.attach("claude_code_id", containerRef)
   → If terminal instance exists: reattach to DOM (preserves scrollback)
   → If not: create new xterm.js instance, subscribe via WebSocket
4. Frontend: send pty-resize message with current cols/rows
5. StatusBar updates to show Claude Code metrics
6. Browser tab title updates to "MultiTable - my-project - Claude Code"
```

### Process Crash and Auto-Restart

```
1. Child process exits with non-zero code
2. Daemon monitor detects exit
3. Emit process-state-changed WebSocket event (state: errored)
4. Check autorestart config
   → If disabled: emit notification, stay in errored state
   → If enabled: check restartCount < max
     → If limit reached: emit notification, stay in errored state
     → If OK: sleep(delayMs), then restart
5. On restart: spawn new PTY, emit process-state-changed (running)
6. Frontend: sidebar dot updates, notification toast appears
```

### WebSocket Connection Lifecycle

```
1. Browser opens page → establishes WebSocket to ws://host:port/ws
2. Client sends subscribe messages for visible processes
3. Server streams pty-output, metrics, state changes
4. On process switch: client sends unsubscribe for old, subscribe for new
5. On disconnect: server cleans up subscriptions (processes keep running)
6. On reconnect: client re-subscribes, receives current state snapshot
```

### CLI-to-Daemon Communication

```
1. User runs: mt session new --agent claude
2. CLI reads ~/.config/multitable/config.yml to find daemon port
3. CLI sends POST /api/projects/:id/sessions { name: "Claude Code", command: "claude" }
4. Daemon creates session, spawns PTY, returns session object
5. CLI prints confirmation: "Session 'Claude Code' started"
6. Frontend (if open) receives WebSocket event, updates UI
```

---

## Appendix C: Dependency Manifest

### packages/daemon

| Package | Purpose |
|---|---|
| `express` | HTTP server and REST API |
| `ws` | WebSocket server |
| `node-pty` | PTY session spawning |
| `better-sqlite3` | SQLite database |
| `chokidar` | File system watching |
| `simple-git` | Git operations |
| `commander` | CLI argument parsing (shared with cli package) |
| `glob` | File pattern matching |
| `uuid` | Process and project IDs |
| `yaml` | YAML parsing for mt.yml |

### packages/web

| Package | Purpose |
|---|---|
| `react` | UI framework |
| `react-dom` | React DOM renderer |
| `xterm` | Terminal emulation |
| `@xterm/addon-fit` | Auto-fit terminal to container |
| `@xterm/addon-web-links` | Clickable URLs in terminal |
| `zustand` | State management |
| `tailwindcss` | Styling |
| `cmdk` | Command palette |
| `react-hot-toast` | Toast notifications |
| `lucide-react` | Icons |

### packages/cli

| Package | Purpose |
|---|---|
| `commander` | CLI argument parsing |

### Dev Dependencies (root)

| Package | Purpose |
|---|---|
| `typescript` | Type checking |
| `vite` | Frontend build tool |
| `vitest` | Test runner |
| `eslint` | Linting |
| `prettier` | Code formatting |

---

*This document is the single source of truth for the MultiTable product specification. It covers product definition, architecture, UI design system, frontend views, backend systems, configuration, and roadmap.*
