// Executa as migrações e os testes pgTAP de supabase/tests/database em um
// Postgres embarcado (PGlite). Alternativa sem Docker ao `supabase test db`.
//
// Uso: node scripts/db/test-pglite.mjs [filtro]
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";
import { pgtap } from "@electric-sql/pglite-pgtap";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const filter = process.argv[2];

async function sqlFiles(dir) {
  const names = (await readdir(dir)).filter((n) => n.endsWith(".sql")).sort();
  return names.map((n) => path.join(dir, n));
}

function collectTap(results) {
  const lines = [];
  for (const result of results) {
    for (const row of result.rows ?? []) {
      for (const value of Object.values(row)) {
        if (typeof value === "string") lines.push(...value.split("\n"));
      }
    }
  }
  return lines;
}

const db = new PGlite({
  extensions: { citext, pg_trgm, pgcrypto, unaccent, pgtap },
});

await db.exec(await readFile(path.join(root, "scripts/db/supabase-shim.sql"), "utf8"));
await db.exec(`
  create extension if not exists citext with schema extensions;
  create extension if not exists pg_trgm with schema extensions;
  create extension if not exists pgcrypto with schema extensions;
  create extension if not exists unaccent with schema extensions;
  create extension if not exists pgtap with schema extensions;
  set search_path = "$user", public, extensions;
`);

for (const file of await sqlFiles(path.join(root, "supabase/migrations"))) {
  try {
    await db.exec(await readFile(file, "utf8"));
  } catch (error) {
    console.error(`✗ migração falhou: ${path.basename(file)}\n  ${error.message}`);
    process.exit(1);
  }
}
console.log("✓ migrações aplicadas");

let failed = 0;
let passed = 0;
const tests = (await sqlFiles(path.join(root, "supabase/tests/database"))).filter(
  (f) => !filter || path.basename(f).includes(filter) || path.basename(f).startsWith("000"),
);

for (const file of tests) {
  const name = path.basename(file);
  let lines;
  try {
    await db.exec('reset role; discard temp; set search_path = "$user", public, extensions;');
    lines = collectTap(await db.exec(await readFile(file, "utf8")));
  } catch (error) {
    failed++;
    console.error(`✗ ${name}: erro de execução\n  ${error.message}`);
    try {
      await db.exec("rollback");
    } catch {}
    continue;
  }
  const notOk = lines.filter((l) => l.startsWith("not ok"));
  const ok = lines.filter((l) => l.startsWith("ok"));
  const planIssue = lines.find((l) => /Looks like you (planned|failed)/.test(l));
  if (notOk.length || planIssue) {
    failed++;
    console.error(`✗ ${name}: ${ok.length} ok, ${notOk.length} falhas`);
    for (const l of lines.filter((l) => l.startsWith("not ok") || l.startsWith("#"))) {
      console.error(`    ${l}`);
    }
  } else {
    passed++;
    console.log(`✓ ${name} (${ok.length} asserções)`);
  }
}

await db.close();
console.log(`\n${passed} arquivo(s) ok, ${failed} com falha`);
process.exit(failed ? 1 : 0);
