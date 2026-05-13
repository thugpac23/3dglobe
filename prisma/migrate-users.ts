/**
 * One-time migration: convert User enum → UserProfile model.
 * Run with:  npx tsx prisma/migrate-users.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('▶ Starting user profile migration…');

  // 1. Create user_profiles table (idempotent)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "user_profiles" (
      "id"          TEXT        NOT NULL,
      "displayName" TEXT        NOT NULL,
      "color"       TEXT        NOT NULL DEFAULT '#8B5CF6',
      "protected"   BOOLEAN     NOT NULL DEFAULT false,
      "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
    )
  `);
  console.log('  ✓ user_profiles table ready');

  // 2. Seed the two built-in users
  await prisma.$executeRawUnsafe(`
    INSERT INTO "user_profiles" ("id", "displayName", "color", "protected")
    VALUES ('tati', 'Тати', '#F59E0B', true),
           ('iva',  'Ива',  '#EC4899', true)
    ON CONFLICT DO NOTHING
  `);
  console.log('  ✓ tati & iva seeded');

  // 3. Add nullable userId columns to every model that has user enum
  const tables = ['passport_stamps', 'visits', 'wishlists', 'user_progress', 'avatars', 'diary_entries'];
  for (const tbl of tables) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "${tbl}" ADD COLUMN IF NOT EXISTS "userId" TEXT`
    );
  }
  console.log('  ✓ userId columns added');

  // 4. Backfill from enum values (cast enum to text)
  for (const tbl of tables) {
    await prisma.$executeRawUnsafe(
      `UPDATE "${tbl}" SET "userId" = "user"::TEXT WHERE "userId" IS NULL`
    );
  }
  console.log('  ✓ userId columns populated');

  // 5. NOT NULL
  for (const tbl of tables) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "${tbl}" ALTER COLUMN "userId" SET NOT NULL`
    );
  }
  console.log('  ✓ userId columns made NOT NULL');

  // 6. Add FK constraints (idempotent via IF NOT EXISTS workaround)
  const fkDefs: [string, string][] = [
    ['passport_stamps', 'passport_stamps_userId_fkey'],
    ['visits',          'visits_userId_fkey'],
    ['wishlists',       'wishlists_userId_fkey'],
    ['user_progress',   'user_progress_userId_fkey'],
    ['avatars',         'avatars_userId_fkey'],
    ['diary_entries',   'diary_entries_userId_fkey'],
  ];
  for (const [tbl, name] of fkDefs) {
    // Drop first if exists, then add fresh
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "${tbl}" DROP CONSTRAINT IF EXISTS "${name}"`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "${tbl}" ADD CONSTRAINT "${name}"
       FOREIGN KEY ("userId") REFERENCES "user_profiles"("id")
       ON DELETE CASCADE ON UPDATE CASCADE`
    );
  }
  console.log('  ✓ FK constraints added');

  // 7. Drop old unique constraints on enum user column, add new ones on userId
  const uniqueOps: Array<[string, string, string]> = [
    // [table, old_constraint_name, new_index_name]
    ['passport_stamps', 'passport_stamps_countryId_user_key', 'passport_stamps_countryId_userId_key'],
    ['visits',          'visits_countryId_user_key',          'visits_countryId_userId_key'],
    ['wishlists',       'wishlists_countryId_user_key',        'wishlists_countryId_userId_key'],
    ['user_progress',   'user_progress_user_key',              'user_progress_userId_key'],
    ['avatars',         'avatars_user_key',                    'avatars_userId_key'],
  ];
  for (const [tbl, oldName, newName] of uniqueOps) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "${tbl}" DROP CONSTRAINT IF EXISTS "${oldName}"`
    );
    await prisma.$executeRawUnsafe(
      `DROP INDEX IF EXISTS "${newName}"`
    );
    if (tbl === 'passport_stamps') {
      await prisma.$executeRawUnsafe(
        `CREATE UNIQUE INDEX "${newName}" ON "${tbl}" ("countryId", "userId")`
      );
    } else if (tbl === 'visits') {
      await prisma.$executeRawUnsafe(
        `CREATE UNIQUE INDEX "${newName}" ON "${tbl}" ("countryId", "userId")`
      );
    } else if (tbl === 'wishlists') {
      await prisma.$executeRawUnsafe(
        `CREATE UNIQUE INDEX "${newName}" ON "${tbl}" ("countryId", "userId")`
      );
    } else {
      // user_progress, avatars
      await prisma.$executeRawUnsafe(
        `CREATE UNIQUE INDEX "${newName}" ON "${tbl}" ("userId")`
      );
    }
  }
  console.log('  ✓ unique constraints rebuilt on userId');

  // 8. Drop old "user" columns
  for (const tbl of tables) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "${tbl}" DROP COLUMN IF EXISTS "user"`
    );
  }
  console.log('  ✓ old "user" enum columns dropped');

  // 9. Drop the User enum type
  await prisma.$executeRawUnsafe(`DROP TYPE IF EXISTS "User"`);
  console.log('  ✓ User enum type dropped');

  console.log('✅ Migration complete!');
}

main()
  .catch(e => { console.error('Migration failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
