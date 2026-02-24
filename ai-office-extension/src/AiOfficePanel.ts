import * as vscode from 'vscode';
import { getWebviewContent } from './webview/getWebviewContent';
import type { SpriteState, LogEntry } from './LogWatcher';

/**
 * Manages the AI Office Webview Panel singleton.
 * Only one panel is allowed at a time; subsequent calls to createOrShow
 * will reveal the existing panel instead of creating a new one.
 */
export class AiOfficePanel {
  public static readonly viewType = 'aiOffice';

  private static _currentPanel: AiOfficePanel | undefined;

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  // -------------------------------------------------------------------------
  // Static helpers
  // -------------------------------------------------------------------------

  public static createOrShow(extensionUri: vscode.Uri): void {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If a panel already exists, reveal it.
    if (AiOfficePanel._currentPanel) {
      AiOfficePanel._currentPanel._panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      AiOfficePanel.viewType,
      'AI Office',
      column ?? vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
        retainContextWhenHidden: true,
      }
    );

    AiOfficePanel._currentPanel = new AiOfficePanel(panel, extensionUri);
  }

  public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri): void {
    AiOfficePanel._currentPanel = new AiOfficePanel(panel, extensionUri);
  }

  // -------------------------------------------------------------------------
  // Static forwarding methods (called by extension.ts from LogWatcher events)
  // -------------------------------------------------------------------------

  /**
   * Forward a sprite state change to the current panel.
   * No-op if no panel is open.
   */
  public static forwardSpriteState(state: SpriteState): void {
    AiOfficePanel._currentPanel?.setSpriteState(state);
  }

  /**
   * Forward a parsed log entry to the current panel's log feed.
   * No-op if no panel is open.
   */
  public static forwardLogEntry(entry: LogEntry, state: SpriteState, logPath?: string): void {
    AiOfficePanel._currentPanel?.appendLog(entry, state, logPath);
  }

  // -------------------------------------------------------------------------
  // Instance methods
  // -------------------------------------------------------------------------

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    this._update();

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.onDidChangeViewState(
      (_e) => {
        if (this._panel.visible) {
          this._update();
        }
      },
      null,
      this._disposables
    );

    this._panel.webview.onDidReceiveMessage(
      (message: { command: string; state?: string }) => {
        switch (message.command) {
          case 'alert':
            vscode.window.showInformationMessage(message.state ?? '');
            break;
        }
      },
      null,
      this._disposables
    );
  }

  /**
   * Post a sprite state change to the webview.
   * Valid values: 'idle' | 'typing' | 'reading'
   */
  public setSpriteState(state: SpriteState): void {
    this._panel.webview.postMessage({ command: 'setSpriteState', state });
  }

  /**
   * Append a parsed log entry to the webview's live log feed.
   */
  public appendLog(entry: LogEntry, state: SpriteState, logPath?: string): void {
    this._panel.webview.postMessage({
      command: 'appendLog',
      logPath,
      entry: {
        action: entry.action,
        detail: entry.detail ?? '',
        ts: entry.ts ?? new Date().toISOString(),
        state,
      },
    });
  }

  public dispose(): void {
    AiOfficePanel._currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  private _update(): void {
    this._panel.title = 'AI Office';
    this._panel.webview.html = getWebviewContent(this._panel.webview, this._extensionUri);
  }
}
