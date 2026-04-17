# API Reference

Concise reference for the parts of node-pty and xterm.js that come up most in web-terminal apps. Not exhaustive — the TypeScript declarations in each package are the source of truth.

## node-pty

### `pty.spawn(file, args, options) → IPty`

Spawns a process attached to a new pseudo-terminal.

| Option | Type | Notes |
|---|---|---|
| `name` | `string` | Value of `TERM` env var. Use `'xterm-color'` or `'xterm-256color'`. This tells programs like `ls` and `vim` what escape sequences to emit. |
| `cols` | `number` | Initial width in character cells. Default 80. Send a resize immediately after spawn if your real size differs. |
| `rows` | `number` | Initial height. Default 24. |
| `cwd` | `string` | Working directory. Use `os.homedir()` for cross-platform home. |
| `env` | `object` | Environment variables. Usually `process.env` merged with any additions. Don't forget to preserve `PATH`. |
| `encoding` | `string \| null` | Defaults to `'utf8'`, returning strings from `onData`. Pass `null` to get raw `Buffer`s, which is what you want if you're going to send binary frames over the WebSocket without decoding. |
| `useConpty` | `boolean` | Windows only. `true` by default on supported versions. Leave it alone unless debugging. |
| `handleFlowControl` | `boolean` | Enables software flow control (`XON`/`XOFF`) between the PTY and node-pty. Rarely needed; can cause hangs if the peer doesn't honor it. |

### `IPty` methods

- `write(data: string)` — Send input to the shell. Newline is `\r`, not `\n` — the PTY translates. If you send `\n` you'll often see it treated as a literal newline rather than "enter."
- `resize(cols: number, rows: number)` — Tell the PTY its new dimensions. Triggers `SIGWINCH` inside the shell, which well-behaved programs listen for.
- `kill(signal?: string)` — Send a signal. Defaults to `SIGHUP`. Use `'SIGKILL'` only as a last resort.
- `clear()` — Clears the shell's internal buffer on Windows. No-op elsewhere.
- `pause()` / `resume()` — Backpressure. Useful if your WebSocket send buffer is full and you want to stop draining the PTY momentarily.

### `IPty` events

- `onData((data) => …)` — Fires on every chunk of output. Chunks have no alignment with lines, escape sequences, or UTF-8 codepoints — don't try to parse them in the handler; just forward them.
- `onExit(({ exitCode, signal }) => …)` — Fires once, when the process exits. After this the `IPty` is inert.

### `IPty` properties

- `pid: number` — Process ID. Useful for logging.
- `process: string` — The foreground process name. Updates as the user runs commands. Can be used to show something like "bash — vim" in a tab title.
- `cols: number`, `rows: number` — Current dimensions.

## xterm.js (`@xterm/xterm`)

### `new Terminal(options)`

Common options:

| Option | Notes |
|---|---|
| `cursorBlink` | Bool. Cosmetic. |
| `cursorStyle` | `'block' \| 'underline' \| 'bar'`. |
| `fontFamily` | Use a monospace stack with fallbacks. `'Menlo, Consolas, "DejaVu Sans Mono", monospace'` is a reasonable default. |
| `fontSize` | Number, in px. |
| `lineHeight` | Multiplier. 1.0 is tight, 1.2 is comfortable. |
| `theme` | Object with `background`, `foreground`, `cursor`, `selectionBackground`, and the 16 ANSI colors. |
| `scrollback` | Lines of client-side scrollback. Default 1000. |
| `allowProposedApi` | Bool. Some addons require this. |
| `convertEol` | Bool. If true, `\n` is treated as `\r\n` when writing. You usually want `false` — the PTY already handles this. |
| `macOptionIsMeta` | Bool. Makes Option act as Meta on macOS, which most Unix users expect. |

### Terminal methods

- `open(element)` — Mount into a DOM node. Must be called once before anything renders.
- `write(data, callback?)` — Feed data in. Accepts strings and `Uint8Array`s. Async internally; the callback fires when the data has been processed.
- `writeln(data)` — Same, plus `\r\n`.
- `clear()` — Wipe the viewport. Scrollback is preserved unless you also call `reset()`.
- `focus()` / `blur()` — Self-explanatory.
- `dispose()` — Tear down. Always call this on component unmount or you'll leak listeners and DOM nodes.
- `loadAddon(addon)` — Attach an addon.
- `resize(cols, rows)` — Manually set dimensions. You usually don't call this directly; `FitAddon.fit()` does it based on container size.

### Terminal events

- `onData((data) => …)` — Fires on user input (typed keys, pasted text). This is what you forward to the PTY.
- `onResize(({ cols, rows }) => …)` — Fires when dimensions actually change. Forward to the PTY.
- `onTitleChange((title) => …)` — The shell's OSC 0/2 sequences. Use this to update a tab title.
- `onBell(() => …)` — `\x07`. Traditionally plays a sound; usually just flashes something.
- `onSelectionChange(() => …)` — Useful if you want to wire up a custom "copy on select" flow.

### Useful addons

All under `@xterm/addon-*`:

- **`addon-fit`** — Resizes the terminal to fill its container. Essentially mandatory.
- **`addon-web-links`** — Makes URLs in output clickable. Free UX win.
- **`addon-webgl`** — GPU renderer. Significantly faster for busy terminals (compiling output, log tails). Worth enabling by default in recent xterm versions.
- **`addon-search`** — Ctrl+F within scrollback.
- **`addon-clipboard`** — OSC 52 clipboard integration, so programs inside the terminal (e.g. `vim`'s `"+y`) can write to the browser clipboard.
- **`addon-serialize`** — Snapshot the terminal state as a string. Useful server-side with `@xterm/headless` for rich reconnection.
- **`addon-unicode11`** / **`addon-unicode-graphemes`** — Better width calculations for emoji and CJK. The default heuristic is from an older Unicode version.

Loading:
```js
import { WebglAddon } from '@xterm/addon-webgl';
const webgl = new WebglAddon();
term.loadAddon(webgl);
// WebGL can context-loss; listen for it:
webgl.onContextLoss(() => webgl.dispose());
```

## `@xterm/headless`

A Node-side build of xterm.js with no DOM dependency. Useful if you want to maintain a server-side "shadow copy" of each terminal's state — so on reconnection you can send the full rendered screen rather than replaying raw scrollback. Same API as `@xterm/xterm` minus rendering.

Typical pattern: pipe PTY output into both the WebSocket and a headless `Terminal` on the server; on reconnect, use `@xterm/addon-serialize` to serialize the headless instance and send it as the initial payload.
