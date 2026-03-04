<p align="center">
  <img src="./build/icon.png" alt="CloudEx Icon" width="112" />
</p>
<h1 align="center">CloudEx</h1>
<p align="center">
  <img alt="Electron" src="https://img.shields.io/badge/Electron-35+-47848F?logo=electron&logoColor=white" /> <img alt="React" src="https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white" /> <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" /> <img alt="AWS S3" src="https://img.shields.io/badge/AWS-S3-FF9900?logo=amazons3&logoColor=white" /> <img alt="Cloudflare R2" src="https://img.shields.io/badge/Cloudflare-R2-F38020?logo=cloudflare&logoColor=white" /> <img alt="Backblaze B2" src="https://img.shields.io/badge/Backblaze-B2-E85C33" /> <img alt="Wasabi" src="https://img.shields.io/badge/Wasabi-74B72E" /> <img alt="MinIO" src="https://img.shields.io/badge/MinIO-C72E49" /> <img alt="DigitalOcean Spaces" src="https://img.shields.io/badge/DO-Spaces-0080FF" /> <img alt="Google Cloud Storage" src="https://img.shields.io/badge/GCS-4285F4" /> <img alt="Azure Blob Storage" src="https://img.shields.io/badge/Azure-Blob-0078D4" /> <img alt="License MIT" src="https://img.shields.io/badge/License-MIT-22C55E" />
</p>

CloudEx is a desktop file manager for object storage, supporting AWS S3, Cloudflare R2, Backblaze B2, Wasabi, MinIO, DigitalOcean Spaces, Google Cloud Storage (HMAC), and Azure Blob Storage.

It is built with Electron, React, TypeScript, Zustand, and the AWS SDK v3.

## Highlights

- Multi-connection support for AWS S3, Cloudflare R2, Backblaze B2, Wasabi, MinIO, DigitalOcean Spaces, Google Cloud Storage, and Azure Blob Storage
- Provider type selector with icon-based dropdown in connection settings
- Custom provider icon overrides via `assets/provider-icons` (`svg/png/webp/jpg/jpeg/gif`)
- Bucket and object browsing with search, pagination, and auto load more
- List and grid views
- Upload and download with transfer progress
- Drag and drop file upload
- Drag items onto folders to move them
- Separate file/folder upload actions
- Folder upload support with grouped parent/child progress
- Copy, cut, paste, rename, delete, and create folder
- Multi-select operations and bulk download (zip)
- Windows-style click-drag rectangle multi-select
- Improved marquee performance for large item lists
- Clipboard panel with expandable item list and in-progress operation indicator
- Enter key support for dialog confirm and opening selected item
- Single-instance app behavior
- Presigned URL generation with configurable expiration
- Context menus and keyboard shortcuts
- Light/dark theme support
- Improved operation result toasts with affected-item details
- Local encrypted storage for connection settings (`electron-store`)

## Screenshots

### Main List View
![Main List View](./assets/screenshots/main-list.png)

### Main Grid View
![Main Grid View](./assets/screenshots/main-grid.png)

### Settings and Connections
![Settings Connections](./assets/screenshots/settings-connections.png)

### Transfer Queue
![Transfers](./assets/screenshots/transfers.png)

## Tech Stack

- Electron + electron-vite
- React 19 + TypeScript
- Zustand state management
- Tailwind CSS + Radix UI primitives
- AWS SDK v3 (`@aws-sdk/client-s3`, `@aws-sdk/lib-storage`, presigner)

## Requirements

- Node.js 20+ (Node.js 22 LTS recommended)
- npm 10+
- Windows, macOS, or Linux

## Quick Start

```bash
npm install
npm run dev
```

## Scripts

- `npm run dev`: Start local development app (Electron + Vite)
- `npm run build`: Build main, preload, and renderer output into `out/`
- `npm run typecheck`: Type-check renderer and Electron code
- `npm run preview`: Preview built renderer
- `npm run dist`: Build and package for current platform
- `npm run dist:win`: Build and package Windows artifacts
- `npm run dist:mac`: Build and package macOS artifacts
- `npm run dist:linux`: Build and package Linux artifacts
- `npm run build:win`: Alias of `dist:win`
- `npm run build:mac`: Alias of `dist:mac`
- `npm run build:linux`: Alias of `dist:linux`

## Keyboard Shortcuts

- `Ctrl/Cmd + A`: Select all
- `Ctrl/Cmd + C`: Copy selected items
- `Ctrl/Cmd + X`: Cut selected items
- `Ctrl/Cmd + V`: Paste clipboard items
- `Delete` or `Backspace`: Delete selected items
- `Ctrl/Cmd + D`: Delete selected items
- `F5` or `Ctrl/Cmd + R`: Refresh current folder
- `Enter`: Open selected file/folder (or confirm focused dialog action)
- `Escape`: Clear current selection
- `Shift + Click`: Select range
- `Ctrl/Cmd + Click`: Toggle item selection

## Packaging Output

Packaged artifacts are generated in:

- `release/`

Configured targets:

- Windows: NSIS installer
- macOS: DMG
- Linux: default electron-builder Linux target

## AWS/R2 Permissions

CloudEx can work in two access modes:

1. Bucket-scoped mode (recommended): configure a specific bucket in the provider settings.
   In this mode, bucket listing is not required for normal browsing/operations.
2. Account-wide mode: allows listing buckets.

Minimum permissions depend on features you use. Typical permissions include:

- `s3:ListBucket`
- `s3:GetObject`
- `s3:PutObject`
- `s3:DeleteObject`
- `s3:CopyObject`

Only grant `s3:ListAllMyBuckets` if you need global bucket listing.

## Provider Credential Quick Guide

Use this section when adding a connection in CloudEx.

### AWS S3

- Access Key ID: IAM access key ID
- Secret Access Key: IAM secret access key
- Region: your bucket region (for example `us-east-1`)
- Quirks:
  - Bucket Name is optional; set it to use bucket-scoped mode.
  - If account-wide listing fails, either grant `s3:ListAllMyBuckets` or set Bucket Name.

### Cloudflare R2

- Access Key ID: R2 API token access key ID
- Secret Access Key: R2 API token secret
- Account ID: optional in CloudEx if you provide full endpoint
- Quirks:
  - You must provide either Account ID or a custom endpoint.
  - Region is `auto`.

### Backblaze B2 (S3 API)

- Access Key ID: keyID from B2 application key
- Secret Access Key: application key secret
- Region: B2 S3 region (for example `us-west-004`)
- Quirks:
  - Endpoint defaults to `https://s3.<region>.backblazeb2.com`.

### Wasabi

- Access Key ID: Wasabi access key
- Secret Access Key: Wasabi secret key
- Region: Wasabi region (for example `us-east-1`)
- Quirks:
  - Endpoint defaults to `https://s3.<region>.wasabisys.com`.

### MinIO

- Access Key ID: MinIO access key
- Secret Access Key: MinIO secret key
- Region: usually `us-east-1`
- Quirks:
  - Default endpoint is `http://127.0.0.1:9000`.
  - Set your server endpoint explicitly for remote/self-hosted deployments.

### DigitalOcean Spaces

- Access Key ID: Spaces access key
- Secret Access Key: Spaces secret key
- Region: Spaces region slug (for example `nyc3`)
- Quirks:
  - Endpoint defaults to `https://<region>.digitaloceanspaces.com`.

### Google Cloud Storage (HMAC)

- Access Key ID: GCS HMAC access key
- Secret Access Key: GCS HMAC secret
- Quirks:
  - CloudEx uses bucket-scoped mode for GCS: Bucket Name is required.
  - Use HMAC credentials (Interoperability keys), not service-account JSON key files.

### Azure Blob Storage

- Access Key ID field in CloudEx: Azure Storage Account Name
- Secret Access Key field in CloudEx: Azure Storage Account Key
- Quirks:
  - Endpoint defaults to `https://<account>.blob.core.windows.net`.
  - Bucket Name field maps to container scope (optional, but recommended for least privilege).
  - In Azure Portal, credentials are under Storage Account -> Access keys.

## Project Structure

```text
electron/
  main/       # App lifecycle, window, IPC handlers, providers
  preload/    # contextBridge API for renderer
src/
  components/ # UI and feature components
  store/      # Zustand stores
  lib/        # Utilities
  types/      # Shared renderer types
build/
  icon assets
```

## Security Notes

- Provider credentials are stored locally via `electron-store`.
- Storage API operations are performed in Electron main process (not renderer).
- Do not commit local secrets, config exports, or packaged credentials.

## Troubleshooting

- Icon changes not visible in dev:
  fully close and restart `npm run dev`.
- AccessDenied on bucket listing:
  use bucket-scoped mode or grant `s3:ListAllMyBuckets` if account-wide listing is required.
- Google Cloud Storage connection fails:
  use HMAC credentials (not JSON key) and set Bucket Name (bucket-scoped mode required).
- Azure Blob Storage credentials:
  use Account Name as `Access Key ID` and Account Key as `Secret Access Key`.
- Packaging issues:
  run `npm run build` first, then run a `dist:*` script.

## License

MIT
