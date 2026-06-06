// Optional cloud sync via Supabase (REST + Auth), using plain fetch — no SDK dependency.
// Activates only when NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY are set.
// Until then everything runs local-first. See SUPABASE.md to enable.

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

const TOKEN_KEY = "telos:cloud:token";

export function cloudConfigured(): boolean {
  return Boolean(SB_URL && SB_KEY);
}

export function cloudToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setCloudToken(token: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

// Supabase magic-link redirects back with the token in the URL hash; capture it.
export function captureTokenFromHash(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hash;
  if (h && h.includes("access_token=")) {
    const params = new URLSearchParams(h.slice(1));
    const t = params.get("access_token");
    if (t) {
      setCloudToken(t);
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      return true;
    }
  }
  return false;
}

export async function cloudSendMagicLink(email: string): Promise<{ ok: boolean; error?: string }> {
  if (!cloudConfigured()) return { ok: false, error: "云同步未配置" };
  try {
    const r = await fetch(`${SB_URL}/auth/v1/otp`, {
      method: "POST",
      headers: { apikey: SB_KEY, "content-type": "application/json" },
      body: JSON.stringify({ email, create_user: true }),
    });
    return r.ok ? { ok: true } : { ok: false, error: `HTTP ${r.status}` };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function cloudPush(profileId: string, state: unknown): Promise<{ ok: boolean; error?: string }> {
  const token = cloudToken();
  if (!cloudConfigured() || !token) return { ok: false, error: "未登录云端" };
  try {
    const r = await fetch(`${SB_URL}/rest/v1/learner_states?on_conflict=profile_id`, {
      method: "POST",
      headers: {
        apikey: SB_KEY,
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({ profile_id: profileId, state }),
    });
    return r.ok ? { ok: true } : { ok: false, error: `HTTP ${r.status}` };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function cloudPull(
  profileId: string,
): Promise<{ ok: boolean; state?: unknown; error?: string }> {
  const token = cloudToken();
  if (!cloudConfigured() || !token) return { ok: false, error: "未登录云端" };
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/learner_states?profile_id=eq.${encodeURIComponent(profileId)}&select=state`,
      { headers: { apikey: SB_KEY, authorization: `Bearer ${token}` } },
    );
    if (!r.ok) return { ok: false, error: `HTTP ${r.status}` };
    const rows = (await r.json()) as { state: unknown }[];
    return { ok: true, state: rows?.[0]?.state ?? null };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
