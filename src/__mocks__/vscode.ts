/**
 * Minimal stub of the `vscode` API for unit tests.
 * Vitest resolves `import ... from 'vscode'` to this file via the alias in vitest.config.ts.
 */
import { vi } from 'vitest';

export const workspace = {
  /** Mutable list – push fake TextDocument entries in individual tests. */
  textDocuments: [] as Array<{ uri: { fsPath: string }; languageId: string }>,
  getWorkspaceFolder: vi.fn<[unknown], { uri: { fsPath: string } } | undefined>(),
  getConfiguration: vi.fn(),
  asRelativePath: vi.fn<[unknown, boolean?], string>(),
};

export const commands = {
  executeCommand: vi.fn().mockResolvedValue(undefined),
};

export const window = {
  showTextDocument: vi.fn().mockResolvedValue(undefined),
  showErrorMessage: vi.fn(),
};

/** Minimal Uri shape — only `fsPath` and `scheme` are needed by the source. */
export class Uri {
  readonly fsPath: string;
  readonly scheme: string;

  private constructor(fsPath: string, scheme = 'file') {
    this.fsPath = fsPath;
    this.scheme = scheme;
  }

  static file(fsPath: string): Uri {
    return new Uri(fsPath);
  }

  toString(): string {
    return `${this.scheme}://${this.fsPath}`;
  }
}
