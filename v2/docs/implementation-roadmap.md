# Yuncan Album V2 Roadmap

## Phase 0 — Foundation

Goal: create an independent V2 project without breaking the existing repository.

Tasks:

- Set up pnpm workspace.
- Set up Turborepo.
- Add `packages/db`.
- Add `packages/storage`.
- Add AList adapter.
- Add database schema for assets, albums, variants, tags, storage providers, and import jobs.

## Phase 1 — Admin Core

Goal: build a powerful management console.

Modules:

- Dashboard
- Media Library
- Album Studio
- AList Import Center
- Processing Jobs
- Storage Center
- Site Settings

## Phase 2 — Public Gallery

Goal: build a quiet, high-end public gallery.

Pages:

- Home
- Album list
- Album detail
- Photo detail
- Tag archive
- About

Visual direction:

- Large spacing
- Soft dark mode
- Poetic hero
- Subtle Three.js ambience
- GSAP entrance transitions
- Photo-first composition

## Phase 3 — Image Pipeline

Goal: stop relying on raw remote images for everything.

Pipeline:

1. Scan AList directory.
2. Create asset records.
3. Fetch image metadata.
4. Parse EXIF.
5. Generate thumb / medium / large variants.
6. Generate blur placeholder.
7. Store local cache paths.
8. Publish to gallery.

## Phase 4 — Future Storage Upgrade

Goal: upgrade storage without changing album logic.

Storage providers to support later:

- Cloudflare R2
- Tencent COS
- Aliyun OSS
- AWS S3
- MinIO

The app should call only the storage adapter contract. It should never care whether the file comes from AList or S3.
