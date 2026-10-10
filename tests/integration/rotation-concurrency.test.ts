import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Rodízio sob concorrência real (várias conexões simultâneas).
// Requer Postgres do Supabase local: SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
const url = process.env.SUPABASE_DB_URL;

describe.skipIf(!url)("rodízio concorrente", () => {
  const admin = new pg.Client({ connectionString: url });
  const ids = { admin: randomUUID(), sellers: [randomUUID(), randomUUID(), randomUUID()] };
  let companyId = "";

  async function as(client: pg.Client, uid: string) {
    await client.query("select set_config('role', 'authenticated', false)");
    await client.query("select set_config('request.jwt.claims', $1, false)", [
      JSON.stringify({ sub: uid, role: "authenticated" }),
    ]);
  }

  beforeAll(async () => {
    await admin.connect();
    const tag = randomUUID().slice(0, 8);
    for (const [i, id] of [ids.admin, ...ids.sellers].entries()) {
      await admin.query(
        "insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, aud, role) values ($1, $2, now(), $3, 'authenticated', 'authenticated')",
        [id, `rot-${tag}-${i}@example.test`, { full_name: `Rodízio ${i}` }],
      );
    }
    await as(admin, ids.admin);
    const { rows } = await admin.query("select company_id from public.bootstrap_company($1)", [
      `Rodizio ${tag}`,
    ]);
    companyId = rows[0].company_id;
    await admin.query("select public.update_company_settings($1, $2, $3, 'America/Sao_Paulo', true)", [
      companyId,
      `Rodizio ${tag}`,
      `rodizio-${tag}`,
    ]);
    for (const sellerId of ids.sellers) {
      await as(admin, ids.admin);
      const inv = await admin.query(
        "select token from public.create_invitation($1, (select email from public.profiles where id = $2), 'seller')",
        [companyId, sellerId],
      );
      await as(admin, sellerId);
      await admin.query("select public.accept_invitation($1)", [inv.rows[0].token]);
    }
  });

  afterAll(async () => {
    await admin.end();
  });

  it("distribui igualmente entre vendedores com 30 cadastros simultâneos", async () => {
    const clients = await Promise.all(
      Array.from({ length: 6 }, async () => {
        const c = new pg.Client({ connectionString: url });
        await c.connect();
        await as(c, ids.admin);
        return c;
      }),
    );
    try {
      await Promise.all(
        clients.flatMap((c, ci) =>
          Array.from({ length: 5 }, (_, i) =>
            c.query("select public.create_lead($1, $2, '{}', 'auto')", [
              companyId,
              { name: `Lead ${ci}-${i}`, phone_raw: "11999990000", phone_normalized: "+5511999990000" },
            ]),
          ),
        ),
      );
      const { rows } = await clients[0].query(
        "select assigned_to, count(*)::int as n from public.leads where company_id = $1 group by assigned_to",
        [companyId],
      );
      expect(rows).toHaveLength(3);
      for (const r of rows) expect(r.n).toBe(10);
    } finally {
      await Promise.all(clients.map((c) => c.end()));
    }
  });
});
