import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { minimatch } from 'minimatch';
import { Binding, WhenClause } from './types';

/**
 * Language ID lookup for files that may not be open in an editor.
 * Covers the most common file types; open documents are checked first.
 */
const EXT_TO_LANG: Record<string, string> = {
  '.ts':          'typescript',
  '.tsx':         'typescriptreact',
  '.js':          'javascript',
  '.mjs':         'javascript',
  '.cjs':         'javascript',
  '.jsx':         'javascriptreact',
  '.py':          'python',
  '.md':          'markdown',
  '.markdown':    'markdown',
  '.json':        'json',
  '.jsonc':       'jsonc',
  '.html':        'html',
  '.htm':         'html',
  '.css':         'css',
  '.scss':        'scss',
  '.less':        'less',
  '.sh':          'shellscript',
  '.bash':        'shellscript',
  '.zsh':         'shellscript',
  '.yaml':        'yaml',
  '.yml':         'yaml',
  '.xml':         'xml',
  '.rb':          'ruby',
  '.go':          'go',
  '.rs':          'rust',
  '.java':        'java',
  '.c':           'c',
  '.h':           'c',
  '.cpp':         'cpp',
  '.cc':          'cpp',
  '.cxx':         'cpp',
  '.hpp':         'cpp',
  '.cs':          'csharp',
  '.php':         'php',
  '.sql':         'sql',
  '.tf':          'terraform',
  '.dockerfile':  'dockerfile',
  '.toml':        'toml',
  '.ini':         'ini',
  '.env':         'dotenv',
  '.r':           'r',
  '.swift':       'swift',
  '.kt':          'kotlin',
  '.kts':         'kotlin',
  '.lua':         'lua',
  '.ps1':         'powershell',
  '.psm1':        'powershell',
};

/**
 * Returns true if the given URI matches all conditions in the binding's `when` clause.
 * An absent or empty `when` object always returns true.
 */
export function matchesWhen(binding: Binding, uri: vscode.Uri): boolean {
  const when = binding.when;
  if (!when) { return true; }

  return (
    matchesFileExtensions(when, uri) &&
    matchesLanguageIds(when, uri) &&
    matchesGlob(when, uri) &&
    matchesIsDirectory(when, uri)
  );
}

function matchesFileExtensions(when: WhenClause, uri: vscode.Uri): boolean {
  if (!when.fileExtensions?.length) { return true; }

  const ext = path.extname(uri.fsPath).toLowerCase();
  const normalized = when.fileExtensions.map(e =>
    e.startsWith('.') ? e.toLowerCase() : `.${e.toLowerCase()}`
  );
  return normalized.includes(ext);
}

function matchesLanguageIds(when: WhenClause, uri: vscode.Uri): boolean {
  if (!when.languageIds?.length) { return true; }

  // Prefer the language ID from an already-open document
  const openDoc = vscode.workspace.textDocuments.find(
    d => d.uri.fsPath === uri.fsPath
  );
  const langId = openDoc?.languageId
    ?? EXT_TO_LANG[path.extname(uri.fsPath).toLowerCase()];

  if (!langId) { return false; }
  return when.languageIds.includes(langId);
}

function matchesGlob(when: WhenClause, uri: vscode.Uri): boolean {
  if (!when.glob) { return true; }

  const relativePath = vscode.workspace.asRelativePath(uri, false);
  return minimatch(relativePath, when.glob, { dot: true });
}

function matchesIsDirectory(when: WhenClause, uri: vscode.Uri): boolean {
  if (when.isDirectory === undefined) { return true; }

  try {
    const stat = fs.statSync(uri.fsPath);
    return when.isDirectory === stat.isDirectory();
  } catch {
    return false;
  }
}
