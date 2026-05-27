import * as vscode from 'vscode';
import { Binding, WebviewMessage } from './types';

/**
 * Manages the Context Commander settings WebView panel.
 *
 * Only one panel can be open at a time. Use `createOrShow` to open or
 * reveal the panel, and `sendCurrentBindings` to push updated config
 * to an already-open panel.
 */
export class SettingsPanel {
  public static currentPanel: SettingsPanel | undefined;

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(context: vscode.ExtensionContext): void {
    const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;

    if (SettingsPanel.currentPanel) {
      SettingsPanel.currentPanel._panel.reveal(column);
      SettingsPanel.currentPanel._sendBindings();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'contextCommanderSettings',
      'Context Commander Settings',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, 'media'),
          vscode.Uri.joinPath(context.extensionUri, 'out'),
        ],
      }
    );

    SettingsPanel.currentPanel = new SettingsPanel(panel, context.extensionUri);
  }

  /** Push the current config bindings to an open panel, if any. */
  public static sendCurrentBindings(): void {
    SettingsPanel.currentPanel?._sendBindings();
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    this._panel.webview.html = this._buildHtml(this._panel.webview);
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.onDidReceiveMessage(
      (msg: WebviewMessage) => this._handleMessage(msg),
      null,
      this._disposables
    );
  }

  private _handleMessage(msg: WebviewMessage): void {
    switch (msg.type) {
      case 'ready':
        this._sendBindings();
        break;

      case 'save':
        vscode.workspace
          .getConfiguration('contextCommander')
          .update('bindings', msg.bindings as Binding[], vscode.ConfigurationTarget.Global)
          .then(() => {
            vscode.window.showInformationMessage('Context Commander: Bindings saved.');
          }, (err: unknown) => {
            vscode.window.showErrorMessage(
              `Context Commander: Failed to save bindings — ${err instanceof Error ? err.message : String(err)}`
            );
          });
        break;
    }
  }

  private _sendBindings(): void {
    const bindings =
      vscode.workspace.getConfiguration('contextCommander').get<Binding[]>('bindings') ?? [];
    this._panel.webview.postMessage({ type: 'update', bindings });
  }

  private _buildHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'settings.js')
    );
    const csp = webview.cspSource;

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; script-src ${csp}; style-src ${csp} 'unsafe-inline'; font-src ${csp};">
  <title>Context Commander Settings</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      padding: 0 24px 32px;
      color: var(--vscode-foreground);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      max-width: 860px;
      margin: 0;
    }
    h1 { font-size: 1.3em; font-weight: 600; border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 8px; margin-bottom: 0; }
    h2 { font-size: 1.05em; font-weight: 600; margin-bottom: 16px; }
    code { font-family: var(--vscode-editor-font-family, monospace); font-size: 0.9em; background: var(--vscode-textCodeBlock-background); padding: 1px 4px; border-radius: 2px; }

    /* Buttons */
    .btn {
      display: inline-flex; align-items: center; justify-content: center;
      padding: 4px 12px; border-radius: 2px; border: none; cursor: pointer;
      font-size: var(--vscode-font-size); font-family: var(--vscode-font-family);
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      line-height: 1.5;
    }
    .btn:hover   { background: var(--vscode-button-secondaryHoverBackground); }
    .btn:focus   { outline: 1px solid var(--vscode-focusBorder); outline-offset: 2px; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
    .btn-primary:hover { background: var(--vscode-button-hoverBackground); }

    /* Inputs */
    .input {
      display: block; width: 100%;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, transparent);
      padding: 4px 8px; border-radius: 2px;
      font-size: var(--vscode-font-size); font-family: var(--vscode-font-family);
      outline: none;
    }
    .input:focus  { border-color: var(--vscode-focusBorder); }
    .input::placeholder { color: var(--vscode-input-placeholderForeground); }

    /* Checkboxes */
    .check-label { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; user-select: none; }
    .check-label input[type="checkbox"] { width: 14px; height: 14px; accent-color: var(--vscode-focusBorder); }

    /* Layout */
    .toolbar { display: flex; justify-content: space-between; align-items: center; margin: 16px 0; }
    .binding-card {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px; padding: 12px 14px; margin-bottom: 8px;
      background: var(--vscode-editor-inactiveSelectionBackground);
    }
    .binding-card.is-disabled { opacity: 0.5; }
    .binding-header { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-bottom: 6px; }
    .binding-label { font-weight: 600; }
    .binding-cmds  { font-size: 0.82em; color: var(--vscode-descriptionForeground); font-family: var(--vscode-editor-font-family, monospace); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 55%; }
    .when-row { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
    .badge { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); border-radius: 3px; padding: 1px 7px; font-size: 0.78em; }
    .card-actions { display: flex; gap: 6px; flex-wrap: wrap; }
    .empty-state { text-align: center; color: var(--vscode-descriptionForeground); padding: 48px 0; }
    .divider { border: none; border-top: 1px solid var(--vscode-panel-border); margin: 20px 0; }
    .form-group { margin-bottom: 18px; }
    .form-label { display: block; margin-bottom: 5px; font-weight: 500; }
    .form-hint { font-size: 0.82em; color: var(--vscode-descriptionForeground); margin-top: 3px; }
    .when-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .cmd-list { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
    .cmd-row { display: flex; gap: 8px; align-items: center; }
    .cmd-row .input:first-child { flex: 1 1 auto; }
    .cmd-row .input:nth-child(2) { flex: 0 0 220px; }
    .form-actions { display: flex; gap: 8px; margin-top: 20px; }
  </style>
</head>
<body>

  <!-- ── List view ──────────────────────────────────────────────────────────── -->
  <div id="list-view">
    <div class="toolbar">
      <h1>Context Commander — Bindings</h1>
      <button id="btn-add" class="btn">+ Add Binding</button>
    </div>
    <div id="bindings-list"></div>
    <hr class="divider">
    <div class="form-actions">
      <button id="btn-save" class="btn btn-primary">Save to Settings</button>
    </div>
  </div>

  <!-- ── Edit / Add view ────────────────────────────────────────────────────── -->
  <div id="edit-view" style="display:none">
    <h2 id="edit-heading" style="margin-top:20px">Add Binding</h2>

    <div class="form-group">
      <label class="form-label" for="f-label">Label *</label>
      <input id="f-label" class="input" type="text" placeholder="e.g. Convert to PDF">
    </div>

    <div class="form-group">
      <label class="form-label">Commands * <span style="font-weight:normal;font-size:0.85em">(executed in order)</span></label>
      <div class="form-hint">Args column is a JSON array. Strings support:
        <code>\${file}</code>, <code>\${workspaceFolder}</code>, <code>\${relativeFile}</code>,
        <code>\${fileBasename}</code>, <code>\${fileDirname}</code>, <code>\${fileExtname}</code></div>
      <div class="cmd-list" id="cmd-list"></div>
      <div style="margin-top:8px">
        <button id="btn-add-cmd" class="btn">+ Add Command</button>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">When (all filters are optional)</label>
      <div class="when-grid">
        <div>
          <label class="form-label" style="font-weight:normal" for="f-ext">File Extensions</label>
          <input id="f-ext" class="input" type="text" placeholder=".md .markdown .txt">
          <div class="form-hint">Space-separated; leading dot optional</div>
        </div>
        <div>
          <label class="form-label" style="font-weight:normal" for="f-lang">Language IDs</label>
          <input id="f-lang" class="input" type="text" placeholder="markdown python typescript">
          <div class="form-hint">Space-separated VS Code language IDs</div>
        </div>
        <div>
          <label class="form-label" style="font-weight:normal" for="f-glob">Glob Pattern</label>
          <input id="f-glob" class="input" type="text" placeholder="src/**/*.ts">
          <div class="form-hint">Minimatch glob vs. workspace-relative path</div>
        </div>
        <div style="display:flex;align-items:center;padding-top:20px">
          <label class="check-label"><input type="checkbox" id="f-isdir"> Directories only</label>
        </div>
      </div>
    </div>

    <div class="form-group">
      <label class="check-label"><input type="checkbox" id="f-enabled"> Binding enabled</label>
    </div>

    <hr class="divider">
    <div class="form-actions">
      <button id="btn-form-save" class="btn btn-primary">Save Binding</button>
      <button id="btn-form-cancel" class="btn">Cancel</button>
    </div>
  </div>

  <script src="${scriptUri}"></script>
</body>
</html>`;
  }

  public dispose(): void {
    SettingsPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      this._disposables.pop()?.dispose();
    }
  }
}
