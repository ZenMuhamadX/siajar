/**
 * Edge Function: manage-users — versi SELF-HOSTED
 * =============================================================================
 * Ditulis TANPA dependensi apa pun (tanpa supabase-js, tanpa npm:/esm.sh).
 * Semua panggilan memakai fetch langsung ke GoTrue (/auth/v1) dan PostgREST
 * (/rest/v1). Dengan begitu fungsi ini jalan di edge-runtime versi berapa pun,
 * termasuk instalasi self-hosted yang lebih tua atau tanpa akses registry npm.
 *
 * Satu-satunya tempat yang boleh menulis app_metadata (peran + identitas guru).
 * app_metadata hanya bisa ditulis memakai service_role, sehingga browser tidak
 * mungkin memalsukan peran admin atau identitas guru.
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

const SUPABASE_URL = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/+$/, '');
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const AUTH_DOMAIN = Deno.env.get('AUTH_DOMAIN') ?? 'siajar.local';
const ADMIN_EMAIL = (Deno.env.get('ADMIN_EMAIL') ?? `admin@${AUTH_DOMAIN}`).toLowerCase();

const SCHEMA = 'agenda';
const MIN_CODE_LENGTH = 6;
const BAN_FOREVER = '876000h';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface AuthUser {
  id: string;
  email?: string | null;
  app_metadata?: Record<string, unknown> | null;
  banned_until?: string | null;
  last_sign_in_at?: string | null;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const emailForGuru = (guruId: string) => `guru-${guruId}@${AUTH_DOMAIN}`.toLowerCase();

function roleOf(user: AuthUser): string {
  const meta = (user.app_metadata ?? {}) as Record<string, unknown>;
  return typeof meta.role === 'string' ? meta.role : '';
}

/** Ambil pesan galat dari respons GoTrue/PostgREST. */
async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as Record<string, unknown>;
    const msg =
      body?.msg ?? body?.message ?? body?.error_description ?? body?.error ?? body?.hint;
    if (typeof msg === 'string') return msg;
  } catch {
    /* bukan JSON */
  }
  return `HTTP ${res.status}`;
}

// ---------------------------------------------------------------------------
// GoTrue (auth) — selalu memakai service_role
// ---------------------------------------------------------------------------

function gotrue(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${SUPABASE_URL}/auth/v1${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

async function listAllUsers(): Promise<AuthUser[]> {
  const all: AuthUser[] = [];
  for (let page = 1; ; page++) {
    const res = await gotrue(`/admin/users?page=${page}&per_page=1000`);
    if (!res.ok) throw new Error(`Gagal membaca daftar user: ${await readError(res)}`);
    const body = (await res.json()) as { users?: AuthUser[] };
    const batch = body?.users ?? [];
    all.push(...batch);
    if (batch.length < 1000) break;
  }
  return all;
}

/** Validasi token pemanggil lewat GoTrue, lalu kembalikan usernya. */
async function callerFromToken(req: Request): Promise<AuthUser | null> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as AuthUser;
}

async function requireAdmin(req: Request): Promise<AuthUser | null> {
  const user = await callerFromToken(req);
  if (!user) return null;
  return roleOf(user) === 'admin' ? user : null;
}

async function createAuthUser(
  email: string,
  password: string,
  appMetadata: Record<string, unknown>
): Promise<void> {
  const res = await gotrue('/admin/users', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      app_metadata: appMetadata,
    }),
  });
  if (!res.ok) throw new Error(await readError(res));
}

async function updateAuthUser(id: string, patch: Record<string, unknown>): Promise<void> {
  const res = await gotrue(`/admin/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(await readError(res));
}

// ---------------------------------------------------------------------------
// PostgREST — baca data guru
// ---------------------------------------------------------------------------

async function restGet(path: string): Promise<Array<Record<string, unknown>>> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Accept-Profile': SCHEMA,
    },
  });
  if (!res.ok) throw new Error(`Gagal membaca data: ${await readError(res)}`);
  return (await res.json()) as Array<Record<string, unknown>>;
}

async function findGuru(
  guruId: string
): Promise<{ id: string; nama_guru: string } | null> {
  const rows = await restGet(
    `guru?select=id,nama_guru&id=eq.${encodeURIComponent(guruId)}&limit=1`
  );
  const row = rows[0];
  if (!row) return null;
  return { id: String(row.id), nama_guru: String(row.nama_guru) };
}

async function listGuru(): Promise<Array<{ id: string; nama_guru: string }>> {
  const rows = await restGet('guru?select=id,nama_guru&order=nama_guru.asc');
  return rows.map((r) => ({ id: String(r.id), nama_guru: String(r.nama_guru) }));
}

// ---------------------------------------------------------------------------
// Utilitas
// ---------------------------------------------------------------------------

/** Kode harus string dan cukup panjang. Mengembalikan kode ter-trim atau null. */
function normalizeCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const code = value.trim();
  return code.length >= MIN_CODE_LENGTH ? code : null;
}

function isActive(user: AuthUser): boolean {
  if (!user.banned_until) return true;
  return new Date(user.banned_until) < new Date();
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
  const existing = users.find((u) => u.email?.toLowerCase() === ADMIN_EMAIL);

  if (existing) {
    await updateAuthUser(existing.id, {
      password: code,
      email_confirm: true,
      app_metadata: meta,
      ban_duration: 'none',
    });
  } else {
    await createAuthUser(ADMIN_EMAIL, code, meta);
  }

  return json({ ok: true, email: ADMIN_EMAIL });
}

async function handleListAccounts(req: Request): Promise<Response> {
  const caller = await requireAdmin(req);
  if (!caller) return json({ error: 'Tidak berwenang.' }, 403);

  const [users, guruList] = await Promise.all([listAllUsers(), listGuru()]);

  const byEmail = new Map<string, AuthUser>();
  for (const u of users) if (u.email) byEmail.set(u.email.toLowerCase(), u);

  const accounts = guruList.map((g) => {
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

  // Nama guru diambil dari DATABASE, bukan dari yang dikirim browser.
  const guru = await findGuru(guruId);
  if (!guru) return json({ error: 'Guru tidak ditemukan.' }, 404);

  const code = normalizeCode(body.code);
  if (!code) return json({ error: `Kode minimal ${MIN_CODE_LENGTH} karakter.` }, 400);

  const email = emailForGuru(guru.id);
  const meta = { role: 'guru', guru_id: guru.id, guru_name: guru.nama_guru };

  const users = await listAllUsers();
  const existing = users.find((u) => u.email?.toLowerCase() === email);

  if (existing) {
    await updateAuthUser(existing.id, {
      password: code,
      email_confirm: true,
      app_metadata: meta,
      ban_duration: 'none',
    });
    return json({ ok: true, created: false, email });
  }

  if (requireExisting) {
    return json({ error: 'Akun guru ini belum dibuat.' }, 404);
  }

  await createAuthUser(email, code, meta);
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

  await updateAuthUser(existing.id, {
    ban_duration: active ? 'none' : BAN_FOREVER,
  });

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
