"use client";

// Supabase 客户端单例。仅当注入了 NEXT_PUBLIC_SUPABASE_URL + ANON_KEY 时才创建；
// 否则一切本地优先（cloudConfigured()===false）。静态导出 / SPA：用 PKCE + detectSessionInUrl，
// 登录回跳到 /account/ 时 SDK 自动用 ?code= 换取会话；会话持久化在 localStorage 并自动续期。
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function cloudConfigured(): boolean {
  return Boolean(URL && ANON);
}

let _client: SupabaseClient | null = null;

export function supabase(): SupabaseClient | null {
  if (!cloudConfigured() || typeof window === "undefined") return null;
  if (_client) return _client;
  _client = createClient(URL, ANON, {
    auth: {
      flowType: "pkce",
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
      storageKey: "telos-auth",
    },
  });
  return _client;
}
