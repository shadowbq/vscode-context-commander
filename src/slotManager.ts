import * as vscode from 'vscode';
import { Binding } from './types';
import { matchesWhen } from './whenClause';

const SLOT_COUNT = 10;

/**
 * Manages the mapping of bindings to pre-declared menu slots and keeps
 * VS Code context variables in sync with the current configuration.
 *
 * In QuickPick mode (default): sets `contextCommander.hasBindings` so the
 * single "Context Commander..." entry appears when bindings exist.
 *
 * In slot mode: assigns each enabled binding to a numbered slot and sets
 * `contextCommander.slot.N.visible` accordingly.
 */
export class SlotManager {
  private _bindings: Binding[] = [];
  private _slotMap: Map<number, Binding> = new Map();

  constructor() {
    this.refresh();
  }

  /**
   * Reloads bindings from configuration and updates all context variables.
   * Call this after any configuration change.
   */
  refresh(): void {
    const config = vscode.workspace.getConfiguration('contextCommander');
    this._bindings = config.get<Binding[]>('bindings') ?? [];
    const slotMode = config.get<boolean>('slotMode') ?? false;

    const enabledBindings = this._bindings.filter(b => b.enabled !== false);
    const hasBindings = enabledBindings.length > 0;

    vscode.commands.executeCommand('setContext', 'contextCommander.hasBindings', hasBindings);
    vscode.commands.executeCommand('setContext', 'contextCommander.slotMode', slotMode);

    this._slotMap.clear();

    for (let i = 0; i < SLOT_COUNT; i++) {
      const binding = enabledBindings[i];
      if (binding) {
        this._slotMap.set(i, binding);
        vscode.commands.executeCommand('setContext', `contextCommander.slot.${i}.visible`, true);
      } else {
        vscode.commands.executeCommand('setContext', `contextCommander.slot.${i}.visible`, false);
      }
    }
  }

  /**
   * Returns the binding assigned to a given slot index, or undefined if the
   * slot is empty.
   */
  getSlotBinding(index: number): Binding | undefined {
    return this._slotMap.get(index);
  }

  /**
   * Returns all enabled bindings that match the given URI's when clause.
   */
  getBindingsForUri(uri: vscode.Uri): Binding[] {
    return this._bindings.filter(
      b => b.enabled !== false && matchesWhen(b, uri)
    );
  }

  getAllBindings(): Binding[] {
    return this._bindings;
  }
}
