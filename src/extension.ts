import * as vscode from 'vscode';
import { runBinding } from './commandRunner';
import { matchesWhen } from './whenClause';
import { SettingsPanel } from './settingsPanel';
import { SlotManager } from './slotManager';

const SLOT_COUNT = 10;

let slotManager: SlotManager;

export function activate(context: vscode.ExtensionContext): void {
  slotManager = new SlotManager();

  // ── QuickPick mode: single "Context Commander..." entry ────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'contextCommander.showBindings',
      async (uri?: vscode.Uri) => {
        if (!uri) {
          vscode.window.showWarningMessage(
            'Context Commander: Right-click a file or folder in the Explorer to use this command.'
          );
          return;
        }

        const bindings = slotManager.getBindingsForUri(uri);

        if (bindings.length === 0) {
          vscode.window.showInformationMessage(
            'Context Commander: No bindings match this file.'
          );
          return;
        }

        const items = bindings.map(b => ({
          label: b.label,
          description: b.commands.map(c => c.command).join(' → '),
          binding: b,
        }));

        const picked = await vscode.window.showQuickPick(items, {
          placeHolder: `Run on: ${vscode.workspace.asRelativePath(uri)}`,
          matchOnDescription: true,
        });

        if (picked) {
          await runBinding(picked.binding, uri);
        }
      }
    )
  );

  // ── Slot mode: pre-declared pool of 10 commands ────────────────────────────
  for (let i = 0; i < SLOT_COUNT; i++) {
    const slotIndex = i;
    context.subscriptions.push(
      vscode.commands.registerCommand(
        `contextCommander.runSlot.${slotIndex}`,
        async (uri?: vscode.Uri) => {
          if (!uri) { return; }

          const binding = slotManager.getSlotBinding(slotIndex);
          if (!binding) { return; }

          if (!matchesWhen(binding, uri)) {
            vscode.window.showInformationMessage(
              `Context Commander: "${binding.label}" does not apply to this file.`
            );
            return;
          }

          await runBinding(binding, uri);
        }
      )
    );
  }

  // ── Settings UI ────────────────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand('contextCommander.openSettings', () => {
      SettingsPanel.createOrShow(context);
    })
  );

  // ── Configuration change listener ──────────────────────────────────────────
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('contextCommander')) {
        slotManager.refresh();
        SettingsPanel.sendCurrentBindings();
      }
    })
  );

  // Initial context sync
  slotManager.refresh();
}

export function deactivate(): void {
  // Nothing to clean up — all disposables are tracked via context.subscriptions.
}
