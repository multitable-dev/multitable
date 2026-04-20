import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { terminalManager } from '../lib/terminalManager';
import { wsClient } from '../lib/ws';
import { uploadAttachment, quotePath, type AttachmentKind } from '../lib/attachments';

interface Options {
  attachKind?: AttachmentKind | null;
}

export function useTerminal(
  processId: string | null,
  disabled = false,
  options: Options = {},
) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Stash the latest attach kind in a ref so the effect doesn't re-run when
  // the parent re-renders (e.g. process state changes).
  const attachKindRef = useRef<AttachmentKind | null | undefined>(options.attachKind);
  attachKindRef.current = options.attachKind;

  useEffect(() => {
    if (!processId || !containerRef.current || disabled) return;

    const container = containerRef.current;

    // Attach creates a fresh xterm instance in the container
    terminalManager.attach(processId, container);

    // Get the entry that attach just created — must be after attach
    const entry = terminalManager.getOrCreate(processId);

    // Fit before subscribing so we send correct dimensions to the backend.
    // This ensures the PTY spawns at the right cols/rows instead of default 80x24.
    const initialDims = terminalManager.fit(processId);

    // Subscribe with actual terminal dimensions
    wsClient.subscribe(processId, initialDims ?? undefined);

    // Corrective resize after xterm's glyph measurements settle. attach() runs
    // fit() across two RAFs internally, so the sync fit above may report stale
    // dims. Re-fit after the same cadence and push the final size to the PTY —
    // otherwise a session resumed into a stopped/registered process may keep
    // its spawn-time size until the user manually triggers a container resize.
    let correctiveCancelled = false;
    requestAnimationFrame(() => {
      if (correctiveCancelled) return;
      requestAnimationFrame(() => {
        if (correctiveCancelled) return;
        const dims = terminalManager.fit(processId);
        if (dims) wsClient.sendResize(processId, dims.cols, dims.rows);
      });
    });

    // Handle scrollback replay from backend
    const offScrollback = wsClient.on('scrollback', (msg) => {
      if (msg.processId === processId) {
        terminalManager.handleScrollback(processId, (msg.payload as any).data);
      }
    });

    // Handle live output
    const offOutput = wsClient.on('pty-output', (msg) => {
      if (msg.processId === processId) {
        terminalManager.writeData(processId, (msg.payload as any).data);
      }
    });

    // Wire terminal keyboard input to WebSocket → PTY
    const disposeInput = entry.terminal.onData((data) => {
      wsClient.sendInput(processId, data);
    });

    // Focus the terminal so it receives keyboard input immediately
    entry.terminal.focus();

    // Re-focus on click (e.g. after interacting with sidebar)
    const handleClick = () => entry.terminal.focus();
    container.addEventListener('click', handleClick);

    // ── Paste / drop image handling ─────────────────────────────────────────
    // Pull image files off clipboard or drop, upload to the daemon, and inject
    // the absolute path into the PTY. Non-image paste / drop is left alone so
    // xterm can handle text paste itself.
    async function ingestFiles(files: File[]): Promise<void> {
      const kind = attachKindRef.current;
      if (!kind || files.length === 0) return;

      const paths: string[] = [];
      for (const file of files) {
        const toastId = toast.loading(`Uploading ${file.name || 'image'}…`);
        try {
          const result = await uploadAttachment(kind, processId!, file);
          paths.push(quotePath(result.path));
          toast.success(`Attached ${result.filename}`, { id: toastId });
        } catch (err: any) {
          toast.error(err?.message || 'Upload failed', { id: toastId });
        }
      }

      if (paths.length > 0) {
        // Trailing space lets the user keep typing without committing the prompt.
        wsClient.sendInput(processId!, paths.join(' ') + ' ');
      }
    }

    const handlePaste = (e: ClipboardEvent) => {
      const dt = e.clipboardData;
      if (!dt) return;
      const files: File[] = [];
      for (let i = 0; i < dt.items.length; i++) {
        const item = dt.items[i];
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const f = item.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length === 0) return;
      e.preventDefault();
      e.stopPropagation();
      void ingestFiles(files);
    };

    const handleDragOver = (e: DragEvent) => {
      if (!e.dataTransfer) return;
      const hasFiles = Array.from(e.dataTransfer.types || []).includes('Files');
      if (!hasFiles) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    };

    const handleDrop = (e: DragEvent) => {
      const dt = e.dataTransfer;
      if (!dt || !dt.files || dt.files.length === 0) return;
      // Always preventDefault once we know files were dropped — otherwise the
      // browser navigates away from the app to open the dropped file.
      e.preventDefault();
      e.stopPropagation();
      const files = Array.from(dt.files).filter((f) => f.type.startsWith('image/'));
      if (files.length === 0) {
        toast.error('Only image files can be attached');
        return;
      }
      void ingestFiles(files);
    };

    container.addEventListener('paste', handlePaste);
    container.addEventListener('dragover', handleDragOver);
    container.addEventListener('drop', handleDrop);

    // ── Mobile touch scrolling ──────────────────────────────────────────────
    // xterm.js doesn't translate touch-drag into scrollback navigation on its
    // own, so on touch devices the terminal feels "stuck". Track single-finger
    // vertical drags and forward them to terminal.scrollLines(). Short taps
    // fall through untouched so xterm's focus/selection keep working.
    let touchActive = false;
    let touchStartY = 0;
    let lastTouchY = 0;
    let isScrolling = false;
    let scrollAccumulator = 0;

    const getLineHeight = () => {
      const rows = entry.terminal.rows;
      const h = container.clientHeight;
      return rows > 0 ? h / rows : 17;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        touchActive = false;
        return;
      }
      touchActive = true;
      isScrolling = false;
      touchStartY = e.touches[0].clientY;
      lastTouchY = touchStartY;
      scrollAccumulator = 0;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!touchActive || e.touches.length !== 1) return;
      const y = e.touches[0].clientY;
      if (!isScrolling && Math.abs(y - touchStartY) > 8) {
        isScrolling = true;
      }
      if (!isScrolling) return;
      const deltaY = lastTouchY - y;
      scrollAccumulator += deltaY;
      const lineHeight = getLineHeight();
      const lines = Math.trunc(scrollAccumulator / lineHeight);
      if (lines !== 0) {
        entry.terminal.scrollLines(lines);
        scrollAccumulator -= lines * lineHeight;
      }
      lastTouchY = y;
      e.preventDefault();
    };

    const onTouchEnd = () => {
      touchActive = false;
      isScrolling = false;
    };

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd, { passive: true });
    container.addEventListener('touchcancel', onTouchEnd, { passive: true });

    // Auto-fit on container resize (including detail panel open/close).
    // Debounce the PTY resize to avoid a resize storm — rapid resizes cause the
    // shell program (e.g. Claude Code) to redraw dozens of times, and the
    // interleaved partial redraws corrupt the terminal output.
    let resizeTimer: ReturnType<typeof setTimeout> | undefined;
    const resizeObserver = new ResizeObserver(() => {
      // Fit locally immediately so xterm renders at the right size
      terminalManager.fit(processId);
      // Debounce the PTY resize so the shell only redraws once at the final size
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const dims = terminalManager.fit(processId);
        if (dims) {
          wsClient.sendResize(processId, dims.cols, dims.rows);
        }
      }, 150);
    });
    resizeObserver.observe(container);

    return () => {
      clearTimeout(resizeTimer);
      correctiveCancelled = true;
      offScrollback();
      offOutput();
      disposeInput.dispose();
      container.removeEventListener('click', handleClick);
      container.removeEventListener('paste', handlePaste);
      container.removeEventListener('dragover', handleDragOver);
      container.removeEventListener('drop', handleDrop);
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
      container.removeEventListener('touchcancel', onTouchEnd);
      resizeObserver.disconnect();
      terminalManager.detach(processId);
      wsClient.unsubscribe(processId);
    };
  }, [processId, disabled]);

  return containerRef;
}
