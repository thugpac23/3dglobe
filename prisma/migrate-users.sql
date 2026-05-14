-- One-time migration: User enum → UserProfile model

-- 1. Create user_profiles table
CREATE TABLE IF NOT EXISTS "user_profiles" (
  "id"          TEXT         NOT NULL,
  "displayName" TEXT         NOT NULL,
  "color"       TEXT         NOT NULL DEFAULT '#8B5CF6',
  "protected"   BOOLEAN      NOT NULL DEFAULT false,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- 2. Seed tati & iva
INSERT INTO "user_profiles" ("id", "displayName", "color", "protected")
VALUES ('tati', 'Тати', '#F59E0B', true),
       ('iva',  'Ива',  '#EC4899', true)
ON CONFLICT DO NOTHING;

-- 3. Add nullable userId columns
ALTER TABLE "passport_stamps" ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE "visits"          ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE "wishlists"       ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE "user_progress"   ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE "avatars"         ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE "diary_entries"   ADD COLUMN IF NOT EXISTS "userId" TEXT;

-- 4. Backfill from enum column
UPDATE "passport_stamps" SET "userId" = "user"::TEXT WHERE "userId" IS NULL;
UPDATE "visits"          SET "userId" = "user"::TEXT WHERE "userId" IS NULL;
UPDATE "wishlists"       SET "userId" = "user"::TEXT WHERE "userId" IS NULL;
UPDATE "user_progress"   SET "userId" = "user"::TEXT WHERE "userId" IS NULL;
UPDATE "avatars"         SET "userId" = "user"::TEXT WHERE "userId" IS NULL;
UPDATE "diary_entries"   SET "userId" = "user"::TEXT WHERE "userId" IS NULL;

-- 5. Make NOT NULL
ALTER TABLE "passport_stamps" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "visits"          ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "wishlists"       ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "user_progress"   ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "avatars"         ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "diary_entries"   ALTER COLUMN "userId" SET NOT NULL;

-- 6. FK constraints
ALTER TABLE "passport_stamps" DROP CONSTRAINT IF EXISTS "passport_stamps_userId_fkey";
ALTER TABLE "passport_stamps" ADD CONSTRAINT "passport_stamps_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "visits" DROP CONSTRAINT IF EXISTS "visits_userId_fkey";
ALTER TABLE "visits" ADD CONSTRAINT "visits_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wishlists" DROP CONSTRAINT IF EXISTS "wishlists_userId_fkey";
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_progress" DROP CONSTRAINT IF EXISTS "user_progress_userId_fkey";
ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "avatars" DROP CONSTRAINT IF EXISTS "avatars_userId_fkey";
ALTER TABLE "avatars" ADD CONSTRAINT "avatars_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "diary_entries" DROP CONSTRAINT IF EXISTS "diary_entries_userId_fkey";
ALTER TABLE "diary_entries" ADD CONSTRAINT "diary_entries_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 7. Rebuild unique constraints on userId
ALTER TABLE "passport_stamps" DROP CONSTRAINT IF EXISTS "passport_stamps_countryId_user_key";
DROP INDEX IF EXISTS "passport_stamps_countryId_userId_key";
CREATE UNIQUE INDEX "passport_stamps_countryId_userId_key" ON "passport_stamps" ("countryId", "userId");

ALTER TABLE "visits" DROP CONSTRAINT IF EXISTS "visits_countryId_user_key";
DROP INDEX IF EXISTS "visits_countryId_userId_key";
CREATE UNIQUE INDEX "visits_countryId_userId_key" ON "visits" ("countryId", "userId");

ALTER TABLE "wishlists" DROP CONSTRAINT IF EXISTS "wishlists_countryId_user_key";
DROP INDEX IF EXISTS "wishlists_countryId_userId_key";
CREATE UNIQUE INDEX "wishlists_countryId_userId_key" ON "wishlists" ("countryId", "userId");

ALTER TABLE "user_progress" DROP CONSTRAINT IF EXISTS "user_progress_user_key";
DROP INDEX IF EXISTS "user_progress_userId_key";
CREATE UNIQUE INDEX "user_progress_userId_key" ON "user_progress" ("userId");

ALTER TABLE "avatars" DROP CONSTRAINT IF EXISTS "avatars_user_key";
DROP INDEX IF EXISTS "avatars_userId_key";
CREATE UNIQUE INDEX "avatars_userId_key" ON "avatars" ("userId");

-- 8. Drop old "user" enum columns
ALTER TABLE "passport_stamps" DROP COLUMN IF EXISTS "user";
ALTER TABLE "visits"          DROP COLUMN IF EXISTS "user";
ALTER TABLE "wishlists"       DROP COLUMN IF EXISTS "user";
ALTER TABLE "user_progress"   DROP COLUMN IF EXISTS "user";
ALTER TABLE "avatars"         DROP COLUMN IF EXISTS "user";
ALTER TABLE "diary_entries"   DROP COLUMN IF EXISTS "user";

-- 9. Drop User enum type
DROP TYPE IF EXISTS "User";
