import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// -------------------------------------------------------------------------
// Mock configuration
// -------------------------------------------------------------------------

/** Shared mock JSONL path used by both the writer and the LogWatcher. */
export const MOCK_LOG_PATH = path.join(os.tmpdir(), 'ai-office-mock.jsonl');

/** Ordered sequence of fake AI agent actions to cycle through. */
const MOCK_SEQUENCE: Array<{ action: string; detail: string }> = [
  { action: 'read_file',  detail: 'package.json'            },
  { action: 'bash',       detail: 'npm install'             },
  { action: 'read_file',  detail: 'src/extension.ts'        },
  { action: 'write_file', detail: 'src/LogWatcher.ts'       },
  { action: 'bash',       detail: 'npx tsc -p .'            },
  { action: 'wait',       detail: 'thinking...'             },
  { action: 'read_file',  detail: 'tsconfig.json'           },
  { action: 'edit_file',  detail: 'src/AiOfficePanel.ts'    },
  { action: 'bash',       detail: 'git status'              },
  { action: 'wait',       detail: 'waiting for user input'  },
  { action: 'search_files', detail: '*.jsonl'               },
  { action: 'bash',       detail: 'git commit -m "feat: ..."'},
];

// -------------------------------------------------------------------------
// State
// -------------------------------------------------------------------------

let _timer: ReturnType<typeof setInterval> | undefined;
let _index = 0;

// -------------------------------------------------------------------------
// Public API
// -------------------------------------------------------------------------

/**
 * Start writing a new mock log entry every `intervalMs` milliseconds.
 * The file is created (or truncated) fresh on every call to `start`.
 * Safe to call while already running — stops the previous timer first.
 */
export function startMockWriter(intervalMs = 1500): void {
  stopMockWriter();

  // Create / truncate the file so the watcher sees only fresh entries.
  fs.writeFileSync(MOCK_LOG_PATH, '', 'utf8');
  _index = 0;

  _timer = setInterval(() => {
    const entry = {
      ...MOCK_SEQUENCE[_index % MOCK_SEQUENCE.length],
      ts: new Date().toISOString(),
    };
    fs.appendFileSync(MOCK_LOG_PATH, JSON.stringify(entry) + '\n', 'utf8');
    _index++;
  }, intervalMs);
}

/** Stop the mock writer. Does nothing if not running. */
export function stopMockWriter(): void {
  if (_timer !== undefined) {
    clearInterval(_timer);
    _timer = undefined;
  }
}

/** Returns true if the mock writer is currently running. */
export function isMockWriterRunning(): boolean {
  return _timer !== undefined;
}
