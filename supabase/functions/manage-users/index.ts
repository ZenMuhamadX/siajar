/**
 * Edge Function: manage-users
 * =============================================================================
 * Satu-satunya tempat yang boleh menulis app_metadata (peran + identitas guru).
 * app_metadata hanya bisa ditulis memakai service_role, sehingga browser tidak
 * mungkin memalsukan peran admin atau identitas guru.
 *
 * Memakai supabase-js resmi (npm:@supabase/supabase-js@2) supaya bentuk respons
 * GoTrue/PostgREST selalu ditangani library, bukan ditulis manual.
 * Bila edge-runtime Anda menolak specifier `npm:`, versi tanpa dependensi
 * tersedia di riwayat git:
 *   git show 1879fc4:supabase/functions/manage-users/index.ts
 *
 * Aksi (POST JSON { action, ... }):
 *   status             — publik. { hasAdmin, authDomain, adminEmail }
 *   bootstrap-admin    — publik, HANYA saat belum ada admin. { password }
 *   list-accounts      — admin. Status akun semua guru.
 *   create-teacher     — admin. { guruId, code }
 *   set-teacher-code   — admin. { guruId, code }
 *   set-teacher-active — admin. { guruId, active }
 *
 * Variabel lingkungan:
 *   SUPABASE_URL               — disuntik otomatis oleh Supabase (self-hosted:
 *                                biasanya http://kong:8000 dari dalam container)
 *   SUPABASE_SERVICE_ROLE_KEY  — disuntik otomatis oleh Supabase
 *   AUTH_DOMAIN                — opsional, default: siajar.local
 *   ADMIN_EMAIL                — opsional, default: admin@<AUTH_DOMAIN>
 *
 * PENTING (self-hosted): nilai AUTH_DOMAIN di sini HARUS sama dengan
 * VITE_AUTH_DOMAIN di frontend, karena email akun guru diturunkan dari nilai
 * ini di kedua sisi. Halaman setup menampilkan nilai yang dipakai server supaya
 * ketidakcocokan langsung terlihat.
 */

import { createClient, type User } from 'npm:@supabase/supabase-js@2';

/**
 * Deno.env.get() mengembalikan '' untuk variabel yang ADA tapi kosong — mis.
 * `AUTH_DOMAIN:` atau `ADMIN_EMAIL:` tanpa nilai di docker-compose. Operator
 * `??` tidak menangkap string kosong, sehingga email akun jadi kosong dan
 * GoTrue menolak dengan pesan membingungkan:
 *   "Cannot create a user without either an email or phone"
 * Karena itu nilai kosong diperlakukan sama seperti tidak diisi.
 */
function envOr(name: string, fallback: string): string {
  const value = Deno.env.get(name);
  return value && value.trim() ? value.trim() : fallback;
}

const SUPABASE_URL = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/+$/, '');
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const AUTH_DOMAIN = envOr('AUTH_DOMAIN', 'siajar.local').replace(/^@+/, '');
const ADMIN_EMAIL = envOr('ADMIN_EMAIL', `admin@${AUTH_DOMAIN}`).toLowerCase();

/** Format email yang wajar — dipakai untuk memberi galat yang jelas ke admin. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function assertEmail(email: string, label: string): string | null {
  if (EMAIL_RE.test(email)) return null;
  return (
    `${label} tidak valid: "${email}". Periksa AUTH_DOMAIN dan ADMIN_EMAIL pada ` +
    'environment service `functions` di docker-compose — pastikan keduanya terisi ' +
    'nilai, bukan string kosong.'
  );
}

const SCHEMA = 'agenda';
const MIN_CODE_LENGTH = 6;
const BAN_FOREVER = '876000h';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  db: { schema: SCHEMA },
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const emailForGuru = (guruId: string) => `guru-${guruId}@${AUTH_DOMAIN}`.toLowerCase();

function roleOf(user: User): string {
  const meta = (user.app_metadata ?? {}) as Record<string, unknown>;
  return typeof meta.role === 'string' ? meta.role : '';
}

function isActive(user: User): boolean {
  if (!user.banned_until) return true;
  return new Date(user.banned_until) < new Date();
}

/** Ambil seluruh user auth (dipaginasi). */
async function listAllUsers(): Promise<User[]> {
  const all: User[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Gagal membaca daftar user: ${error.message}`);
    const batch = data?.users ?? [];
    all.push(...batch);
    if (batch.length < 1000) break;
  }
  return all;
}

/** Verifikasi pemanggil adalah admin. Mengembalikan user atau null. */
async function requireAdmin(req: Request): Promise<User | null> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;
  return roleOf(data.user) === 'admin' ? data.user : null;
}

/** Nama guru diambil dari DATABASE, bukan dari yang dikirim browser. */
async function findGuru(guruId: string): Promise<{ id: string; nama_guru: string } | null> {
  const { data, error } = await admin
    .from('guru')
    .select('id, nama_guru')
    .eq('id', guruId)
    .maybeSingle();
  if (error) throw new Error(`Gagal membaca data guru: ${error.message}`);
  return data ?? null;
}

/** Kode harus string dan cukup panjang. Mengembalikan kode ter-trim atau null. */
function normalizeCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const code = value.trim();
  return code.length >= MIN_CODE_LENGTH ? code : null;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

async function handleStatus(): Promise<Response> {
  const users = await listAllUsers();
  const hasAdmin = users.some((u) => roleOf(u) === 'admin');
  // authDomain & adminEmail ikut dikirim supaya halaman setup bisa menampilkan
  // nilai yang benar-benar dipakai server — mencegah ketidakcocokan senyap
  // antara AUTH_DOMAIN (server) dan VITE_AUTH_DOMAIN (frontend).
  return json({ hasAdmin, authDomain: AUTH_DOMAIN, adminEmail: ADMIN_EMAIL });
}

async function handleBootstrapAdmin(body: Record<string, unknown>): Promise<Response> {
  const users = await listAllUsers();

  if (users.some((u) => roleOf(u) === 'admin')) {
    return json({ error: 'Admin sudah ada. Layar setup hanya berlaku sekali.' }, 409);
  }

  const code = normalizeCode(body.password);
  if (!code) {
    return json({ error: `Sandi admin minimal ${MIN_CODE_LENGTH} karakter.` }, 400);
  }

  const meta = { role: 'admin', guru_name: 'Administrator' };
  const emailError = assertEmail(ADMIN_EMAIL, 'Email admin');
  if (emailError) return json({ error: emailError }, 500);

  const existing = users.find((u) => u.email?.toLowerCase() === ADMIN_EMAIL);

  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password: code,
      email_confirm: true,
      app_metadata: meta,
      ban_duration: 'none',
    });
    if (error) return json({ error: error.message }, 400);
  } else {
    const { error } = await admin.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: code,
      email_confirm: true,
      app_metadata: meta,
    });
    if (error) return json({ error: error.message }, 400);
  }

  return json({ ok: true, email: ADMIN_EMAIL });
}

async function handleListAccounts(req: Request): Promise<Response> {
  const caller = await requireAdmin(req);
  if (!caller) return json({ error: 'Tidak berwenang.' }, 403);

  const [users, { data: guruList, error: guruErr }] = await Promise.all([
    listAllUsers(),
    admin.from('guru').select('id, nama_guru').order('nama_guru', { ascending: true }),
  ]);
  if (guruErr) return json({ error: guruErr.message }, 400);

  const byEmail = new Map<string, User>();
  for (const u of users) if (u.email) byEmail.set(u.email.toLowerCase(), u);

  const accounts = (guruList ?? []).map((g) => {
    const u = byEmail.get(emailForGuru(g.id));
    return {
      guru_id: g.id,
      nama_guru: g.nama_guru,
      has_account: Boolean(u),
      active: u ? isActive(u) : false,
      last_sign_in_at: u?.last_sign_in_at ?? null,
    };
  });

  return json({ accounts });
}

/** Dipakai bersama oleh create-teacher dan set-teacher-code. */
async function upsertTeacherAccount(
  req: Request,
  body: Record<string, unknown>,
  requireExisting: boolean
): Promise<Response> {
  const caller = await requireAdmin(req);
  if (!caller) return json({ error: 'Tidak berwenang.' }, 403);

  const guruId = typeof body.guruId === 'string' ? body.guruId : '';
  if (!guruId) return json({ error: 'guruId wajib diisi.' }, 400);

  const guru = await findGuru(guruId);
  if (!guru) return json({ error: 'Guru tidak ditemukan.' }, 404);

  const code = normalizeCode(body.code);
  if (!code) return json({ error: `Kode minimal ${MIN_CODE_LENGTH} karakter.` }, 400);

  const email = emailForGuru(guru.id);
  const meta = { role: 'guru', guru_id: guru.id, guru_name: guru.nama_guru };

  const emailError = assertEmail(email, 'Email akun guru');
  if (emailError) return json({ error: emailError }, 500);

  const users = await listAllUsers();
  const existing = users.find((u) => u.email?.toLowerCase() === email);

  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password: code,
      email_confirm: true,
      app_metadata: meta,
      ban_duration: 'none',
    });
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true, created: false, email });
  }

  if (requireExisting) {
    return json({ error: 'Akun guru ini belum dibuat.' }, 404);
  }

  const { error } = await admin.auth.admin.createUser({
    email,
    password: code,
    email_confirm: true,
    app_metadata: meta,
  });
  if (error) return json({ error: error.message }, 400);

  return json({ ok: true, created: true, email });
}

async function handleSetTeacherActive(
  req: Request,
  body: Record<string, unknown>
): Promise<Response> {
  const caller = await requireAdmin(req);
  if (!caller) return json({ error: 'Tidak berwenang.' }, 403);

  const guruId = typeof body.guruId === 'string' ? body.guruId : '';
  const active = body.active === true;
  if (!guruId) return json({ error: 'guruId wajib diisi.' }, 400);

  const email = emailForGuru(guruId);
  const users = await listAllUsers();
  const existing = users.find((u) => u.email?.toLowerCase() === email);
  if (!existing) return json({ error: 'Akun guru ini belum dibuat.' }, 404);

  const { error } = await admin.auth.admin.updateUserById(existing.id, {
    ban_duration: active ? 'none' : BAN_FOREVER,
  });
  if (error) return json({ error: error.message }, 400);

  return json({ ok: true, active });
}

// ---------------------------------------------------------------------------
// Entrypoint
// ---------------------------------------------------------------------------

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    '[manage-users] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY kosong. ' +
      'Pada instalasi self-hosted, set keduanya di environment service `functions` ' +
      'pada docker-compose (lihat DEPLOY.md).'
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Gunakan POST.' }, 405);
  }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json(
      {
        error:
          'Edge Function belum dikonfigurasi: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY kosong. ' +
          'Set keduanya di environment service `functions`.',
      },
      500
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: 'Body bukan JSON yang valid.' }, 400);
  }

  const action = typeof body.action === 'string' ? body.action : '';

  try {
    switch (action) {
      case 'status':
        return await handleStatus();
      case 'bootstrap-admin':
        return await handleBootstrapAdmin(body);
      case 'list-accounts':
        return await handleListAccounts(req);
      case 'create-teacher':
        return await upsertTeacherAccount(req, body, false);
      case 'set-teacher-code':
        return await upsertTeacherAccount(req, body, true);
      case 'set-teacher-active':
        return await handleSetTeacherActive(req, body);
      default:
        return json({ error: `Aksi tidak dikenal: "${action}".` }, 400);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Kesalahan tidak terduga.';
    console.error('[manage-users]', action, message);
    return json({ error: message }, 500);
  }
});
