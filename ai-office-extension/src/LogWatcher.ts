import * as fs from 'fs';
import { EventEmitter } from 'events';

// -------------------------------------------------------------------------
// Types
// -------------------------------------------------------------------------

export type SpriteState = 'idle' | 'typing' | 'reading';

export interface LogEntry {
  action: string;
  detail?: string;
  ts?: string;
  [key: string]: unknown;
}

// -------------------------------------------------------------------------
// Action → sprite state mapping
// Add more action names here as your AI agent grows.
// -------------------------------------------------------------------------
const ACTION_STATE_MAP: Readonly<Record<string, SpriteState>> = {
  // typing states
  bash:         'typing',
  write_file:   'typing',
  edit_file:    'typing',
  run_command:  'typing',
  // reading states
  read_file:    'reading',
  search_files: 'reading',
  list_dir:     'reading',
  // idle states
  wait:         'idle',
  think:        'idle',
};

export function actionToState(action: string): SpriteState {
  return ACTION_STATE_MAP[action] ?? 'idle';
}

// -------------------------------------------------------------------------
// LogWatcher
// -------------------------------------------------------------------------

/**
 * Tails a JSONL file and emits a `stateChange` event whenever a new
 * complete line is appended. Each line must be a valid JSON object with
 * at least an `action` string field.
 *
 * Events:
 *   'stateChange' (state: SpriteState, entry: LogEntry)
 *   'error'       (err: Error)
 */
export class LogWatcher extends EventEmitter {
  private readonly _filePath: string;
  private _position: number = 0;
  private _watcher: fs.FSWatcher | undefined;
  private _debounce: ReturnType<typeof setTimeout> | undefined;

  constructor(filePath: string) {
    super();
    this._filePath = filePath;
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Start watching the file. Seeks to the end of existing content so only
   * newly-appended lines trigger events. Safe to call multiple times (no-op
   * if already watching).
   */
  public start(): void {
    if (this._watcher) { return; }

    // Seek to end of any pre-existing content.
    try {
      this._position = fs.statSync(this._filePath).size;
    } catch {
      // File does not exist yet; will be created by the writer.
      this._position = 0;
    }

    this._watcher = fs.watch(
      this._filePath,
      { persistent: false },
      (_event: string) => {
        // `fs.watch` can fire multiple times per logical write; debounce.
        if (this._debounce) { clearTimeout(this._debounce); }
        this._debounce = setTimeout(() => this._readNewLines(), 40);
      }
    );

    this._watcher.on('error', (err: Error) => this.emit('error', err));
  }

  /** Stop watching and free OS resources. */
  public stop(): void {
    if (this._debounce) { clearTimeout(this._debounce); }
    this._watcher?.close();
    this._watcher = undefined;
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private _readNewLines(): void {
    let size: number;
    try {
      size = fs.statSync(this._filePath).size;
    } catch {
      return; // file removed mid-watch
    }

    // File was truncated / rotated — reset cursor.
    if (size < this._position) {
      this._position = 0;
    }

    if (size === this._position) { return; }

    const length = size - this._position;
    const buf = Buffer.alloc(length);
    const fd = fs.openSync(this._filePath, 'r');
    fs.readSync(fd, buf, 0, length, this._position);
    fs.closeSync(fd);
    this._position = size;

    // A single write may contain multiple newline-terminated JSON objects.
    const lines = buf.toString('utf8').split('\n').filter((l) => l.trim() !== '');
    for (const line of lines) {
      this._parseLine(line);
    }
  }

  private _parseLine(line: string): void {
    let entry: LogEntry;
    try {
      entry = JSON.parse(line) as LogEntry;
    } catch {
      // Silently skip malformed lines.
      return;
    }

    if (typeof entry.action !== 'string') { return; }

    const state = actionToState(entry.action);
    this.emit('stateChange', state, entry);
  }
}
