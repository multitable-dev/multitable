import { useEffect, useRef } from 'react';
import { terminalManager } from '../lib/terminalManager';
import { wsClient } from '../lib/ws';

export function useTerminal(processId: string | null) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!processId || !containerRef.current) return;

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
      offScrollback();
      offOutput();
      disposeInput.dispose();
      container.removeEventListener('click', handleClick);
      resizeObserver.disconnect();
      terminalManager.detach(processId);
      wsClient.unsubscribe(processId);
    };
  }, [processId]);

  return containerRef;
}
