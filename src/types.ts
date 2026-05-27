/**
 * Shared TypeScript interfaces for Context Commander.
 */

export interface CommandEntry {
  /** VS Code command ID (e.g. "editor.action.formatDocument") */
  command: string;
  /** Optional arguments. Strings support variable token substitution. */
  args?: unknown[];
}

export interface WhenClause {
  /** File extensions to match, e.g. [".md", ".markdown"]. Leading dot optional. */
  fileExtensions?: string[];
  /** VS Code language IDs to match, e.g. ["markdown", "python"]. */
  languageIds?: string[];
  /** Minimatch glob matched against the workspace-relative file path. */
  glob?: string;
  /** When true, only show for directories; when false, only for files. */
  isDirectory?: boolean;
}

export interface Binding {
  /** Display name shown in the picker or slot menu. */
  label: string;
  /** Ordered sequence of commands to execute. */
  commands: CommandEntry[];
  /** Optional filtering rules. Absent = match all. */
  when?: WhenClause;
  /** Explorer menu group (slot mode only). Default: "navigation". */
  group?: string;
  /** Set false to disable without deleting. Default: true. */
  enabled?: boolean;
}

export interface RunResult {
  success: boolean;
  failedCommand?: string;
  error?: Error;
}

export interface WebviewMessage {
  type: string;
  [key: string]: unknown;
}
