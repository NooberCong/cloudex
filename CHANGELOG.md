# Changelog

All notable changes to this project are documented in this file.

## [1.1.0] - 2026-03-03

### Added

- Drag-and-drop move: drag file/folder items onto a folder row to move them
- Windows-style marquee (click-drag rectangle) selection in file list/grid view
- Clipboard status panel expansion for multi-item copy/cut, showing full item list
- Clipboard operation progress indicator while paste/move actions are running
- Explicit keyboard shortcut documentation in README

### Changed

- Clipboard operation status row now renders above the clipboard item-list bar
- Internal item drag dropped on current/empty area is treated as no-op (no upload error)
- Multi-select UX refined to preserve normal click selection while supporting marquee drag

### Fixed

- Critical folder move/cut data-loss bug where nested objects could disappear
- Folder copy/rename now recursively copies nested contents before source delete
- Recursive folder move/copy now works across buckets within the same provider
- Marquee selection finalization on mouse release over rows now correctly applies selection

## [1.0.0] - 2026-03-03

First public release of CloudEx.

### Added

- Desktop object storage manager for AWS S3 and Cloudflare R2
- Connection management: add, edit, delete, refresh/test connection
- Bucket-scoped provider behavior to avoid unnecessary account-wide bucket listing
- File list and grid views
- Search across folder items with debounced input
- Infinite scrolling with automatic load more and loading indicators
- Context menus for files, folders, and empty area actions
- Toolbar actions for copy, cut, paste, refresh, upload, and create folder
- Keyboard shortcuts for common file operations
- Back/forward mouse button navigation for folder history
- Double-click file open with OS default app
- Drag and drop file/folder upload
- Upload conflict handling with in-app dialog
- Transfer queue with progress, status toasts, and post-download explorer action
- Multi-select download support with zip output
- Presigned URL generation with configurable expiration and regeneration
- Theme support and improved light mode contrast palette
- Cloud app icon assets for app window and packaging

### Changed

- Improved list column alignment and header consistency
- Reduced disruptive content remount effects during refresh/reload
- Standardized toast layout, auto-dismiss behavior, and animation consistency
- Improved connection/settings flow between sidebar and settings panel

### Fixed

- React maximum update depth loops in refresh/update flows
- Duplicate success toasts during upload flows
- Upload toast not clearing after completion
- Drag and drop edge cases where dropped path was not resolved
- Grid mode rendering/auto-load issues
- Navigation edge cases after rename/delete affecting history state
- Cut/paste behavior in same-folder operations
- Folder modified-time fallback handling
- Settings modal open animation jump from corner to center
- R2 account ID handling and optional field support
- Connection test timeout handling to avoid stuck states

[1.0.0]: https://github.com/<your-org>/<your-repo>/releases/tag/v1.0.0
[1.1.0]: https://github.com/<your-org>/<your-repo>/releases/tag/v1.1.0
