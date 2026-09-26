/**
 * Edge Function: manage-users
 * =============================================================================
 * Satu-satunya tempat yang boleh menulis app_metadata (peran + identitas guru).
 * app_metadata hanya bisa ditulis memakai service_role, sehingga browser tidak
 * mungkin memalsukan peran admin atau identitas guru.
 *
 * Kunci service_role TIDAK perlu diset manual: Supabase menyuntikkan
 * SUPABASE_SERVICE_ROLE_KEY ke setiap Edge Function secara otomatis.
 *
 * Aksi (POST JSON { action, ... }):
 *   status             — publik. { hasAdmin } untuk memutuskan layar setup.
 *   bootstrap-admin    — publik, HANYA saat belum ada admin. { password }
 *   list-accounts      — admin. Status akun semua guru.
 *   create-teacher     — admin. { guruId, code } buat akun + kode.
 *   set-teacher-code   — admin. { guruId, code } ganti kode guru.
 *   set-teacher-active — admin. { guruId, active } aktif/nonaktifkan akun.
 *
 * Variabel lingkungan opsional (Functions → Secrets):
 *   AUTH_DOMAIN  domain email sintetis akun guru (default: siajar.local)
 *   ADMIN_EMAIL  email akun admin (default: admin@<AUTH_DOMAIN>)
 *
 * PENTING: AUTH_DOMAIN di sini harus SAMA dengan VITE_AUTH_DOMAIN di frontend,
 * karena email akun guru diturunkan dari nilai ini di kedua sisi.
 */

import { createClient, type User } from 'npm:@supabase/supabase-js@2';

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

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: SCHEMA },
  }
);

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

/** Ambil seluruh user auth (dipaginasi). */
async function listAllUsers(): Promise<User[]> {
  const all: User[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`listUsers: ${error.message}`);
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
  if (error) throw new Error(`baca guru: ${error.message}`);
  return data ?? null;
}

/** Kode harus string dan cukup panjang. Mengembalikan kode ter-trim atau null. */
function normalizeCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const code = value.trim();
  return code.length >= MIN_CODE_LENGTH ? code : null;
}

async function hasAnyAdmin(users: User[]): Promise<boolean> {
  return users.some((u) => roleOf(u) === 'admin');
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

async function handleStatus(): Promise<Response> {
  const users = await listAllUsers();
  return json({ hasAdmin: await hasAnyAdmin(users) });
}

async function handleBootstrapAdmin(body: Record<string, unknown>): Promise<Response> {
  const users = await listAllUsers();

  if (await hasAnyAdmin(users)) {
    return json(
      { error: 'Admin sudah ada. Layar setup hanya berlaku sekali.' },
      409
    );
  }

  const code = normalizeCode(body.password);
  if (!code) {
    return json({ error: `Sandi admin minimal ${MIN_CODE_LENGTH} karakter.` }, 400);
  }

  const meta = { role: 'admin', guru_name: 'Administrator' };
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
      active: u ? !u.banned_until || new Date(u.banned_until) < new Date() : false,
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Gunakan POST.' }, 405);
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
