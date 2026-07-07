"use client";

// Telos Pro 权益单一真相源。
// Hosted Telos 的真源是账号 metadata；Community Edition 只读取已配置后端返回的状态。
// 前端：refreshEntitlement() 拉最新 → 模块缓存 + localStorage（离线/秒读）→ 广播事件；isPro() 同步读缓存。
// 本机调试：localStorage 置 telos:pro=1 可强制 Pro（仅影响本机展示，真权益仍以账号为准）。
import { supabase } from "./supabase";
import { getDeriveUrl } from "./derive";
import { tStatic } from "./i18n";
import type { BillingSku } from "./billing-config";

export const BILLING_EVENT = "telos:billing";
const CACHE_KEY = "telos:billing";

export interface Entitlement {
  pro: boolean;
  plan: "monthly" | "yearly" | "lifetime" | null;
  until: number | null; // ms；null = 不过期（买断）或非 Pro
  templates: string[]; // 已拥有模板 id
  customerId: string | null; // hosted billing customer id，用于自助管理订阅入口
  uid: string | null; // 权益所属账号；登出/换号后缓存不串号
  at: number; // 上次确认时间
}

const EMPTY: Entitlement = { pro: false, plan: null, until: null, templates: [], customerId: null, uid: null, at: 0 };

let _ent: Entitlement | null = null;

function readCache(): Entitlement {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return EMPTY;
    const e = JSON.parse(raw) as Entitlement;
    return e && typeof e.pro === "boolean" ? { ...EMPTY, ...e, templates: Array.isArray(e.templates) ? e.templates : [] } : EMPTY;
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

// 从账号服务拉最新权益（getUser() 走服务端，避免只读到本地旧 JWT）。
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
      telos_billing_customer_id?: string;
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
      customerId: meta.telos_billing_customer_id ? String(meta.telos_billing_customer_id) : null,
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

function billingApiBase(): string {
  const url = getDeriveUrl();
  return url ? url.replace(/\/(derive|lesson|probe|title)\/?$/, "") : "";
}

function checkoutErrorMessage(code: unknown): string | null {
  switch (String(code || "")) {
    case "NEED_LOGIN":
      return tStatic("err.needLogin");
    case "CHECKOUT_NOT_CONFIGURED":
    case "PRODUCT_NOT_CONFIGURED":
      return tStatic("err.checkoutUnavailable");
    case "CHECKOUT_FAILED":
      return tStatic("err.checkoutFailed");
    default:
      return null;
  }
}

function portalErrorMessage(code: unknown): string | null {
  switch (String(code || "")) {
    case "NEED_LOGIN":
      return tStatic("err.needLogin");
    case "PORTAL_NOT_CONFIGURED":
      return tStatic("err.portalUnavailable");
    case "NO_BILLING_CUSTOMER":
      return tStatic("err.portalNoCustomer");
    case "PORTAL_FAILED":
      return tStatic("err.portalFailed");
    default:
      return null;
  }
}

// 创建 hosted checkout 会话。Community Edition 默认没有 checkout 映射。
export async function startCheckout(sku: BillingSku | string): Promise<string> {
  const base = billingApiBase();
  if (!base) throw new Error(tStatic("err.checkoutUnavailable"));
  const sb = supabase();
  if (!sb) throw new Error(tStatic("err.needLogin"));
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error(tStatic("err.needLogin"));
  let res: Response;
  try {
    res = await fetch(`${base}/billing/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ plan: sku }),
    });
  } catch {
    throw new Error(tStatic("err.checkoutFailed"));
  }
  const dataJson = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const url = String(dataJson.url || "").trim();
  if (!res.ok || !url) throw new Error(checkoutErrorMessage(dataJson.error) || tStatic("err.checkoutFailed"));
  return url;
}

// 创建 hosted billing 自助管理入口（取消订阅、更新支付方式、查看订单）。
export async function startBillingPortal(): Promise<string> {
  const base = billingApiBase();
  if (!base) throw new Error(tStatic("err.portalUnavailable"));
  const sb = supabase();
  if (!sb) throw new Error(tStatic("err.needLogin"));
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error(tStatic("err.needLogin"));
  let res: Response;
  try {
    res = await fetch(`${base}/billing/portal`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: "{}",
    });
  } catch {
    throw new Error(tStatic("err.portalFailed"));
  }
  const dataJson = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const url = String(dataJson.url || "").trim();
  if (!res.ok || !url) throw new Error(portalErrorMessage(dataJson.error) || tStatic("err.portalFailed"));
  return url;
}
