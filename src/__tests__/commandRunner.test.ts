import { describe, it, expect, beforeEach, vi } from 'vitest';
import { workspace } from 'vscode';
import { buildVariables, substituteVariables } from '../commandRunner';
import type { Uri } from 'vscode';

function makeUri(fsPath: string): Uri {
  return { fsPath } as Uri;
}

describe('buildVariables', () => {
  beforeEach(() => {
    vi.mocked(workspace.getWorkspaceFolder).mockReturnValue(undefined);
  });

  it('builds all 7 variable tokens for a file inside a workspace', () => {
    vi.mocked(workspace.getWorkspaceFolder).mockReturnValue({ uri: { fsPath: '/project' } } as ReturnType<typeof workspace.getWorkspaceFolder>);
    const vars = buildVariables(makeUri('/project/src/app.ts'));

    expect(vars['${file}']).toBe('/project/src/app.ts');
    expect(vars['${fileBasename}']).toBe('app.ts');
    expect(vars['${fileBasenameNoExtension}']).toBe('app');
    expect(vars['${fileDirname}']).toBe('/project/src');
    expect(vars['${fileExtname}']).toBe('.ts');
    expect(vars['${workspaceFolder}']).toBe('/project');
    expect(vars['${relativeFile}']).toBe('src/app.ts');
  });

  it('falls back to file dirname as workspaceFolder when no workspace', () => {
    const vars = buildVariables(makeUri('/project/src/app.ts'));

    expect(vars['${workspaceFolder}']).toBe('/project/src');
    expect(vars['${relativeFile}']).toBe('app.ts');
  });

  it('handles a file at the workspace root', () => {
    vi.mocked(workspace.getWorkspaceFolder).mockReturnValue({ uri: { fsPath: '/project' } } as ReturnType<typeof workspace.getWorkspaceFolder>);
    const vars = buildVariables(makeUri('/project/README.md'));

    expect(vars['${relativeFile}']).toBe('README.md');
    expect(vars['${fileExtname}']).toBe('.md');
    expect(vars['${fileBasenameNoExtension}']).toBe('README');
  });

  it('returns an empty extension for files without one', () => {
    vi.mocked(workspace.getWorkspaceFolder).mockReturnValue({ uri: { fsPath: '/project' } } as ReturnType<typeof workspace.getWorkspaceFolder>);
    const vars = buildVariables(makeUri('/project/Makefile'));

    expect(vars['${fileExtname}']).toBe('');
    expect(vars['${fileBasename}']).toBe('Makefile');
    expect(vars['${fileBasenameNoExtension}']).toBe('Makefile');
  });
});

describe('substituteVariables', () => {
  const vars: Record<string, string> = {
    '${file}': '/project/src/app.ts',
    '${fileBasename}': 'app.ts',
    '${workspaceFolder}': '/project',
    '${relativeFile}': 'src/app.ts',
  };

  it('replaces a single token in a string arg', () => {
    expect(substituteVariables(['echo ${file}'], vars))
      .toEqual(['echo /project/src/app.ts']);
  });

  it('replaces multiple different tokens in one string', () => {
    expect(substituteVariables(['${workspaceFolder}/${fileBasename}'], vars))
      .toEqual(['/project/app.ts']);
  });

  it('replaces all occurrences of the same token (replaceAll)', () => {
    expect(substituteVariables(['${file} ${file}'], vars))
      .toEqual(['/project/src/app.ts /project/src/app.ts']);
  });

  it('passes through non-string args unchanged', () => {
    const result = substituteVariables([42, true, null, { key: '${file}' }], vars);
    expect(result).toEqual([42, true, null, { key: '${file}' }]);
  });

  it('leaves unknown tokens untouched', () => {
    expect(substituteVariables(['${unknown}'], vars)).toEqual(['${unknown}']);
  });

  it('handles an empty args array', () => {
    expect(substituteVariables([], vars)).toEqual([]);
  });

  it('handles a string with no tokens', () => {
    expect(substituteVariables(['no tokens here'], vars)).toEqual(['no tokens here']);
  });

  it('handles mixed string and non-string args', () => {
    const result = substituteVariables(['${file}', 99, false], vars);
    expect(result).toEqual(['/project/src/app.ts', 99, false]);
  });
});
