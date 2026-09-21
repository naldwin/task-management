// Validates supabase/migrations/0001_init.sql against a real (WASM) PostgreSQL
// and smoke-tests the permission-checked RPCs end to end, including
// generate_monthly_report (the temp-table fix for "relation flagged does not exist").
// Run: node scripts/verify-sql.mjs
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sql = readFileSync(join(root, 'supabase', 'migrations', '0001_init.sql'), 'utf8');

const db = new PGlite();
const q = (s) => db.query(s);
const fail = (msg, e) => {
  console.error(`FAIL: ${msg}`);
  console.error(String(e?.message ?? e).split('\n').slice(0, 8).join('\n'));
  process.exit(1);
};

// --- stub the auth schema that Supabase provides in production ---
await db.exec(`create schema if not exists auth;
  create table auth.users(id uuid primary key, email text);
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create or replace function auth.uid() returns uuid language sql stable as $$ select '11111111-1111-1111-1111-111111111111'::uuid $$;`);

// PGlite has gen_random_uuid() built in; skip extension lines that may not exist here.
const runnable = sql
  .split('\n')
  .filter((l) => !/^\s*create extension/i.test(l))
  .join('\n');

try {
  await db.exec(runnable);
  console.log('ok: migration applies cleanly');
} catch (e) {
  fail('migration failed to apply', e);
}

// --- seed one user + space via the RPCs (exercises create_space atomic defaults) ---
await db.exec(`insert into auth.users(id, email) values ('11111111-1111-1111-1111-111111111111', 'worklogger@example.com');
  insert into public.profiles(id, display_name, email) values ('11111111-1111-1111-1111-111111111111', 'worklogger', 'worklogger@example.com');`);

let spaceId;
try {
  const r = await q(`select public.create_space('Dev', 'DEV', 'test space', 'UTC') as id`);
  spaceId = r.rows[0].id;
  console.log('ok: create_space ->', spaceId);
} catch (e) {
  fail('create_space failed', e);
}

// --- create + update tasks (exercises create_task numbering + update_task logging) ---
let taskId;
try {
  const r = await q(`select public.create_task('${spaceId}', 'First task', 'do things', null, 'High', null, '2026-09-15', 'feature/x', 'https://example.com/pr/1') as id`);
  taskId = r.rows[0].id;
  const t = await q(`select key, number from public.tasks where id = '${taskId}'`);
  console.log('ok: create_task ->', t.rows[0]);
  const doneId = (await q(`select id from public.statuses where space_id='${spaceId}' and category='Done' and is_retired=false limit 1`)).rows[0].id;
  await q(`select public.update_task('${taskId}', null, null, '${doneId}');`);
  const c = await q(`select completed_at is not null as done from public.tasks where id='${taskId}'`);
  console.log('ok: update_task to Done, completed:', c.rows[0].done);
  const todoId = (await q(`select id from public.statuses where space_id='${spaceId}' and is_default=true limit 1`)).rows[0].id;
  await q(`select public.update_task('${taskId}', null, null, '${todoId}');`);
  const r2 = await q(`select completed_at is null as cleared from public.tasks where id='${taskId}'`);
  console.log('ok: reopen clears completion:', r2.rows[0].cleared);
  // NOTE: update_task signature uses positional-or-named with defaults; verify positional call above worked.
} catch (e) {
  fail('task RPCs failed', e);
}

// --- the reported bug: generate the 2026-09 report ---
try {
  const r = await q(`select public.generate_monthly_report('${spaceId}', date '2026-09-01') as id`);
  const rep = await q(`select month_start, is_final, counts, summary from public.monthly_reports where id='${r.rows[0].id}'`);
  console.log('ok: generate_monthly_report ->', JSON.stringify(rep.rows[0]));
  const snap = await q(`select jsonb_array_length(tasks_snapshot) as n from public.monthly_reports where id='${r.rows[0].id}'`);
  console.log('ok: tasks in snapshot:', snap.rows[0].n);
  // idempotency: second run must not duplicate
  await q(`select public.generate_monthly_report('${spaceId}', date '2026-09-01')`);
  const cnt = await q(`select count(*)::int as c from public.monthly_reports where space_id='${spaceId}'`);
  if (cnt.rows[0].c !== 1) throw new Error('duplicate report created');
  console.log('ok: generation is idempotent');
} catch (e) {
  fail('generate_monthly_report failed', e);
}

console.log('ALL SQL CHECKS PASSED');
await db.close();
