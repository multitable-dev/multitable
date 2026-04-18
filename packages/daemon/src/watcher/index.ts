import chokidar from 'chokidar';
import path from 'path';

type FSWatcher = ReturnType<typeof chokidar.watch>;

interface WatchEntry {
  watcher: FSWatcher;
  timer: NodeJS.Timeout | null;
}

const DEBOUNCE_MS = 500;

export class FileWatcher {
  private processWatchers = new Map<string, WatchEntry>();
  private mtYmlWatchers = new Map<string, FSWatcher>();

  /**
   * Watch mt.yml in a project directory. Calls onChange when the file changes.
   */
  watchMtYml(projectPath: string, onChange: () => void): void {
    const existing = this.mtYmlWatchers.get(projectPath);
    if (existing) {
      existing.close();
    }

    const mtYmlPath = path.join(projectPath, 'mt.yml');
    const watcher = chokidar.watch(mtYmlPath, {
      persistent: false,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
    });

    watcher.on('change', onChange);
    watcher.on('add', onChange);

    this.mtYmlWatchers.set(projectPath, watcher);
  }

  /**
   * Watch file patterns for a process. Debounces calls to onChanged.
   */
  watchPatterns(
    processId: string,
    patterns: string[],
    cwd: string,
    onChanged: () => void
  ): void {
    // Stop existing watcher for this process
    this.unwatchProcess(processId);

    if (!patterns || patterns.length === 0) return;

    const globPatterns = patterns.map((p) =>
      path.isAbsolute(p) ? p : path.join(cwd, p)
    );

    const watcher = chokidar.watch(globPatterns, {
      persistent: false,
      ignoreInitial: true,
      cwd,
      awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
      ignored: ['**/node_modules/**', '**/.git/**'],
    });

    const entry: WatchEntry = { watcher, timer: null };

    const debounced = () => {
      if (entry.timer) clearTimeout(entry.timer);
      entry.timer = setTimeout(() => {
        entry.timer = null;
        onChanged();
      }, DEBOUNCE_MS);
    };

    watcher.on('change', debounced);
    watcher.on('add', debounced);
    watcher.on('unlink', debounced);

    this.processWatchers.set(processId, entry);
  }

  /**
   * Stop watching files for a specific process.
   */
  unwatchProcess(processId: string): void {
    const entry = this.processWatchers.get(processId);
    if (!entry) return;

    if (entry.timer) clearTimeout(entry.timer);
    entry.watcher.close().catch(() => {});
    this.processWatchers.delete(processId);
  }

  /**
   * Stop all watchers.
   */
  unwatchAll(): void {
    for (const [id] of this.processWatchers) {
      this.unwatchProcess(id);
    }
    for (const [, watcher] of this.mtYmlWatchers) {
      watcher.close().catch(() => {});
    }
    this.mtYmlWatchers.clear();
  }
}
