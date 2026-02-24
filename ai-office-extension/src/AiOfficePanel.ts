import * as vscode from 'vscode';
import { getWebviewContent } from './webview/getWebviewContent';

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

    // Create a new panel.
    const panel = vscode.window.createWebviewPanel(
      AiOfficePanel.viewType,
      'AI Office',
      column ?? vscode.ViewColumn.One,
      {
        enableScripts: true,
        // Restrict the webview to load resources from the extension's `media` directory.
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
  // Instance methods
  // -------------------------------------------------------------------------

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    this._update();

    // Listen for when the panel is disposed (user closes it).
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Update content when the panel becomes visible again.
    this._panel.onDidChangeViewState(
      (_e) => {
        if (this._panel.visible) {
          this._update();
        }
      },
      null,
      this._disposables
    );

    // Handle messages from the webview.
    this._panel.webview.onDidReceiveMessage(
      (message: { command: string; state?: string }) => {
        switch (message.command) {
          case 'alert':
            vscode.window.showInformationMessage(message.state ?? '');
            break;
          case 'setState':
            // Future: persist sprite state via context.workspaceState
            break;
        }
      },
      null,
      this._disposables
    );
  }

  /**
   * Send a message to the webview to switch the sprite state.
   * Valid values: 'idle' | 'typing' | 'reading'
   */
  public setSpriteState(state: 'idle' | 'typing' | 'reading'): void {
    this._panel.webview.postMessage({ command: 'setSpriteState', state });
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
