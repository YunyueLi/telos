"use client";

// 轻量 i18n（#7）：静态导出友好，零依赖。dict 在 i18n-dict.ts；这里只管语言选择 + t()。
// 两层：① UI 文案 t(key, vars)；② LLM 输出语言 —— llmName(lang) 注入倒推/微课/诊断 prompt。
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { DICT } from "./i18n-dict";
import { bumpPrefs } from "./prefs-rev";

export type Lang = "zh-CN" | "zh-TW" | "en" | "fr" | "ja" | "ko" | "es" | "ru" | "de";

export const LANGS: { code: Lang; label: string; llm: string }[] = [
  { code: "zh-CN", label: "简体中文", llm: "简体中文" },
  { code: "zh-TW", label: "繁體中文", llm: "繁體中文" },
  { code: "en", label: "English", llm: "English" },
  { code: "fr", label: "Français", llm: "Français (French)" },
  { code: "ja", label: "日本語", llm: "日本語 (Japanese)" },
  { code: "ko", label: "한국어", llm: "한국어 (Korean)" },
  { code: "es", label: "Español", llm: "Español (Spanish)" },
  { code: "ru", label: "Русский", llm: "Русский (Russian)" },
  { code: "de", label: "Deutsch", llm: "Deutsch (German)" },
];

const LS = "telos:lang";
const DEFAULT: Lang = "zh-CN";
const SUPPORTED = new Set(LANGS.map((l) => l.code));

export function llmName(lang: Lang): string {
  return (LANGS.find((l) => l.code === lang) ?? LANGS[0]).llm;
}

function detect(): Lang {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const stored = window.localStorage.getItem(LS) as Lang | null;
    if (stored && SUPPORTED.has(stored)) return stored;
  } catch {
    /* ignore */
  }
  const nav = (typeof navigator !== "undefined" && navigator.language) || "";
  const low = nav.toLowerCase();
  if (low.startsWith("zh")) return /tw|hk|hant/.test(low) ? "zh-TW" : "zh-CN";
  const base = low.split("-")[0];
  const hit = LANGS.find((l) => l.code === base);
  return hit ? hit.code : DEFAULT;
}

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  ready: boolean;
}

const Ctx = createContext<LangCtx | null>(null);

function interpolate(s: string, vars?: Record<string, string | number>): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(DEFAULT);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLangState(detect());
    setReady(true);
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      window.localStorage.setItem(LS, l);
      document.documentElement.lang = l;
    } catch {
      /* ignore */
    }
    bumpPrefs(); // 语言=偏好：跨设备 LWW
  }, []);

  useEffect(() => {
    if (ready && typeof document !== "undefined") document.documentElement.lang = lang;
  }, [ready, lang]);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const row = DICT[key];
      if (!row) return key; // 缺键时回退到 key 本身，便于发现遗漏
      const s = row[lang] ?? row[DEFAULT] ?? key;
      return interpolate(s, vars);
    },
    [lang],
  );

  return <Ctx.Provider value={{ lang, setLang, t, ready }}>{children}</Ctx.Provider>;
}

export function useT(): LangCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useT must be used within LangProvider");
  return c;
}

// 读取当前语言（非组件场景，如 derive 调用前）。SSR/未挂载时回退默认。
export function currentLang(): Lang {
  return detect();
}

// 非组件场景的静态查表（如 derive.ts 抛错文案）。默认用当前检测到的语言。
export function tStatic(key: string, vars?: Record<string, string | number>, lang?: Lang): string {
  const row = DICT[key];
  if (!row) return key;
  const l = lang ?? detect();
  return interpolate(row[l] ?? row[DEFAULT] ?? key, vars);
}
