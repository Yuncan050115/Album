-- Album admin/homepage performance indexes
-- Run once if admin image list or homepage pagination feels slow:
-- psql "$DATABASE_URL" -f scripts/postgres-performance-indexes.sql

CREATE INDEX IF NOT EXISTS idx_images_public_homepage
  ON "public"."images" (del, show, show_on_mainpage, created_at DESC, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_images_admin_list
  ON "public"."images" (del, sort DESC, created_at DESC, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_albums_visible
  ON "public"."albums" (del, show, sort DESC);

CREATE INDEX IF NOT EXISTS idx_images_albums_relation_album
  ON "public"."images_albums_relation" (album_value);

CREATE INDEX IF NOT EXISTS idx_images_albums_relation_image
  ON "public"."images_albums_relation" ("imageId");
