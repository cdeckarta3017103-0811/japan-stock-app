import * as vscode from 'vscode';
import { AiOfficePanel } from './AiOfficePanel';
import { LogWatcher } from './LogWatcher';
import {
  MOCK_LOG_PATH,
  startMockWriter,
  stopMockWriter,
  isMockWriterRunning,
} from './mockLogWriter';

export function activate(context: vscode.ExtensionContext): void {
  console.log('AI Office extension is now active!');

  // -----------------------------------------------------------------------
  // JSONL log watcher
  // Watches MOCK_LOG_PATH by default. In production, swap this path for
  // the real AI agent log file (e.g., read from a workspace setting).
  // -----------------------------------------------------------------------
  const logWatcher = new LogWatcher(MOCK_LOG_PATH);

  logWatcher.on('stateChange', (state, entry) => {
    AiOfficePanel.forwardSpriteState(state);
    AiOfficePanel.forwardLogEntry(entry, state, MOCK_LOG_PATH);
  });

  logWatcher.on('error', (err: Error) => {
    console.error('[AI Office] LogWatcher error:', err.message);
  });

  // -----------------------------------------------------------------------
  // Commands
  // -----------------------------------------------------------------------

  // Open / reveal the AI Office panel.
  const openCmd = vscode.commands.registerCommand('aiOffice.open', () => {
    AiOfficePanel.createOrShow(context.extensionUri);
    // Start watching as soon as the panel opens.
    logWatcher.start();
  });

  // Start the mock log writer (for development / demo).
  const startMockCmd = vscode.commands.registerCommand('aiOffice.startMockLog', () => {
    if (isMockWriterRunning()) {
      vscode.window.showInformationMessage('AI Office: mock writer is already running.');
      return;
    }
    startMockWriter(1500);
    logWatcher.start();           // idempotent if already watching
    vscode.window.showInformationMessage(
      `AI Office: mock log started → ${MOCK_LOG_PATH}`
    );
  });

  // Stop the mock log writer.
  const stopMockCmd = vscode.commands.registerCommand('aiOffice.stopMockLog', () => {
    stopMockWriter();
    vscode.window.showInformationMessage('AI Office: mock log stopped.');
  });

  context.subscriptions.push(openCmd, startMockCmd, stopMockCmd, {
    dispose: () => {
      stopMockWriter();
      logWatcher.stop();
    },
  });

  // -----------------------------------------------------------------------
  // Panel serialiser — restores panel after VS Code reloads
  // -----------------------------------------------------------------------
  if (vscode.window.registerWebviewPanelSerializer) {
    vscode.window.registerWebviewPanelSerializer(AiOfficePanel.viewType, {
      async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, _state: unknown) {
        AiOfficePanel.revive(webviewPanel, context.extensionUri);
        logWatcher.start();
      },
    });
  }
}

export function deactivate(): void {
  // Resources released via context.subscriptions dispose chain above.
}
