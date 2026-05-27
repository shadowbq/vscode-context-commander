import { describe, it, expect, beforeEach, vi } from 'vitest';
import { workspace, commands } from 'vscode';
import { SlotManager } from '../slotManager';
import type { Binding } from '../types';
import type { Uri } from 'vscode';

function makeUri(fsPath: string): Uri {
  return { fsPath } as Uri;
}

function makeBinding(label: string, overrides: Partial<Binding> = {}): Binding {
  return { label, commands: [{ command: 'test.cmd' }], ...overrides };
}

function setupConfig(bindings: Binding[], slotMode = false): void {
  vi.mocked(workspace.getConfiguration).mockReturnValue({
    get: vi.fn().mockImplementation((key: string) => {
      if (key === 'bindings') { return bindings; }
      if (key === 'slotMode') { return slotMode; }
      return undefined;
    }),
  } as ReturnType<typeof workspace.getConfiguration>);
}

describe('SlotManager', () => {
  beforeEach(() => {
    vi.mocked(commands.executeCommand).mockResolvedValue(undefined);
    vi.mocked(workspace.getWorkspaceFolder).mockReturnValue(undefined);
  });

  // ── getSlotBinding ──────────────────────────────────────────────────────────

  describe('getSlotBinding', () => {
    it('returns the binding at the correct slot index', () => {
      setupConfig([makeBinding('First'), makeBinding('Second')]);
      const sm = new SlotManager();

      expect(sm.getSlotBinding(0)?.label).toBe('First');
      expect(sm.getSlotBinding(1)?.label).toBe('Second');
    });

    it('returns undefined for empty slots beyond binding count', () => {
      setupConfig([makeBinding('Only')]);
      const sm = new SlotManager();

      expect(sm.getSlotBinding(1)).toBeUndefined();
      expect(sm.getSlotBinding(9)).toBeUndefined();
    });

    it('skips disabled bindings when assigning slots', () => {
      setupConfig([
        makeBinding('Disabled', { enabled: false }),
        makeBinding('Enabled'),
      ]);
      const sm = new SlotManager();

      // The first enabled binding occupies slot 0
      expect(sm.getSlotBinding(0)?.label).toBe('Enabled');
      expect(sm.getSlotBinding(1)).toBeUndefined();
    });

    it('returns undefined for all slots when no bindings configured', () => {
      setupConfig([]);
      const sm = new SlotManager();

      expect(sm.getSlotBinding(0)).toBeUndefined();
    });
  });

  // ── getBindingsForUri ───────────────────────────────────────────────────────

  describe('getBindingsForUri', () => {
    it('returns all enabled bindings when no when clause is set', () => {
      setupConfig([makeBinding('A'), makeBinding('B'), makeBinding('C')]);
      const sm = new SlotManager();

      expect(sm.getBindingsForUri(makeUri('/project/file.ts'))).toHaveLength(3);
    });

    it('excludes disabled bindings', () => {
      setupConfig([
        makeBinding('Active'),
        makeBinding('Inactive', { enabled: false }),
      ]);
      const sm = new SlotManager();

      const result = sm.getBindingsForUri(makeUri('/project/file.ts'));
      expect(result).toHaveLength(1);
      expect(result[0].label).toBe('Active');
    });

    it('filters by fileExtensions when clause', () => {
      setupConfig([
        makeBinding('TS only', { when: { fileExtensions: ['.ts'] } }),
        makeBinding('Any file'),
      ]);
      const sm = new SlotManager();

      expect(sm.getBindingsForUri(makeUri('/project/app.ts'))).toHaveLength(2);

      const mdResult = sm.getBindingsForUri(makeUri('/project/README.md'));
      expect(mdResult).toHaveLength(1);
      expect(mdResult[0].label).toBe('Any file');
    });

    it('returns empty array when config has no bindings', () => {
      setupConfig([]);
      const sm = new SlotManager();

      expect(sm.getBindingsForUri(makeUri('/project/file.ts'))).toHaveLength(0);
    });
  });

  // ── getAllBindings ──────────────────────────────────────────────────────────

  describe('getAllBindings', () => {
    it('returns all bindings including disabled ones', () => {
      setupConfig([makeBinding('A'), makeBinding('B', { enabled: false })]);
      const sm = new SlotManager();

      expect(sm.getAllBindings()).toHaveLength(2);
    });

    it('returns an empty array when no bindings configured', () => {
      setupConfig([]);
      expect(new SlotManager().getAllBindings()).toHaveLength(0);
    });
  });

  // ── refresh / context variables ─────────────────────────────────────────────

  describe('refresh — context variables', () => {
    it('sets contextCommander.hasBindings true when enabled bindings exist', () => {
      setupConfig([makeBinding('A')]);
      new SlotManager();

      expect(vi.mocked(commands.executeCommand)).toHaveBeenCalledWith(
        'setContext', 'contextCommander.hasBindings', true,
      );
    });

    it('sets contextCommander.hasBindings false when all bindings are disabled', () => {
      setupConfig([makeBinding('A', { enabled: false })]);
      new SlotManager();

      expect(vi.mocked(commands.executeCommand)).toHaveBeenCalledWith(
        'setContext', 'contextCommander.hasBindings', false,
      );
    });

    it('sets contextCommander.hasBindings false when config is empty', () => {
      setupConfig([]);
      new SlotManager();

      expect(vi.mocked(commands.executeCommand)).toHaveBeenCalledWith(
        'setContext', 'contextCommander.hasBindings', false,
      );
    });

    it('propagates slotMode from config', () => {
      setupConfig([], true);
      new SlotManager();

      expect(vi.mocked(commands.executeCommand)).toHaveBeenCalledWith(
        'setContext', 'contextCommander.slotMode', true,
      );
    });

    it('sets slot.N.visible true for occupied slots', () => {
      setupConfig([makeBinding('A'), makeBinding('B')]);
      new SlotManager();

      expect(vi.mocked(commands.executeCommand)).toHaveBeenCalledWith(
        'setContext', 'contextCommander.slot.0.visible', true,
      );
      expect(vi.mocked(commands.executeCommand)).toHaveBeenCalledWith(
        'setContext', 'contextCommander.slot.1.visible', true,
      );
    });

    it('sets slot.N.visible false for unoccupied slots', () => {
      setupConfig([makeBinding('A')]);
      new SlotManager();

      expect(vi.mocked(commands.executeCommand)).toHaveBeenCalledWith(
        'setContext', 'contextCommander.slot.1.visible', false,
      );
      expect(vi.mocked(commands.executeCommand)).toHaveBeenCalledWith(
        'setContext', 'contextCommander.slot.9.visible', false,
      );
    });
  });
});
