<p align="center">
  <!-- Drop a logo at docs/images/logo.png (512x512 PNG recommended). -->
  <img src="docs/images/logo.png" width="180" alt="MultiTable logo">
</p>

<h1 align="center">MultiTable</h1>

<p align="center">
  <em>One cockpit for every AI agent, dev server, and terminal in your workflow.</em><br/>
  <sub>Because <code>tmux</code> wasn't built for the day Claude, Codex, and <code>npm run dev</code> all need your attention at once.</sub>
</p>

<p align="center">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
  <img alt="Platforms: macOS, Linux, Windows" src="https://img.shields.io/badge/platforms-macOS%20%7C%20Linux%20%7C%20Windows-informational">
  <img alt="Node >=18" src="https://img.shields.io/badge/node-%E2%89%A518-brightgreen">
  <img alt="Status: MVP" src="https://img.shields.io/badge/status-MVP-orange">
  <a href="https://github.com/multitable-dev/multitable/actions"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/multitable-dev/multitable/ci.yml?branch=master"></a>
</p>

<p align="center">
  <!-- Record a 15–30s screen cap with asciinema or kap, save as docs/images/demo.gif -->
  <img src="docs/images/demo.gif" alt="MultiTable in action" width="760">
</p>

---

## What is this?

MultiTable is a **local, browser-based dashboard** for the chaos of agentic coding. A small Node.js daemon on your machine spawns your processes via real PTYs (thanks, [`node-pty`](https://github.com/microsoft/node-pty)), persists state in SQLite, and serves a React UI at `http://localhost:3000`. One tab. Every project. Every agent. Every dev server.

```
Before MultiTable                      After MultiTable
┌──────┐ ┌──────┐ ┌──────┐             ┌──────────────────────────────┐
│Claude│ │ Codex│ │ npm  │             │  MultiTable (one tab)        │
│ Code │ │      │ │ dev  │             │                              │
└──────┘ └──────┘ └──────┘             │  All processes. One view.    │
┌──────┐ ┌──────┐ ┌──────┐             │  Status at a glance.         │
│Queue │ │ Logs │ │ bash │             │  Auto-restart on crash.      │
│worker│ │      │ │      │             │  Approve perms in the UI.    │
└──────┘ └──────┘ └──────┘             └──────────────────────────────┘
 6+ scattered terminals                  1 tab, everything managed
```

## Why you might want it

- You run **more than one coding agent** at a time (Claude Code + Codex + Aider...) and lose track of which terminal is which.
- Your Claude Code session throws a **permission prompt** while you're on another tab and the run stalls for 30 minutes.
- Your **dev server crashes**, silently, inside one of twelve tmux panes.
- You want to check on a running agent from your **iPad in the kitchen** over Tailscale.
- You want **cost and token usage** per session without scraping logs.

## Features

- **One sidebar, every process.** Sessions (AI agents), commands (dev servers, workers), and terminals (ad‑hoc shells) in a single tree.
- **Permission prompts surface in the UI.** No more missed Claude Code "Allow / Deny / Always Allow" prompts buried in a pane.
- **Auto-restart with backoff.** Configurable `autorestartMax`, `autorestartDelayMs`, and windowed reset — crashes don't mean silence.
- **File-watch restart** for dev servers — edit `src/**/*.ts`, the watcher restarts the right process.
- **Cost & token tracking** per Claude Code session, parsed from hook events.
- **Git diffs** per session, via `simple-git`, so you can see what an agent actually changed.
- **Session resume** — a Claude Code session remembers its `claudeSessionId`, and on daemon startup you decide whether to resume or start fresh.
- **SQLite persistence.** Projects, sessions, commands, scrollback — all survive restarts.
- **LAN / Tailscale access.** Bind the daemon to `0.0.0.0`, open the UI from your phone, iPad, another laptop — same dashboard.
- **Config-as-code.** Drop an `mt.yml` in a project and everything autostarts the way you described.

## Screenshots

> 📸 Drop screenshots into `docs/images/` and these will render.

| Dashboard | Session detail |
|---|---|
| <img src="docs/images/dashboard.png" alt="Dashboard" width="360"> | <img src="docs/images/session-detail.png" alt="Session detail" width="360"> |

| Terminal view | Permission request |
|---|---|
| <img src="docs/images/terminal.png" alt="Terminal view" width="360"> | <img src="docs/images/permission.png" alt="Permission modal" width="360"> |

<details>
<summary>ASCII preview (for repo readers without images)</summary>

```
┌──────────────┬───────────────────────────────────────────────┐
│  SIDEBAR     │  MAIN PANE                                    │
│              │                                               │
│  my-project  │  $ claude                                     │
│   SESSIONS   │  > I'll help you refactor the API...          │
│   ● Claude   │  Reading src/api/routes.ts...                 │
│   ● Codex    │  █                                            │
│   TERMINALS  │                                               │
│   ● Term 1   │  ┌─ Permission Request ─────────────────┐     │
│   COMMANDS   │  │ Claude Code wants to use: Edit       │     │
│   ● npm:dev  │  │ File: src/api/routes.ts              │     │
│   ● Queue    │  │ [Allow]  [Deny]  [Always Allow]      │     │
│              │  └──────────────────────────────────────┘     │
├──────────────┴───────────────────────────────────────────────┤
│ [Focus][Pause][Clear][Stop][Restart]   CPU 2.1%  MEM 43MB   │
└──────────────────────────────────────────────────────────────┘
```

</details>

---

## Installation

MultiTable is pre-npm-publish — you install it from source. All three platforms follow the same three-step dance:

1. **Install prerequisites** (Node + build tools for native modules).
2. **Clone + install + build**.
3. **Link the `mt` CLI** so you can run `mt start` from anywhere.

### Prerequisites (all platforms)

- **Node.js ≥ 18** — <https://nodejs.org/> (LTS is fine)
- **npm ≥ 9** (ships with Node 18+)
- **Git**

> **Why native build tools?** MultiTable depends on `better-sqlite3` and `node-pty`, which are native C/C++ modules. `npm install` will attempt to download prebuilt binaries; if none exist for your platform/Node version, it falls back to building from source and will need a compiler.

### 🍎 macOS

```bash
# 1. Install Xcode Command Line Tools (for native module builds)
xcode-select --install

# 2. Clone, install, build
git clone https://github.com/multitable-dev/multitable.git
cd multitable
npm install
npm run build

# 3. Make `mt` available globally
cd packages/cli && npm link && cd ../..
```

### 🐧 Linux (Debian / Ubuntu)

```bash
# 1. Install build tools
sudo apt-get update
sudo apt-get install -y build-essential python3 git

# 2. Clone, install, build
git clone https://github.com/multitable-dev/multitable.git
cd multitable
npm install
npm run build

# 3. Make `mt` available globally
cd packages/cli && sudo npm link && cd ../..
```

On **Fedora / RHEL**: replace step 1 with `sudo dnf install -y gcc-c++ make python3 git`.
On **Arch**: `sudo pacman -S --needed base-devel python git`.

### 🪟 Windows 10 / 11

**Use PowerShell, not `cmd.exe`.** A few of the npm scripts rely on Unix-ish shell idioms (`cp`), which PowerShell aliases but `cmd.exe` does not.

```powershell
# 1. When installing Node from nodejs.org, check the box:
#    "Automatically install the necessary tools for native modules"
#    (That pulls Visual Studio Build Tools + Python 3 via Chocolatey.)

# 2. Clone, install, build
git clone https://github.com/multitable-dev/multitable.git
cd multitable
npm install
npm run build

# 3. Make `mt` available globally
cd packages\cli
npm link
cd ..\..
```

> **Known Windows limitation:** per-process CPU % shows as `0` on Windows (the metrics poller uses Unix `ps` as a fallback). Memory and state work normally. PR welcome.

### Uninstall

```bash
cd multitable/packages/cli && npm unlink -g
cd ../.. && rm -rf node_modules
rm -rf ~/.config/multitable       # config
rm -rf ~/.local/share/multitable  # SQLite db, scrollback (Linux/macOS path)
```

---

## Quick start

```bash
mt start          # start the daemon on http://localhost:3000
mt open           # open the UI in your browser
```

…or skip the CLI and run dev mode (daemon + Vite with HMR):

```bash
npm run dev
# Daemon:      http://127.0.0.1:3000
# Vite dev UI: http://127.0.0.1:5173  (proxies /api and /ws to the daemon)
```

From the empty dashboard:

1. Click **+ Add Project** → point it at any directory on disk.
2. Add a session (`claude`, `codex`, `aider`, whatever your agent is) or a command (`npm run dev`).
3. Hit **Start**.
4. Grab a drink.

## Configure a project with `mt.yml`

Drop this at the root of any project and MultiTable will pick it up on startup:

```yaml
name: my-project
sessions:
  - name: Claude Code
    command: claude
    autostart: true
commands:
  - name: npm:dev
    command: npm run dev
    autostart: true
    fileWatchPatterns:
      - "src/**/*.ts"
  - name: Queue
    command: php artisan queue:work
    autostart: true
    autorestart: true
    autorestartMax: 5
    autorestartDelayMs: 2000
```

## Global daemon config

`~/.config/multitable/config.yml` (Linux/macOS) — or the equivalent on Windows via [`env-paths`](https://github.com/sindresorhus/env-paths):

```yaml
port: 3000
host: 127.0.0.1   # change to 0.0.0.0 to accept LAN / Tailscale connections
```

## Remote access (iPad in the kitchen, etc.)

1. Set `host: 0.0.0.0` in the config above.
2. Make sure your dev machine is reachable — easiest is [Tailscale](https://tailscale.com).
3. Open `http://<tailscale-hostname>:3000` from any device on the tailnet. Same UI. Full control. Yes you can approve Claude Code permissions from your phone.

---

## Architecture

```mermaid
flowchart TB
    subgraph Browser["Browser (laptop, iPad, phone)"]
        UI["React + xterm.js UI"]
    end

    subgraph Daemon["mt daemon (Node.js on localhost)"]
        Express["Express<br/>REST API"]
        WS["ws<br/>WebSocket stream"]
        PTY["node-pty<br/>ManagedProcess map"]
        DB[("SQLite<br/>better-sqlite3")]
        Watcher["chokidar<br/>file watcher"]
        Git["simple-git<br/>diffs"]
        Hooks["Claude Code<br/>hook receiver"]
    end

    UI -- "REST: CRUD" --> Express
    UI <-- "WS: pty I/O, state, metrics, permissions" --> WS

    Express --> DB
    Express --> PTY
    WS <--> PTY
    Watcher --> PTY
    PTY --> DB
    Hooks --> DB
    Hooks --> WS

    ClaudeCode["Claude Code<br/>(spawned session)"] -- "HTTP hooks" --> Hooks
    PTY -- "spawns" --> ClaudeCode
```

See [`docs/SPEC.md`](docs/SPEC.md) for the full product specification and [`docs/OVERVIEW.md`](docs/OVERVIEW.md) for a deeper visual walkthrough.

## Repository layout

```
packages/
  daemon/   Node.js backend — Express + ws + node-pty + SQLite
  web/      React frontend — xterm.js + Zustand + Tailwind
  cli/      `mt` command (commander)
docs/       Product spec and overview diagrams
```

## Keyboard shortcuts

| Shortcut        | Action                         |
| --------------- | ------------------------------ |
| `Ctrl+K`        | Command palette                |
| `Ctrl+T`        | New terminal                   |
| `Ctrl+W`        | Close terminal                 |
| `Alt+1..9`      | Switch project                 |
| `Alt+S/T/C`     | Jump to Sessions/Terms/Cmds    |
| `Ctrl+Shift+R`  | Restart selected process       |
| `Ctrl+Shift+S`  | Start all processes            |
| `Ctrl+Shift+X`  | Stop all processes             |

## Roadmap

- [x] **v0.1** Foundation — daemon + React + single terminal + projects
- [x] **v0.2** Persistence — SQLite + dashboard + status indicators
- [ ] **v0.3** Git tools — diff viewer, rollback, file explorer
- [ ] **v0.4** Claude Code polish — hooks, permissions, options, resume, respawn
- [ ] **v0.5** Intelligence — cost tracking, timeline, search, scratchpad
- [ ] **v0.6** Polish — conflict detection, CLI ergonomics, notifications

## Contributing

Contributions of all sizes welcome — bug reports, docs fixes, entire features. See [`CONTRIBUTING.md`](CONTRIBUTING.md).

Good first issues are labelled `good first issue`.

## Security

Please **don't open public issues** for vulnerabilities. See [`SECURITY.md`](SECURITY.md).

## License

MIT — see [`LICENSE`](LICENSE).

---

<p align="center"><sub>Built with node-pty, React, SQLite, and a healthy refusal to tmux one more thing.</sub></p>
