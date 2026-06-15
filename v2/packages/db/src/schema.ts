import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const assetVisibility = pgEnum("asset_visibility", [
  "public",
  "unlisted",
  "private",
]);

export const assetStatus = pgEnum("asset_status", [
  "processing",
  "active",
  "failed",
  "hidden",
  "deleted",
]);

export const storageProviderType = pgEnum("storage_provider_type", [
  "alist",
  "local",
  "s3",
  "r2",
  "cos",
  "oss",
  "minio",
]);

export const importJobStatus = pgEnum("import_job_status", [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
]);

export const assets = pgTable(
  "assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: varchar("title", { length: 200 }),
    description: text("description"),

    sourceType: storageProviderType("source_type").notNull().default("alist"),
    sourcePath: text("source_path").notNull(),
    originalUrl: text("original_url"),

    width: integer("width"),
    height: integer("height"),
    aspectRatio: text("aspect_ratio"),

    takenAt: timestamp("taken_at", { withTimezone: true }),
    camera: varchar("camera", { length: 200 }),
    lens: varchar("lens", { length: 200 }),
    longitude: text("longitude"),
    latitude: text("latitude"),
    exif: jsonb("exif"),

    blurData: text("blur_data"),
    visibility: assetVisibility("visibility").notNull().default("private"),
    status: assetStatus("status").notNull().default("processing"),
    isFeatured: boolean("is_featured").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    statusIdx: index("assets_status_idx").on(table.status),
    visibilityIdx: index("assets_visibility_idx").on(table.visibility),
    takenAtIdx: index("assets_taken_at_idx").on(table.takenAt),
  }),
);

export const assetVariants = pgTable(
  "asset_variants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    assetId: uuid("asset_id").notNull().references(() => assets.id, {
      onDelete: "cascade",
    }),
    variant: varchar("variant", { length: 50 }).notNull(),
    url: text("url"),
    localPath: text("local_path"),
    width: integer("width"),
    height: integer("height"),
    size: integer("size"),
    mimeType: varchar("mime_type", { length: 100 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    assetVariantIdx: index("asset_variants_asset_variant_idx").on(
      table.assetId,
      table.variant,
    ),
  }),
);

export const albums = pgTable(
  "albums",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: varchar("slug", { length: 200 }).notNull().unique(),
    title: varchar("title", { length: 200 }).notNull(),
    subtitle: varchar("subtitle", { length: 300 }),
    poem: text("poem"),
    description: text("description"),
    coverAssetId: uuid("cover_asset_id").references(() => assets.id, {
      onDelete: "set null",
    }),
    layout: varchar("layout", { length: 50 }).notNull().default("masonry"),
    visibility: assetVisibility("visibility").notNull().default("private"),
    sort: integer("sort").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    visibilityIdx: index("albums_visibility_idx").on(table.visibility),
    sortIdx: index("albums_sort_idx").on(table.sort),
  }),
);

export const albumItems = pgTable(
  "album_items",
  {
    albumId: uuid("album_id").notNull().references(() => albums.id, {
      onDelete: "cascade",
    }),
    assetId: uuid("asset_id").notNull().references(() => assets.id, {
      onDelete: "cascade",
    }),
    sort: integer("sort").notNull().default(0),
    caption: text("caption"),
    isFeatured: boolean("is_featured").notNull().default(false),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.albumId, table.assetId] }),
    sortIdx: index("album_items_sort_idx").on(table.albumId, table.sort),
  }),
);

export const tags = pgTable("tags", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  color: varchar("color", { length: 30 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const assetTags = pgTable(
  "asset_tags",
  {
    assetId: uuid("asset_id").notNull().references(() => assets.id, {
      onDelete: "cascade",
    }),
    tagId: uuid("tag_id").notNull().references(() => tags.id, {
      onDelete: "cascade",
    }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.assetId, table.tagId] }),
  }),
);

export const storageProviders = pgTable("storage_providers", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: storageProviderType("type").notNull().default("alist"),
  name: varchar("name", { length: 100 }).notNull(),
  endpoint: text("endpoint").notNull(),
  config: jsonb("config"),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const importJobs = pgTable(
  "import_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    providerId: uuid("provider_id").notNull().references(() => storageProviders.id, {
      onDelete: "cascade",
    }),
    path: text("path").notNull(),
    status: importJobStatus("status").notNull().default("queued"),
    total: integer("total").notNull().default(0),
    success: integer("success").notNull().default(0),
    failed: integer("failed").notNull().default(0),
    logs: jsonb("logs"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    statusIdx: index("import_jobs_status_idx").on(table.status),
  }),
);
