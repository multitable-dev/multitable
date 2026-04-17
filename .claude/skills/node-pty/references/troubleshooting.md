# Troubleshooting

Common failure modes, roughly ordered by how often they come up.

## Installation / native module issues

### `Error: Cannot find module 'node-pty'` or `... .node` file missing

node-pty is a native module. The prebuilt binary for the current Node version + platform + arch either wasn't shipped or wasn't downloaded.

Check:
1. Node version. node-pty pins its prebuilds to specific Node major versions. If you're on Node 23 and the latest prebuilds go up to 22, you need to either downgrade Node or build from source.
2. Architecture. If you're on Apple Silicon but installed via Rosetta, or vice versa, the binary won't load. `node -p "process.arch"` should match what you expect.
3. If you're in Docker, did you `npm install` on the host and copy `node_modules` into the image? Don't — run `npm install` inside the image. The host might be macOS/arm64 and the image Linux/x64.

Rebuild locally: `npm rebuild node-pty`. This needs Python and a C++ toolchain.

### Electron: `was compiled against a different Node.js version`

node-pty's native binary must match Electron's ABI, not Node's. Use `electron-rebuild` after install, or switch to a fork that ships Electron prebuilds (e.g. `@homebridge/node-pty-prebuilt-multiarch`) if that matches your Electron version.

### Windows install fails with MSBuild / Python errors

The prebuilt binary wasn't available, so it tried to compile. On Windows you need Visual Studio Build Tools with the C++ workload, and Python 3. Easier fixes: pin to a Node LTS with published prebuilds, or use a fork that ships the needed Windows prebuilds.

## Runtime: PTY side

### Input not echoing

The shell echoes input by default; if you're not seeing your keystrokes, something swallowed them. Likely causes:

- You set `term.options.disableStdin = true` or similar.
- You're in an app inside the shell that turned off echo (password prompts do this deliberately). Type blindly or press Ctrl-C.
- You attached to the PTY after the shell set its terminal mode; node-pty is forwarding correctly but the shell thinks it's in a weird state. Send `stty sane\n` and see if it recovers.
- Your WebSocket is sending but the server isn't piping to `ptyProcess.write`. Log on both sides to confirm where the data stops.

### Output is garbled / weird characters

Almost always a UTF-8 boundary issue or a `TERM` mismatch.

- If you're using binary frames and decoding with `TextDecoder`, note that a single chunk can end mid-codepoint. Use `new TextDecoder('utf-8', { fatal: false })` and, ideally, a persistent decoder instance with `{ stream: true }` so it buffers partial codepoints across calls:
  ```js
  const decoder = new TextDecoder('utf-8');
  ws.onmessage = (e) => term.write(decoder.decode(e.data, { stream: true }));
  ```
- Alternatively, pass `Uint8Array` / `Buffer` straight to `term.write` — xterm.js handles UTF-8 assembly internally. This is simpler and faster.
- If output has escape sequences showing as literal characters (`^[[32m` instead of green), the `TERM` env var is wrong or missing. Set it to `xterm-256color`.

### Cursor in wrong position, `vim` draws off-screen, `clear` leaves junk

PTY dimensions don't match xterm.js dimensions. Check:
1. Did you call `fit.fit()` before the first user interaction?
2. Are you sending a resize message to the server with the correct cols/rows?
3. Is the server actually calling `ptyProcess.resize(cols, rows)` on receipt?

Log `term.cols`/`term.rows` on the client and compare against what the server receives. They should match exactly.

### Exit code always 0 (or always null)

`onExit` gives you `{ exitCode, signal }`. On Windows, signal is always `undefined`. If a process was killed by a signal, `exitCode` may be 0 and `signal` tells you what killed it. Check both.

### PTY immediately exits

The shell couldn't start. Common causes:
- `cwd` points to a directory that doesn't exist or isn't readable by the process.
- `env` doesn't include `PATH`, so the shell can't find anything, or `env` is missing `HOME`/`USERPROFILE`, which some shells need at startup.
- The shell binary path is wrong (`/bin/bash` doesn't exist in minimal Alpine containers — it's `/bin/sh`).

Log the spawn args; try running them manually in a regular terminal to repro.

## Runtime: WebSocket / browser side

### Terminal looks correct but input does nothing

Some wiring is wrong between `term.onData` and `ws.send`.

- Is the WebSocket actually open when you try to send? Check `ws.readyState === 1` — sending in `CONNECTING` silently drops data.
- Is your message protocol consistent? If the frontend sends `{type:'input',data:'ls\r'}` but the server `ptyProcess.write(msg)`s the whole JSON blob, nothing useful happens. Parse on both sides or skip the envelope on both sides.

### Terminal renders but is tiny or zero-size

`term.open(div)` ran before the div had dimensions. If the div is `display: none` or has no size yet (e.g. inside a collapsed panel, or before a parent flexbox laid out), xterm measures 0×0.

Fix: call `fit.fit()` after the element becomes visible. In React, a `ResizeObserver` on the host div catches this — when it first reports non-zero size, call `fit.fit()`.

### ResizeObserver loop limit exceeded

Benign warning, but annoying. Debounce the `fit()` call with `requestAnimationFrame`:
```js
const ro = new ResizeObserver(() => {
  requestAnimationFrame(() => {
    try { fit.fit(); } catch {}
  });
});
```

### Memory grows over time

Two common leaks:

1. **Not calling `term.dispose()` on unmount.** In React's StrictMode, the effect runs twice in development; make sure the cleanup function actually tears everything down.
2. **Unbounded scrollback buffers on the server.** If you're replaying scrollback for reconnection, cap the buffer.

### `Mixed Content` error in production

The page is served over HTTPS but the WebSocket URL is `ws://`. Use `wss://`. Compute it from the page's protocol:
```js
const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const ws = new WebSocket(`${proto}//${window.location.host}/pty`);
```

### Works locally, breaks behind nginx / cloudflare / load balancer

The proxy is probably buffering the connection, killing idle WebSockets, or not upgrading the protocol. Check:
- `proxy_http_version 1.1;` and the upgrade headers in nginx.
- Idle timeout raised above whatever your natural terminal idle period is (minutes, not seconds).
- Cloudflare's WebSocket support is on (it's on by default, but some plans/configs disable it).

## Development-only issues

### React StrictMode double-mounts the effect

You'll see two WebSocket connections, two PTYs, and weird interleaved output in development. This is by design — StrictMode is telling you your cleanup is incomplete. Make sure the `useEffect` cleanup both `ws.close()`s and `term.dispose()`s. In most cases the second mount will then work correctly. This goes away in production builds.

### Hot reload duplicates terminals

Same root cause as StrictMode. Dispose on unmount. If the terminal's container div is being reused across reloads, also clear its children in the cleanup.
