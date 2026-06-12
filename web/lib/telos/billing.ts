"use client";

// Telos Pro 权益单一真相源。
// 真源 = Supabase `app_metadata.telos_pro`（只有服务端 service_role 能写——由 workers/derive.js 的
// /billing/webhook 在支付服务商回调时写入；用户改不了，区别于 user_metadata）。
// 前端：refreshEntitlement() 拉最新 → 模块缓存 + localStorage（离线/秒读）→ 广播事件；isPro() 同步读缓存。
// 本机调试：localStorage 置 telos:pro=1 可强制 Pro（仅影响本机展示，真权益仍以账号为准）。
import { supabase } from "./supabase";

export const BILLING_EVENT = "telos:billing";
const CACHE_KEY = "telos:billing";

export interface Entitlement {
  pro: boolean;
  plan: "monthly" | "yearly" | "lifetime" | null;
  until: number | null; // ms；null = 不过期（买断）或非 Pro
  templates: string[]; // 已购模板 id（webhook 写 app_metadata.telos_templates）
  uid: string | null; // 权益所属账号；登出/换号后缓存不串号
  at: number; // 上次确认时间
}

const EMPTY: Entitlement = { pro: false, plan: null, until: null, templates: [], uid: null, at: 0 };

let _ent: Entitlement | null = null;

function readCache(): Entitlement {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return EMPTY;
    const e = JSON.parse(raw) as Entitlement;
    return e && typeof e.pro === "boolean" ? e : EMPTY;
  } catch {
    return EMPTY;
  }
}

function writeCache(e: Entitlement): void {
  _ent = e;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(e));
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new Event(BILLING_EVENT));
  } catch {
    /* ignore */
  }
}

function devOverride(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem("telos:pro") === "1";
  } catch {
    return false;
  }
}

// 当前是否 Pro（同步）：缓存 + 未过期。订阅取消后服务端会把 until 写成周期末，到点本地自然回落。
export function isPro(): boolean {
  if (devOverride()) return true;
  const e = _ent ?? (_ent = readCache());
  if (!e.pro) return false;
  return e.until == null || e.until > Date.now();
}

export function entitlement(): Entitlement {
  return _ent ?? (_ent = readCache());
}

// 从 Supabase 拉最新权益（getUser() 走服务端，拿到 webhook 刚写入的 app_metadata，而不是本地旧 JWT）。
// 未登录 / 未配置云端 → 清空为非 Pro。返回最新 Entitlement。
export async function refreshEntitlement(): Promise<Entitlement> {
  const sb = supabase();
  if (!sb) {
    writeCache(EMPTY);
    return EMPTY;
  }
  try {
    const { data } = await sb.auth.getUser();
    const user = data?.user;
    if (!user) {
      writeCache(EMPTY);
      return EMPTY;
    }
    const meta = (user.app_metadata ?? {}) as {
      telos_pro?: boolean;
      telos_plan?: Entitlement["plan"];
      telos_pro_until?: number | string | null;
      telos_templates?: string[];
    };
    const untilRaw = meta.telos_pro_until;
    const until =
      untilRaw == null || untilRaw === ""
        ? null
        : typeof untilRaw === "number"
          ? untilRaw
          : Date.parse(String(untilRaw)) || null;
    const e: Entitlement = {
      pro: meta.telos_pro === true,
      plan: meta.telos_plan ?? null,
      until,
      templates: Array.isArray(meta.telos_templates) ? meta.telos_templates.map(String) : [],
      uid: user.id,
      at: Date.now(),
    };
    writeCache(e);
    return e;
  } catch {
    // 网络异常 → 保留旧缓存（离线宽限），不打断使用
    return entitlement();
  }
}

// 登出时调用：清掉本机权益缓存，避免下一个登录者串号。
export function clearEntitlement(): void {
  writeCache(EMPTY);
}
