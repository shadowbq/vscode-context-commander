import * as path from 'path';
import * as vscode from 'vscode';
import { Binding, RunResult } from './types';

/**
 * Executes all commands in a binding sequentially against the given URI.
 *
 * - Opens the file in the editor (preserving focus) before running, so
 *   commands that operate on the active editor work correctly.
 * - Substitutes variable tokens in string arguments.
 * - Returns a result object describing success or the first failure.
 */
export async function runBinding(binding: Binding, uri: vscode.Uri): Promise<RunResult> {
  // Attempt to open the file so commands that need an active editor work.
  // Skip for directories and binary-looking extensions.
  if (!isDirectory(uri)) {
    try {
      await vscode.window.showTextDocument(uri, {
        preserveFocus: true,
        preview: true,
      });
    } catch {
      // Silently continue — the file may be binary or already handled by the command.
    }
  }

  const variables = buildVariables(uri);

  for (const entry of binding.commands) {
    try {
      if (entry.args && entry.args.length > 0) {
        const resolvedArgs = substituteVariables(entry.args, variables);
        await vscode.commands.executeCommand(entry.command, ...resolvedArgs);
      } else {
        // No explicit args: pass the URI so Explorer-aware commands work.
        await vscode.commands.executeCommand(entry.command, uri);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      vscode.window.showErrorMessage(
        `Context Commander: "${entry.command}" failed — ${error.message}`
      );
      return { success: false, failedCommand: entry.command, error };
    }
  }

  return { success: true };
}

// ── Variable substitution ─────────────────────────────────────────────────────

/**
 * Supported tokens (mirrors VS Code's built-in task variable format):
 *   ${file}                     → absolute file path
 *   ${fileBasename}             → filename with extension
 *   ${fileBasenameNoExtension}  → filename without extension
 *   ${fileDirname}              → parent directory
 *   ${fileExtname}              → extension including dot
 *   ${workspaceFolder}          → workspace root (or file dir if no workspace)
 *   ${relativeFile}             → workspace-relative path
 */
export function buildVariables(uri: vscode.Uri): Record<string, string> {
  const fsPath = uri.fsPath;
  const workspaceFolder =
    vscode.workspace.getWorkspaceFolder(uri)?.uri.fsPath ?? path.dirname(fsPath);

  return {
    '${file}':                    fsPath,
    '${fileBasename}':            path.basename(fsPath),
    '${fileBasenameNoExtension}': path.basename(fsPath, path.extname(fsPath)),
    '${fileDirname}':             path.dirname(fsPath),
    '${fileExtname}':             path.extname(fsPath),
    '${workspaceFolder}':         workspaceFolder,
    '${relativeFile}':            path.relative(workspaceFolder, fsPath),
  };
}

export function substituteVariables(args: unknown[], variables: Record<string, string>): unknown[] {
  return args.map(arg => {
    if (typeof arg !== 'string') { return arg; }
    return Object.entries(variables).reduce(
      (str, [token, value]) => str.replaceAll(token, value),
      arg
    );
  });
}

function isDirectory(uri: vscode.Uri): boolean {
  try {
    const fs = require('fs') as typeof import('fs');
    return fs.statSync(uri.fsPath).isDirectory();
  } catch {
    return false;
  }
}
