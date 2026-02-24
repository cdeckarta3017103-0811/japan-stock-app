import * as vscode from 'vscode';
import { AiOfficePanel } from './AiOfficePanel';

export function activate(context: vscode.ExtensionContext): void {
  console.log('AI Office extension is now active!');

  const openCommand = vscode.commands.registerCommand('aiOffice.open', () => {
    AiOfficePanel.createOrShow(context.extensionUri);
  });

  context.subscriptions.push(openCommand);

  // If the extension is activated via serialized state (e.g. after VS Code reload),
  // restore the panel automatically.
  if (vscode.window.registerWebviewPanelSerializer) {
    vscode.window.registerWebviewPanelSerializer(AiOfficePanel.viewType, {
      async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, _state: unknown) {
        AiOfficePanel.revive(webviewPanel, context.extensionUri);
      },
    });
  }
}

export function deactivate(): void {
  // Clean-up handled by AiOfficePanel.currentPanel?.dispose()
}
