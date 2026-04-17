---
name: node-pty
description: Build web-based terminals by wiring node-pty on a Node.js backend to xterm.js in a React frontend over WebSockets. Use this skill whenever the user mentions node-pty, wants to embed a shell/terminal in a web UI, build a browser-based SSH or REPL interface, a cloud IDE terminal, a remote shell tool, a dev-container console, or anything that connects xterm.js to a real PTY — even if they don't name the library. Also use for Express + ws terminal servers, ConPTY on Windows, PTY resize/fit handling, multi-session terminal backends, and reconnection/session persistence for web terminals.
---

# node-pty + xterm.js + React

A guide for building browser-based terminals backed by a real pseudo-terminal. The user types in an xterm.js component in React, keystrokes travel over a WebSocket to a Node server, a node-pty child process receives them and streams output back the same way.

## The architecture that actually works

node-pty is a **native Node.js module**. It calls `forkpty(3)` on Unix and ConPTY on Windows. It **cannot run in the browser** — there's no way around this. Every working architecture looks like:

```
┌─────────────────────┐       WebSocket        ┌──────────────────────┐
│  React + xterm.js   │ ◄──── binary frames ──► │  Node + Express + ws │
│    (browser)        │                         │      + node-pty      │
└─────────────────────┘                         └──────────┬───────────┘
                                                           │ forkpty / ConPTY
                                                           ▼
                                                   ┌───────────────┐
                                                   │  bash / zsh / │
                                                   │  powershell   │
                                                   └───────────────┘
```

Before writing any code, confirm the user has a Node backend in their plan. If they describe "just a React app" with no server component, correct the misconception first — there's no fix for this at the frontend layer.

## Packages

Install the scoped `@xterm/*` packages. The old unscoped `xterm` and `xterm-addon-*` packages are deprecated and no longer maintained; using them is a common source of stale tutorials and wrong imports.

**Frontend (React app):**
```bash
npm install @xterm/xterm @xterm/addon-fit
```

**Backend (Node server):**
```bash
npm install express ws node-pty
```

node-pty is a native module. It ships prebuilt binaries for common platforms, but on unsupported targets it falls back to compiling with node-gyp, which needs Python and a C++ toolchain (Xcode CLT on macOS, build-essential on Linux, Visual Studio Build Tools on Windows). If the user's install fails, that's almost always why. Mention this early if they're on an unusual platform or in a minimal Docker image.

## Minimal end-to-end example

This is the smallest thing that works. Build up from here.

### Backend: `server.js`

```js
import express from 'express';
import { WebSocketServer } from 'ws';
import * as pty from 'node-pty';
import os from 'node:os';
import http from 'node:http';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/pty' });

const shell = os.platform() === 'win32' ? 'powershell.exe' : (process.env.SHELL || 'bash');

wss.on('connection', (ws) => {
  const ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-color',
    cols: 80,
    rows: 24,
    cwd: process.env.HOME,
    env: process.env,
  });

  // PTY output -> browser
  ptyProcess.onData((data) => {
    // ws.send can throw if socket is closing
    if (ws.readyState === ws.OPEN) ws.send(data);
  });

  // Browser input -> PTY
  ws.on('message', (msg) => {
    // msg may be a Buffer or string depending on client; normalize
    const text = typeof msg === 'string' ? msg : msg.toString('utf8');

    // See "Control messages" below for why this is a JSON-discriminator
    // in a real app. For the minimal version, everything is raw input:
    ptyProcess.write(text);
  });

  ptyProcess.onExit(() => ws.close());
  ws.on('close', () => ptyProcess.kill());
});

server.listen(3001, () => console.log('pty server on :3001'));
```

### Frontend: `Terminal.jsx`

```jsx
import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

export function TerminalView() {
  const hostRef = useRef(null);

  useEffect(() => {
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: 'Menlo, Consolas, "DejaVu Sans Mono", monospace',
      fontSize: 14,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(hostRef.current);
    fit.fit();

    const ws = new WebSocket('ws://localhost:3001/pty');
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      // Tell the server our actual size before we send any input
      term.onData((data) => ws.send(data));
    };
    ws.onmessage = (e) => {
      const data = typeof e.data === 'string'
        ? e.data
        : new TextDecoder().decode(e.data);
      term.write(data);
    };

    return () => {
      ws.close();
      term.dispose();
    };
  }, []);

  return <div ref={hostRef} style={{ width: '100%', height: '100%' }} />;
}
```

Two things in the minimal version you'll almost certainly need to upgrade:
1. Messages on the wire are just raw bytes — there's no way to distinguish input from a resize event. See **Control messages** below.
2. `fit.fit()` runs once. The terminal won't track container resizes. See **Resize handling** below.

## Control messages: structuring the protocol

Real terminals need more than raw input. At minimum: resize events. Often also: ping/pong, session attach, title changes. The clean solution is a small discriminated-union protocol — JSON for control, raw strings for data — or alternatively use a 1-byte tag prefix on binary frames.

JSON-envelope approach (simplest to reason about):

```js
// Client -> Server
{ type: 'input', data: 'ls\r' }
{ type: 'resize', cols: 120, rows: 40 }

// Server -> Client
{ type: 'output', data: '...' }
{ type: 'exit', code: 0 }
```

Server side:
```js
ws.on('message', (msg) => {
  let parsed;
  try { parsed = JSON.parse(msg.toString('utf8')); } catch { return; }
  if (parsed.type === 'input') ptyProcess.write(parsed.data);
  else if (parsed.type === 'resize') ptyProcess.resize(parsed.cols, parsed.rows);
});

ptyProcess.onData((data) => {
  ws.send(JSON.stringify({ type: 'output', data }));
});
ptyProcess.onExit(({ exitCode }) => {
  ws.send(JSON.stringify({ type: 'exit', code: exitCode }));
});
```

For high-throughput use cases (e.g. running `find /` or `yes`), JSON-wrapping every data chunk adds measurable overhead. Either switch to a binary tag-byte protocol or leave data messages raw and reserve JSON for control frames — distinguish by checking whether the incoming message starts with `{`.

## Resize handling

Terminals without resize handling look fine until the user opens one. If the container dimensions don't match the PTY dimensions, line wrapping breaks, `vim` draws off-screen, and `clear` leaves artifacts. Handle this in three places:

**1. On the frontend, run `fit` whenever the container changes size.** A `ResizeObserver` on the host div is more reliable than a window resize listener:

```jsx
useEffect(() => {
  const ro = new ResizeObserver(() => {
    try { fit.fit(); } catch { /* terminal not yet open */ }
  });
  ro.observe(hostRef.current);
  return () => ro.disconnect();
}, []);
```

**2. Send the new dimensions to the server whenever xterm's dimensions actually change:**

```jsx
term.onResize(({ cols, rows }) => {
  ws.send(JSON.stringify({ type: 'resize', cols, rows }));
});
```

Use `term.onResize`, not your own fit-addon callback — this fires only when the cell grid actually changes, which is what matters.

**3. On the server, call `ptyProcess.resize(cols, rows)`** as shown in the control-messages section above.

Also send an initial resize right after the WebSocket opens, before any input — otherwise the PTY spawns at the default 80×24 and the first render is wrong.

## Multiple concurrent sessions

Don't share a PTY across connections, and don't use a single global ws endpoint that multiplexes. The natural model is: one WebSocket connection = one PTY. The `wss.on('connection', ...)` handler already gives you this — each connection gets its own `ptyProcess` in closure scope.

What you typically need on top of that:

**Session IDs for reattachment.** Give each PTY a UUID, keep a `Map<sessionId, { pty, scrollback, subscribers }>` on the server, and let clients open `ws://.../pty?sessionId=xxx` to attach to an existing session instead of creating a new one. The query string is parsed from `req.url` in the connection handler:

```js
import { parse as parseUrl } from 'node:url';
import { randomUUID } from 'node:crypto';

const sessions = new Map();

wss.on('connection', (ws, req) => {
  const { query } = parseUrl(req.url, true);
  let session;

  if (query.sessionId && sessions.has(query.sessionId)) {
    session = sessions.get(query.sessionId);
  } else {
    const id = randomUUID();
    const ptyProcess = pty.spawn(shell, [], { /* ... */ });
    session = { id, pty: ptyProcess, scrollback: [], subscribers: new Set() };
    sessions.set(id, session);

    ptyProcess.onData((data) => {
      session.scrollback.push(data);
      // Keep scrollback bounded — see reconnection section
      if (session.scrollback.length > 1000) session.scrollback.shift();
      for (const sub of session.subscribers) {
        if (sub.readyState === sub.OPEN) sub.send(data);
      }
    });

    ptyProcess.onExit(() => {
      for (const sub of session.subscribers) sub.close();
      sessions.delete(id);
    });
  }

  session.subscribers.add(ws);
  // Tell the client their session id so they can reconnect
  ws.send(JSON.stringify({ type: 'session', id: session.id }));
  // Replay scrollback
  for (const chunk of session.scrollback) ws.send(chunk);

  ws.on('message', (msg) => session.pty.write(msg.toString('utf8')));
  ws.on('close', () => session.subscribers.delete(ws));
});
```

**Cap the total number of PTYs** per user and globally. Each one is a real process. A loop that spawns PTYs without bounds is a trivial DoS against your own server.

**Kill orphans.** If all subscribers disconnect and nobody reattaches within some window (e.g. 5 minutes), kill the PTY. Otherwise a user closing their laptop leaves processes running forever.

## Reconnection and session persistence

"Persistence" here means two different things; be clear with the user which one they want:

**In-memory survival across WebSocket disconnects.** The session map above already does this. The PTY keeps running while the browser is disconnected. When the client reconnects with the same `sessionId`, it gets the scrollback replayed and resumes receiving live output. This is enough for "I closed my laptop lid and reopened it" scenarios.

**Survival across server restarts.** This is much harder. The PTY is a child process of your Node server; when Node dies, the PTY dies with it. Real solutions involve running PTYs inside `tmux` or `screen` sessions (spawn `tmux new-session -A -s <id>` instead of bash directly), or using `dtach`. Then even if Node restarts, the shell is still attached to the multiplexer and can be reattached. Only suggest this if the user explicitly asks for it — it's a significant architectural shift.

**Scrollback buffer size is a tradeoff.** Too small and reconnection feels broken ("where did my output go?"). Too large and memory grows unbounded on busy sessions. A ring buffer of ~1–4MB of text per session is a reasonable default. For richer replay, consider `@xterm/addon-serialize` on a headless `@xterm/headless` instance server-side — it gives you the full terminal state (cursor position, colors, alternate screen) rather than just a text log, which matters for apps like `vim` or `htop`.

## Cross-platform: Windows, macOS, Linux

node-pty abstracts the underlying mechanism, but a few things leak through:

**Shell selection.** `bash` won't exist on Windows; `powershell.exe` won't exist on Linux. Branch on `os.platform()`:
```js
const shell = os.platform() === 'win32'
  ? (process.env.COMSPEC || 'powershell.exe')
  : (process.env.SHELL || 'bash');
```

**Windows uses ConPTY** on Windows 10 1809+ (which is effectively everywhere now). node-pty handles this transparently. On very old Windows, it falls back to winpty, but you can ignore that case unless the user explicitly targets it.

**Line endings.** The PTY handles `\r`/`\n` correctly for each platform — do not translate them in your code. If you see weird double-newlines or missing returns, you're probably normalizing where you shouldn't.

**`cwd` defaults.** `process.env.HOME` is Unix-only; on Windows use `process.env.USERPROFILE`. Or just use `os.homedir()` which works everywhere.

**Installation on Windows** is the most common pain point. If prebuilt binaries aren't available for the user's Node version, the install will try to compile with node-gyp, which on Windows needs Visual Studio Build Tools. Pinning to a Node version with published prebuilds (check the node-pty releases page) avoids this.

## Reference files

For deeper coverage of specific topics, see:

- `references/api.md` — node-pty API surface: `spawn` options, `IPty` methods, xterm.js `Terminal` options and addons worth knowing about.
- `references/security.md` — Why a web terminal is a remote-code-execution endpoint, and what to do about it: auth, sandboxing, command restrictions, rate limiting.
- `references/troubleshooting.md` — Common failure modes: "native module not found," garbled output, cursor in wrong position, Electron ABI mismatch, input not echoing, exit code always 0.

Read these only when the user's question touches their content — don't frontload them into every response.

## When to push back

A few requests sound reasonable but aren't:

- **"Run node-pty in the browser with WASM / `node-pty-web` / etc."** There is no real node-pty in the browser. Some projects emulate a shell in WASM (e.g. running a WASI build of bash); that's a different thing and doesn't give access to the host system. Clarify which the user actually wants.
- **"Just use `child_process.spawn` instead."** You can, but without a PTY, programs that check `isatty()` (which is most interactive programs — `vim`, `top`, `less`, colored output from many CLIs) will behave differently or break. If the user only needs to run one non-interactive command and stream its output, `child_process` is fine and simpler. If they want a shell, they need a PTY.
- **"Expose this to the public internet."** Without authentication, a web terminal is an anonymous remote shell on your server. See `references/security.md` before the user ships anything.
