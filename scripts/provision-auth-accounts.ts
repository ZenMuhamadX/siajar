/**
 * Provisioning akun Supabase Auth untuk SIAJAR.
 *
 * Membuat / menyegarkan:
 *   - satu akun per guru  → email sintetis "guru-<guru.id>@<domain>"
 *   - satu akun admin     → email dari ADMIN_EMAIL
 *
 * Kredensial yang dipakai:
 *   - guru  : SCHOOL_CODE (kode sekolah bersama, dipakai semua guru)
 *   - admin : ADMIN_CODE
 *
 * Peran dan identitas disimpan di app_metadata (hanya bisa ditulis lewat
 * service_role, tidak bisa dipalsukan pengguna). RLS membaca klaim ini.
 *
 * Jalankan dari root repo (butuh SERVICE ROLE key, JANGAN commit .env):
 *   bun scripts/provision-auth-accounts.ts --dry-run   # lihat rencana saja
 *   bun scripts/provision-auth-accounts.ts             # buat / segarkan akun
 *
 * Variabel .env yang dibutuhkan:
 *   VITE_SUPABASE_URL             (wajib)
 *   SUPABASE_SERVICE_ROLE_KEY     (wajib, hanya untuk skrip ini)
 *   SCHOOL_CODE                   (wajib, min 6 karakter)
 *   ADMIN_CODE                    (wajib, min 6 karakter)
 *   AUTH_DOMAIN                   (opsional, default: siajar.local)
 *   ADMIN_EMAIL                   (opsional, default: admin@<AUTH_DOMAIN>)
 *
 * Menjalankan ulang skrip ini akan MENGGANTI sandi semua akun ke nilai terbaru,
 * sehingga sekaligus berfungsi sebagai rotasi kode sekolah.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Env (pola sama dengan scripts/seed-demo-data.ts)
// ---------------------------------------------------------------------------
const ROOT = join(import.meta.dir, '..');
const envFile = join(ROOT, '.env');
const env: Record<string, string> = {};
if (existsSync(envFile)) {
  for (const line of (await Bun.file(envFile).text()).split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const i = t.indexOf('=');
    env[t.slice(0, i).trim()] = t
      .slice(i + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
  }
}
Object.assign(process.env, { ...env, ...process.env });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SCHOOL_CODE = process.env.SCHOOL_CODE!;
const ADMIN_CODE = process.env.ADMIN_CODE!;
const AUTH_DOMAIN = process.env.AUTH_DOMAIN || process.env.VITE_AUTH_DOMAIN || 'siajar.local';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.VITE_ADMIN_EMAIL || `admin@${AUTH_DOMAIN}`;

const SCHEMA = 'agenda';
const dryRun = process.argv.slice(2).includes('--dry-run');

function fail(msg: string): never {
  console.error(`\n  GAGAL: ${msg}\n`);
  process.exit(1);
}

if (!SUPABASE_URL) fail('VITE_SUPABASE_URL belum diisi di .env');
if (!SERVICE_KEY) fail('SUPABASE_SERVICE_ROLE_KEY belum diisi di .env (jangan pakai anon key)');
if (!SCHOOL_CODE) fail('SCHOOL_CODE belum diisi di .env');
if (!ADMIN_CODE) fail('ADMIN_CODE belum diisi di .env');
if (SCHOOL_CODE.length < 6) fail('SCHOOL_CODE minimal 6 karakter (batas minimum sandi Supabase)');
if (ADMIN_CODE.length < 6) fail('ADMIN_CODE minimal 6 karakter');
if (SCHOOL_CODE === ADMIN_CODE) fail('SCHOOL_CODE dan ADMIN_CODE tidak boleh sama');

const emailForGuru = (guruId: string) => `guru-${guruId}@${AUTH_DOMAIN}`;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  db: { schema: SCHEMA },
});

// ---------------------------------------------------------------------------
// Ambil seluruh user auth yang ada (dipaginasi).
// ---------------------------------------------------------------------------
async function listAllUsers() {
  const byEmail = new Map<string, string>();
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) fail(`listUsers: ${error.message}`);
    const users = data?.users ?? [];
    for (const u of users) if (u.email) byEmail.set(u.email.toLowerCase(), u.id);
    if (users.length < 1000) break;
  }
  return byEmail;
}

// ---------------------------------------------------------------------------
// Buat atau segarkan satu akun.
// ---------------------------------------------------------------------------
async function upsertAccount(
  email: string,
  password: string,
  appMetadata: Record<string, unknown>,
  existing: Map<string, string>
): Promise<'created' | 'updated'> {
  const id = existing.get(email.toLowerCase());

  if (id) {
    const { error } = await supabase.auth.admin.updateUserById(id, {
      password,
      app_metadata: appMetadata,
      email_confirm: true,
    });
    if (error) fail(`updateUserById(${email}): ${error.message}`);
    return 'updated';
  }

  const { error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: appMetadata,
  });
  if (error) fail(`createUser(${email}): ${error.message}`);
  return 'created';
}

// ---------------------------------------------------------------------------
// Alur utama
// ---------------------------------------------------------------------------
console.log(`\n  Provisioning akun SIAJAR`);
console.log(`  URL        : ${SUPABASE_URL}`);
console.log(`  Domain     : @${AUTH_DOMAIN}`);
console.log(`  Mode       : ${dryRun ? 'DRY-RUN (tidak menulis apa pun)' : 'TULIS'}\n`);

const { data: guruList, error: guruErr } = await supabase
  .from('guru')
  .select('id, nama_guru')
  .order('nama_guru', { ascending: true });

if (guruErr) fail(`baca agenda.guru: ${guruErr.message}`);
if (!guruList || guruList.length === 0) fail('tabel agenda.guru kosong — isi data guru dulu');

console.log(`  Ditemukan ${guruList.length} guru.\n`);

if (dryRun) {
  for (const g of guruList) {
    console.log(`    [guru ] ${emailForGuru(g.id).padEnd(46)} → ${g.nama_guru}`);
  }
  console.log(`    [admin] ${ADMIN_EMAIL.padEnd(46)} → Administrator`);
  console.log(`\n  Dry-run selesai. Jalankan tanpa --dry-run untuk menerapkan.\n`);
  process.exit(0);
}

const existing = await listAllUsers();

let created = 0;
let updated = 0;

for (const g of guruList) {
  const result = await upsertAccount(
    emailForGuru(g.id),
    SCHOOL_CODE,
    { role: 'guru', guru_id: g.id, guru_name: g.nama_guru },
    existing
  );
  if (result === 'created') created++;
  else updated++;
  console.log(`    [${result.padEnd(7)}] ${g.nama_guru}`);
}

const adminResult = await upsertAccount(
  ADMIN_EMAIL,
  ADMIN_CODE,
  { role: 'admin', guru_name: 'Administrator' },
  existing
);
if (adminResult === 'created') created++;
else updated++;
console.log(`    [${adminResult.padEnd(7)}] Administrator (${ADMIN_EMAIL})`);

console.log(`\n  Selesai. ${created} akun dibuat, ${updated} akun disegarkan.`);
console.log(`  Guru masuk dengan: pilih nama + kode sekolah.`);
console.log(`  Pastikan .env sudah berisi VITE_AUTH_DOMAIN=${AUTH_DOMAIN}\n`);
