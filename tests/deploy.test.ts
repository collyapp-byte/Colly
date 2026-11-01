import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

/** The source of a file in this repo. */
function source(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

/** SQL without its `--` comments, so a note about a statement is not the statement. */
function sql(path: string): string {
  return source(path).replace(/--[^\n]*/g, "");
}

const pkg = JSON.parse(source("package.json")) as {
  scripts: Record<string, string>;
};

test("a deploy migrates the database before it builds the app", () => {
  const build = pkg.scripts.build;
  const deploy = build.indexOf("prisma migrate deploy");
  const generate = build.indexOf("prisma generate");
  const next = build.indexOf("next build");

  assert.ok(deploy >= 0, "build must run `prisma migrate deploy`");
  assert.ok(generate >= 0, "build must run `prisma generate`");
  assert.ok(next >= 0, "build must run `next build`");

  // Order is the whole point: the DDL lands first, the client is regenerated
  // from the new schema second, and only then does the app compile against it.
  // A client generated before the migration is how `P2022 column does not
  // exist` reaches production with a perfectly healthy database.
  assert.ok(deploy < generate, "migrate deploy must run before prisma generate");
  assert.ok(generate < next, "prisma generate must run before next build");
});

test("the same migration step can be run on its own", () => {
  assert.equal(pkg.scripts["db:deploy"], "npx prisma migrate deploy");
});

test("migrations bypass the connection pooler", () => {
  // `migrate deploy` opens a direct session for DDL; a transaction pooler
  // (Supabase's :6543 / pgbouncer) cannot carry it, so the schema must keep
  // `directUrl` and the environment must supply `DIRECT_URL`.
  assert.match(
    source("prisma/schema.prisma"),
    /directUrl\s*=\s*env\("DIRECT_URL"\)/,
  );
  assert.match(source(".env.example"), /^DIRECT_URL=/m);
});

test("the Jiji drop is re-runnable, so a build can never abort on it", () => {
  const drop = sql(
    "prisma/migrations/20261107000000_drop_jiji_integration/migration.sql",
  );
  const statements = drop.match(/ALTER TABLE "?\w+"? DROP COLUMN [^;]+;/g) ?? [];

  assert.equal(statements.length, 4, "the four Jiji columns are still dropped");

  for (const statement of statements) {
    // Several migrations in this repo were applied by hand, and `migrate
    // deploy` now runs on every build. A bare DROP COLUMN would abort with
    // 42703 ("column does not exist") against a database that already lost it.
    assert.match(statement, /DROP COLUMN IF EXISTS/);
  }
});
