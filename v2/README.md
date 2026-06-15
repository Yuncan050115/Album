# Yuncan Album V2

Yuncan Album V2 is a ground-up rebuild of the album system. It does not inherit the old PicImpact interaction model, database schema, or AList-centric management flow.

The goal is to build a personal image space with two equal priorities:

1. A quiet, high-end public gallery for photography and personal memory.
2. A powerful admin system for importing, organizing, processing, and publishing image assets.

## Product direction

Yuncan Album is not an AList skin and not a generic open-source gallery clone.

AList is used only as a low-cost storage source. The album system owns metadata, albums, tags, EXIF, visibility, image variants, processing jobs, and presentation logic.

```txt
AList / Local / future S3-compatible storage
        ↓
Storage Adapter
        ↓
Import + Processing Pipeline
        ↓
Database Asset Library
        ↓
Public Gallery + Admin Studio
```

## Architecture

```txt
v2/
├── apps/
│   ├── web/       Public gallery, Astro + React Islands
│   └── admin/     Management console, Next.js + React
│
├── packages/
│   ├── db/        Drizzle schema and database access
│   ├── storage/   AList / Local / future object storage adapters
│   ├── image/     Sharp, EXIF, variants and blur placeholders
│   ├── ui/        Shared shadcn/ui-based design system
│   └── shared/    Shared types and utilities
│
└── docs/          Product and implementation notes
```

## Tech stack

| Layer | Choice |
|---|---|
| Public gallery | Astro + React Islands |
| Admin console | Next.js + React |
| Styling | Tailwind CSS |
| Components | shadcn/ui + Radix |
| Animation | GSAP + View Transitions |
| 3D ambience | Three.js / React Three Fiber |
| Database | PostgreSQL |
| ORM | Drizzle ORM |
| Storage now | AList + local cache |
| Storage later | S3 / R2 / COS / OSS / MinIO |
| Image pipeline | Sharp + EXIFReader |
| Workspace | pnpm + Turborepo |

## First milestone

- Create the V2 monorepo skeleton.
- Define the asset-first database model.
- Define the storage adapter contract.
- Implement the AList adapter as the first storage source.
- Keep the old project untouched until V2 can run independently.

## Design principles

- Photos first. Effects should never overpower the image.
- AList is storage, not product architecture.
- Admin should feel like a lightweight image studio, not a database form page.
- Every image should become an asset with metadata, variants, tags, albums, and processing state.
- Object storage support must be designed now, even if it is not used yet.
