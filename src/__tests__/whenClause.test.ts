import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'fs';
import { workspace } from 'vscode';
import { matchesWhen } from '../whenClause';
import type { Binding } from '../types';
import type { Uri } from 'vscode';

// Must use vi.mock (hoisted) — vi.spyOn cannot redefine ESM namespace exports
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return { ...actual, statSync: vi.fn() };
});

function makeUri(fsPath: string): Uri {
  return { fsPath } as Uri;
}

describe('matchesWhen', () => {
  beforeEach(() => {
    workspace.textDocuments.length = 0;
    vi.mocked(workspace.getWorkspaceFolder).mockReturnValue(undefined);
  });

  // ── no when clause ──────────────────────────────────────────────────────────

  it('returns true when binding has no when clause', () => {
    const b: Binding = { label: 'x', commands: [] };
    expect(matchesWhen(b, makeUri('/p/file.ts'))).toBe(true);
  });

  it('returns true when when is an empty object', () => {
    const b: Binding = { label: 'x', commands: [], when: {} };
    expect(matchesWhen(b, makeUri('/p/file.ts'))).toBe(true);
  });

  // ── fileExtensions ──────────────────────────────────────────────────────────

  describe('fileExtensions', () => {
    it('matches when extension is in the list (with dot)', () => {
      const b: Binding = { label: 'x', commands: [], when: { fileExtensions: ['.ts'] } };
      expect(matchesWhen(b, makeUri('/p/app.ts'))).toBe(true);
    });

    it('matches when extension is listed without leading dot', () => {
      const b: Binding = { label: 'x', commands: [], when: { fileExtensions: ['ts'] } };
      expect(matchesWhen(b, makeUri('/p/app.ts'))).toBe(true);
    });

    it('rejects when extension is not in the list', () => {
      const b: Binding = { label: 'x', commands: [], when: { fileExtensions: ['.md'] } };
      expect(matchesWhen(b, makeUri('/p/app.ts'))).toBe(false);
    });

    it('is case-insensitive', () => {
      const b: Binding = { label: 'x', commands: [], when: { fileExtensions: ['.TS'] } };
      expect(matchesWhen(b, makeUri('/p/app.ts'))).toBe(true);
    });

    it('matches on any extension in a multi-item list', () => {
      const b: Binding = { label: 'x', commands: [], when: { fileExtensions: ['.md', '.ts'] } };
      expect(matchesWhen(b, makeUri('/p/app.ts'))).toBe(true);
    });

    it('returns true when fileExtensions is an empty array', () => {
      const b: Binding = { label: 'x', commands: [], when: { fileExtensions: [] } };
      expect(matchesWhen(b, makeUri('/p/app.ts'))).toBe(true);
    });
  });

  // ── languageIds ─────────────────────────────────────────────────────────────

  describe('languageIds (EXT_TO_LANG fallback)', () => {
    it('matches python for .py files', () => {
      const b: Binding = { label: 'x', commands: [], when: { languageIds: ['python'] } };
      expect(matchesWhen(b, makeUri('/p/script.py'))).toBe(true);
    });

    it('matches typescript for .ts files', () => {
      const b: Binding = { label: 'x', commands: [], when: { languageIds: ['typescript'] } };
      expect(matchesWhen(b, makeUri('/p/app.ts'))).toBe(true);
    });

    it('matches markdown for .md files', () => {
      const b: Binding = { label: 'x', commands: [], when: { languageIds: ['markdown'] } };
      expect(matchesWhen(b, makeUri('/p/README.md'))).toBe(true);
    });

    it('matches shellscript for .sh files', () => {
      const b: Binding = { label: 'x', commands: [], when: { languageIds: ['shellscript'] } };
      expect(matchesWhen(b, makeUri('/p/run.sh'))).toBe(true);
    });

    it('matches yaml for .yml files', () => {
      const b: Binding = { label: 'x', commands: [], when: { languageIds: ['yaml'] } };
      expect(matchesWhen(b, makeUri('/p/config.yml'))).toBe(true);
    });

    it('rejects mismatched language id', () => {
      const b: Binding = { label: 'x', commands: [], when: { languageIds: ['python'] } };
      expect(matchesWhen(b, makeUri('/p/app.ts'))).toBe(false);
    });

    it('returns false for unknown extension when languageIds is set', () => {
      const b: Binding = { label: 'x', commands: [], when: { languageIds: ['python'] } };
      expect(matchesWhen(b, makeUri('/p/foo.unknown123'))).toBe(false);
    });

    it('uses open document languageId over EXT_TO_LANG', () => {
      workspace.textDocuments.push({ uri: { fsPath: '/p/foo.txt' }, languageId: 'markdown' });
      const b: Binding = { label: 'x', commands: [], when: { languageIds: ['markdown'] } };
      expect(matchesWhen(b, makeUri('/p/foo.txt'))).toBe(true);
    });

    it('ignores open docs for other paths', () => {
      workspace.textDocuments.push({ uri: { fsPath: '/p/other.ts' }, languageId: 'typescript' });
      const b: Binding = { label: 'x', commands: [], when: { languageIds: ['python'] } };
      // foo.ts has no open doc → falls back to EXT_TO_LANG → typescript → mismatch
      expect(matchesWhen(b, makeUri('/p/foo.ts'))).toBe(false);
    });
  });

  // ── glob ────────────────────────────────────────────────────────────────────

  describe('glob', () => {
    it('matches **/*.md pattern', () => {
      vi.mocked(workspace.asRelativePath).mockReturnValue('docs/README.md');
      const b: Binding = { label: 'x', commands: [], when: { glob: '**/*.md' } };
      expect(matchesWhen(b, makeUri('/project/docs/README.md'))).toBe(true);
    });

    it('rejects non-matching glob', () => {
      vi.mocked(workspace.asRelativePath).mockReturnValue('docs/README.md');
      const b: Binding = { label: 'x', commands: [], when: { glob: 'src/**' } };
      expect(matchesWhen(b, makeUri('/project/docs/README.md'))).toBe(false);
    });

    it('matches nested src/**/*.ts pattern', () => {
      vi.mocked(workspace.asRelativePath).mockReturnValue('src/utils/helper.ts');
      const b: Binding = { label: 'x', commands: [], when: { glob: 'src/**/*.ts' } };
      expect(matchesWhen(b, makeUri('/project/src/utils/helper.ts'))).toBe(true);
    });

    it('uses asRelativePath output directly (absolute path when no workspace)', () => {
      // When outside a workspace, vscode returns the absolute path unchanged.
      vi.mocked(workspace.asRelativePath).mockReturnValue('/project/docs/README.md');
      const b: Binding = { label: 'x', commands: [], when: { glob: '**/*.md' } };
      expect(matchesWhen(b, makeUri('/project/docs/README.md'))).toBe(true);
    });

    it('matches dotfiles with dot: true', () => {
      vi.mocked(workspace.asRelativePath).mockReturnValue('src/.env');
      const b: Binding = { label: 'x', commands: [], when: { glob: '**/.env' } };
      expect(matchesWhen(b, makeUri('/project/src/.env'))).toBe(true);
    });

    it('returns true when glob is not set', () => {
      const b: Binding = { label: 'x', commands: [], when: {} };
      expect(matchesWhen(b, makeUri('/project/file.ts'))).toBe(true);
    });
  });

  // ── isDirectory ─────────────────────────────────────────────────────────────

  describe('isDirectory', () => {
    it('returns true when isDirectory is not set', () => {
      const b: Binding = { label: 'x', commands: [] };
      expect(matchesWhen(b, makeUri('/project/src'))).toBe(true);
    });

    it('returns true for directory when isDirectory: true', () => {
      vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as fs.Stats);
      const b: Binding = { label: 'x', commands: [], when: { isDirectory: true } };
      expect(matchesWhen(b, makeUri('/project/src'))).toBe(true);
    });

    it('returns false for a file when isDirectory: true', () => {
      vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => false } as fs.Stats);
      const b: Binding = { label: 'x', commands: [], when: { isDirectory: true } };
      expect(matchesWhen(b, makeUri('/project/src/app.ts'))).toBe(false);
    });

    it('returns true for a file when isDirectory: false', () => {
      vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => false } as fs.Stats);
      const b: Binding = { label: 'x', commands: [], when: { isDirectory: false } };
      expect(matchesWhen(b, makeUri('/project/src/app.ts'))).toBe(true);
    });

    it('returns false when statSync throws (path does not exist)', () => {
      vi.mocked(fs.statSync).mockImplementation(() => { throw new Error('ENOENT'); });
      const b: Binding = { label: 'x', commands: [], when: { isDirectory: true } };
      expect(matchesWhen(b, makeUri('/nonexistent/path'))).toBe(false);
    });
  });
});
