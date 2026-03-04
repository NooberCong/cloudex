# Changelog

All notable changes to this project are documented in this file.

## [1.4.0] - 2026-03-04

### Added

- Google Cloud Storage provider support (HMAC credentials, bucket-scoped mode)
- Azure Blob Storage provider support (native Azure SDK provider)
- Custom provider icon file support from `assets/provider-icons` with extension fallback
- Provider-aware icon rendering across Add Provider, Sidebar, and Settings
- `objects:exists` IPC endpoint to avoid metadata-error spam during existence checks

### Changed

- GCS now requires bucket name in Add Provider flow (bucket-scoped mode)
- Test Connection now returns user-friendly error text in UI while logging full details in terminal
- Error toasts now auto-dismiss (2x success duration) instead of persisting indefinitely
- Operation success toasts now include involved item names (`Deleted`, `Copied`, `Moved`)
- Settings provider rows now show richer provider-specific details (including Azure account/endpoint)
- Settings page provider action controls (`Add`, `Edit`, `Delete`) restyled to match app aesthetics

### Fixed

- GCS move/cut delete failures caused by unsupported `POST ?delete` now fall back to per-object delete
- Duplicate operation toasts are deduplicated in a short window
- Azure `BlobNotFound` noisy metadata errors during expected existence checks

## [1.3.0] - 2026-03-03

### Added

- Backblaze B2 provider support (S3-compatible endpoint defaults + region suggestions)
- Wasabi provider support (S3-compatible endpoint defaults + region suggestions)
- MinIO provider support (S3-compatible endpoint defaults + region suggestions)
- DigitalOcean Spaces support (S3-compatible endpoint defaults + region suggestions)

### Changed

- Connection provider type picker now uses a dropdown with provider icons
- Sidebar provider rows now prioritize connection names with hover-revealed action buttons

## [1.2.0] - 2026-03-03

### Added

- Separate top-bar upload actions for `Files` and `Folder`
- Folder upload transfer grouping with 1-level child file progress display
- Single-instance app lock (second launch focuses existing window)
- Long connection-name tooltip in sidebar when label is truncated

### Changed

- Region input suggestions UI refreshed to match app style, with capped height and scrolling
- File-list marquee initiation behavior refined for the modified-column drag lane
- Improved large-list selection performance during marquee drag

### Fixed

- Cloudflare R2 bucket listing fallback behavior for `ListBuckets` incompatibilities
- Enter key confirmation for open dialogs (including delete confirmation)
- Enter key opens selected file/folder when no dialog is focused
- Rename conflict flow now prompts before overwriting existing items
- New-folder conflict flow now prompts before merging/replacing
- Region suggestion input no longer turns white after selecting a suggested value
- Marquee rectangle positioning now stays aligned while scrolling

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
[1.2.0]: https://github.com/<your-org>/<your-repo>/releases/tag/v1.2.0
[1.3.0]: https://github.com/<your-org>/<your-repo>/releases/tag/v1.3.0
[1.4.0]: https://github.com/<your-org>/<your-repo>/releases/tag/v1.4.0
