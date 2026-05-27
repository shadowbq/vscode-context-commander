# Changelog

All notable changes to **Context Commander** will be documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] — 2026-05-26

### Added

- Initial release
- QuickPick picker mode: a single "Context Commander..." Explorer context menu entry shows applicable bindings for the right-clicked file
- Slot mode (opt-in): up to 10 bindings declared as static menu entries via `contextCommander.slotMode`
- Sequential command execution — each command in a binding is `await`-ed before the next runs
- Variable substitution in args: `${file}`, `${fileBasename}`, `${fileBasenameNoExtension}`, `${fileDirname}`, `${fileExtname}`, `${workspaceFolder}`, `${relativeFile}`
- `when` clause filtering by `fileExtensions`, `languageIds`, `glob` (minimatch), and `isDirectory`
- WebView settings UI (`Context Commander: Open Settings`) for managing bindings without editing JSON
- Configuration schema with full IntelliSense in `settings.json`
- `enabled` flag to disable a binding without deleting it
