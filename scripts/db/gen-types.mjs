// Gera src/types/database.ts no formato do `supabase gen types typescript`,
// introspectando o schema public após aplicar as migrações no PGlite.
// Quando houver Supabase local (Docker), `npm run db:types:supabase` é equivalente.
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const db = new PGlite({ extensions: { citext, pg_trgm, pgcrypto, unaccent } });

await db.exec(await readFile(path.join(root, "scripts/db/supabase-shim.sql"), "utf8"));
const migrationsDir = path.join(root, "supabase/migrations");
for (const name of (await readdir(migrationsDir)).filter((n) => n.endsWith(".sql")).sort()) {
  await db.exec(await readFile(path.join(migrationsDir, name), "utf8"));
}

const enums = (
  await db.query(`
    select t.typname as name, array_agg(e.enumlabel order by e.enumsortorder) as labels
    from pg_type t join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' group by t.typname order by t.typname`)
).rows;
const enumNames = new Set(enums.map((e) => e.name));

function tsType(udt, isArray = false) {
  const base = udt.replace(/^_/, "");
  let t;
  if (enumNames.has(base)) t = `Database["public"]["Enums"]["${base}"]`;
  else if (["int2", "int4", "int8", "float4", "float8", "numeric"].includes(base)) t = "number";
  else if (base === "bool") t = "boolean";
  else if (["json", "jsonb"].includes(base)) t = "Json";
  else t = "string";
  return isArray || udt.startsWith("_") ? `${t}[]` : t;
}

const columns = (
  await db.query(`
    select c.table_name, c.column_name, c.udt_name, c.is_nullable = 'YES' as nullable,
           c.column_default is not null as has_default,
           c.is_identity = 'YES' as is_identity, c.identity_generation,
           c.is_generated = 'ALWAYS' as is_generated
    from information_schema.columns c
    join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public' and t.table_type = 'BASE TABLE'
    order by c.table_name, c.column_name`)
).rows;

const fks = (
  await db.query(`
    select con.conname, src.relname as table_name, dst.relname as referenced,
           array(select a.attname from unnest(con.conkey) with ordinality k(attnum, ord)
                 join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.attnum order by k.ord) as cols,
           array(select a.attname from unnest(con.confkey) with ordinality k(attnum, ord)
                 join pg_attribute a on a.attrelid = con.confrelid and a.attnum = k.attnum order by k.ord) as refcols
    from pg_constraint con
    join pg_class src on src.oid = con.conrelid
    join pg_class dst on dst.oid = con.confrelid
    join pg_namespace n on n.oid = src.relnamespace
    join pg_namespace dn on dn.oid = dst.relnamespace
    where con.contype = 'f' and n.nspname = 'public' and dn.nspname = 'public'
    order by con.conname`)
).rows;

const uniques = (
  await db.query(`
    select src.relname as table_name,
           array(select a.attname from unnest(con.conkey) k(attnum)
                 join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.attnum order by a.attname) as cols
    from pg_constraint con join pg_class src on src.oid = con.conrelid
    join pg_namespace n on n.oid = src.relnamespace
    where con.contype in ('u', 'p') and n.nspname = 'public'`)
).rows;

const functions = (
  await db.query(`
    select p.proname as name,
           coalesce(p.proargnames, '{}') as argnames,
           coalesce(p.proargmodes::text[], '{}') as argmodes,
                      array(select tt.typname from unnest(coalesce(p.proallargtypes, p.proargtypes::oid[])) with ordinality u(t, ord) join pg_type tt on tt.oid = u.t order by u.ord) as argudts,
           p.pronargdefaults as ndefaults, p.pronargs as nargs,
           p.proretset as retset, rt.typname as rettype
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    join pg_type rt on rt.oid = p.prorettype
    where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'EXECUTE')
    order by p.proname`)
).rows;

const byTable = new Map();
for (const c of columns) {
  if (!byTable.has(c.table_name)) byTable.set(c.table_name, []);
  byTable.get(c.table_name).push(c);
}

const ind = (n) => "  ".repeat(n);
let out = `// Arquivo gerado por scripts/db/gen-types.mjs — não editar manualmente.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
`;

for (const [table, cols] of byTable) {
  out += `${ind(3)}${table}: {\n`;
  out += `${ind(4)}Row: {\n`;
  for (const c of cols)
    out += `${ind(5)}${c.column_name}: ${tsType(c.udt_name)}${c.nullable ? " | null" : ""};\n`;
  out += `${ind(4)}};\n${ind(4)}Insert: {\n`;
  for (const c of cols) {
    if (c.is_generated || c.identity_generation === "ALWAYS") {
      out += `${ind(5)}${c.column_name}?: never;\n`;
      continue;
    }
    const optional = c.nullable || c.has_default || c.is_identity;
    out += `${ind(5)}${c.column_name}${optional ? "?" : ""}: ${tsType(c.udt_name)}${c.nullable ? " | null" : ""};\n`;
  }
  out += `${ind(4)}};\n${ind(4)}Update: {\n`;
  for (const c of cols) {
    if (c.is_generated || c.identity_generation === "ALWAYS") {
      out += `${ind(5)}${c.column_name}?: never;\n`;
      continue;
    }
    out += `${ind(5)}${c.column_name}?: ${tsType(c.udt_name)}${c.nullable ? " | null" : ""};\n`;
  }
  out += `${ind(4)}};\n${ind(4)}Relationships: [\n`;
  for (const fk of fks.filter((f) => f.table_name === table)) {
    const sortedCols = [...fk.cols].sort().join(",");
    const oneToOne = uniques.some(
      (u) => u.table_name === table && [...u.cols].sort().join(",") === sortedCols,
    );
    out += `${ind(5)}{\n${ind(6)}foreignKeyName: "${fk.conname}";\n${ind(6)}columns: [${fk.cols.map((c) => `"${c}"`).join(", ")}];\n`;
    out += `${ind(6)}isOneToOne: ${oneToOne};\n${ind(6)}referencedRelation: "${fk.referenced}";\n`;
    out += `${ind(6)}referencedColumns: [${fk.refcols.map((c) => `"${c}"`).join(", ")}];\n${ind(5)}},\n`;
  }
  out += `${ind(4)}];\n${ind(3)}};\n`;
}

out += `${ind(2)}};\n${ind(2)}Views: {\n${ind(3)}[_ in never]: never;\n${ind(2)}};\n${ind(2)}Functions: {\n`;

for (const fn of functions) {
  const modes = fn.argmodes.length ? fn.argmodes : fn.argnames.map(() => "i");
  const inArgs = [];
  const outCols = [];
  fn.argnames.forEach((name, i) => {
    const mode = modes[i] ?? "i";
    if (mode === "i" || mode === "b") inArgs.push({ name, udt: fn.argudts[i] });
    if (mode === "o" || mode === "t" || mode === "b") outCols.push({ name, udt: fn.argudts[i] });
  });
  const firstDefault = inArgs.length - fn.ndefaults;
  out += `${ind(3)}${fn.name}: {\n${ind(4)}Args: `;
  if (!inArgs.length) out += `never;\n`;
  else {
    out += `{\n`;
    inArgs.forEach((a, i) => {
      out += `${ind(5)}${a.name}${i >= firstDefault ? "?" : ""}: ${tsType(a.udt)} | null;\n`;
    });
    out += `${ind(4)}};\n`;
  }
  let ret;
  if (outCols.length) {
    ret = `{\n${outCols.map((c) => `${ind(5)}${c.name}: ${tsType(c.udt)};`).join("\n")}\n${ind(4)}}[]`;
  } else if (fn.rettype === "void") ret = "undefined";
  else ret = tsType(fn.rettype) + (fn.retset ? "[]" : "");
  out += `${ind(4)}Returns: ${ret};\n${ind(3)}};\n`;
}

out += `${ind(2)}};\n${ind(2)}Enums: {\n`;
for (const e of enums) out += `${ind(3)}${e.name}: ${e.labels.map((l) => `"${l}"`).join(" | ")};\n`;
out += `${ind(2)}};\n${ind(2)}CompositeTypes: {\n${ind(3)}[_ in never]: never;\n${ind(2)}};\n${ind(1)}};\n};

type PublicSchema = Database["public"];
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];
`;

await writeFile(path.join(root, "src/types/database.ts"), out);
await db.close();
console.log("✓ src/types/database.ts gerado");
