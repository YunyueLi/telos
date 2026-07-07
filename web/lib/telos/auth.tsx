"use client";

// 认证单一真相源（Supabase）。挂在 layout，跨页共享会话。支持邮箱+密码 / 魔法链接 / OAuth(google,github)。
// 未配置（无 env）时 configured=false、ready=true、user=null，全站照常本地优先。
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { cloudConfigured, supabase } from "./supabase";
import { setHostedToken } from "./derive";
import { BASE } from "@/lib/base";

export type OAuthProvider = "google" | "github";
type Res = { ok: boolean; error?: string };

interface AuthValue {
  configured: boolean;
  ready: boolean;
  session: Session | null;
  user: User | null;
  signInPassword: (email: string, password: string) => Promise<Res>;
  signUpPassword: (email: string, password: string) => Promise<Res & { needsConfirm?: boolean }>;
  signInMagicLink: (email: string) => Promise<Res>;
  signInOAuth: (provider: OAuthProvider) => Promise<Res>;
  resetPassword: (email: string) => Promise<Res>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthValue | null>(null);

function redirectTo(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return `${window.location.origin}${BASE}/account/`;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const configured = cloudConfigured();
  const [ready, setReady] = useState(!configured);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const sb = supabase();
    if (!sb) {
      setReady(true);
      return;
    }
    let alive = true;
    sb.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setHostedToken(data.session?.access_token ?? null); // 托管模式身份（无 BYOK 时随请求发配置的后端）
      setReady(true);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => {
      if (!alive) return;
      setSession(s);
      setHostedToken(s?.access_token ?? null);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signInPassword = useCallback(async (email: string, password: string): Promise<Res> => {
    const sb = supabase();
    if (!sb) return { ok: false, error: "unconfigured" };
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    return error ? { ok: false, error: error.message } : { ok: true };
  }, []);

  const signUpPassword = useCallback(async (email: string, password: string) => {
    const sb = supabase();
    if (!sb) return { ok: false, error: "unconfigured" };
    const { data, error } = await sb.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: redirectTo() },
    });
    if (error) return { ok: false, error: error.message };
    // 已开启邮箱确认时 session 为空，需用户点确认邮件。
    const needsConfirm = !data.session;
    return { ok: true, needsConfirm };
  }, []);

  const signInMagicLink = useCallback(async (email: string): Promise<Res> => {
    const sb = supabase();
    if (!sb) return { ok: false, error: "unconfigured" };
    const { error } = await sb.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo() },
    });
    return error ? { ok: false, error: error.message } : { ok: true };
  }, []);

  const signInOAuth = useCallback(async (provider: OAuthProvider): Promise<Res> => {
    const sb = supabase();
    if (!sb) return { ok: false, error: "unconfigured" };
    const { error } = await sb.auth.signInWithOAuth({
      provider,
      options: { redirectTo: redirectTo() },
    });
    return error ? { ok: false, error: error.message } : { ok: true };
  }, []);

  const resetPassword = useCallback(async (email: string): Promise<Res> => {
    const sb = supabase();
    if (!sb) return { ok: false, error: "unconfigured" };
    const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirectTo() });
    return error ? { ok: false, error: error.message } : { ok: true };
  }, []);

  const signOut = useCallback(async () => {
    const sb = supabase();
    if (sb) await sb.auth.signOut();
  }, []);

  const value: AuthValue = {
    configured,
    ready,
    session,
    user: session?.user ?? null,
    signInPassword,
    signUpPassword,
    signInMagicLink,
    signInOAuth,
    resetPassword,
    signOut,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth 必须在 AuthProvider 内使用");
  return v;
}
