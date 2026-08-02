import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

/**
 * Supabase 匿名云同步客户端（迭代计划书 M5）：
 * - 未配置 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 时整体禁用，站点行为与纯本地一致；
 * - 匿名优先：首次访问静默 signInAnonymously，无账号体系、开箱即用；
 * - 会话持久化在 localStorage 键 anime-calendar.session.v1（清空站点数据 = 新匿名身份）。
 */
const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export function isSupabaseEnabled(): boolean {
  return Boolean(URL && ANON_KEY);
}

let client: SupabaseClient | null = null;

export function getClient(): SupabaseClient | null {
  if (!isSupabaseEnabled()) return null;
  if (!client) {
    client = createClient(URL!, ANON_KEY!, {
      auth: {
        storageKey: "anime-calendar.session.v1",
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
  }
  return client;
}

export async function ensureSession(): Promise<{ user: User | null; error?: string }> {
  const c = getClient();
  if (!c) return { user: null };
  try {
    const { data } = await c.auth.getSession();
    if (data.session?.user) return { user: data.session.user };
    const res = await c.auth.signInAnonymously();
    if (res.error) return { user: null, error: res.error.message };
    return { user: res.data.user };
  } catch (e) {
    return { user: null, error: e instanceof Error ? e.message : String(e) };
  }
}

/** 可选：把匿名身份升级为邮箱身份（发送确认邮件，确认后即跨设备） */
export async function bindEmail(email: string): Promise<{ ok: boolean; message: string }> {
  const c = getClient();
  if (!c) return { ok: false, message: "云同步未配置" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, message: "邮箱格式不正确" };
  try {
    const { error } = await c.auth.updateUser({ email });
    if (error) return { ok: false, message: error.message };
    return { ok: true, message: "确认邮件已发送，请查收并点击确认" };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}
