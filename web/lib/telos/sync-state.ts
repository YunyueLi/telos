"use client";

// 跨设备同步的「账号级单例状态」——连胜/打卡/墨/装扮等（区别于 projects 项目库，那个走 cloud.ts 的 projects 表）。
//
// 合并铁律（mergeState）：
//  · 学习历史 / 累计 / 解锁 = 【无损合并】（并集、取大）：两台设备各学各的，绝不互相覆盖、绝不丢。
//    —— daily.days（每天取 max）、frozen / inkGraphs / portraitSeen（并集）、ink.earned/spent / rewarded（取 max）
//  · 偏好 = last-write-wins，按 prefs-rev（最后【主动改偏好】的设备）整组胜出。
//    —— 语言 / 主题皮 / 当前形象 / 每日目标 / 当前可用冻结数
import { getDaily, applyDaily, DEFAULT_GOAL, type Daily } from "./xp";
import { getInk, setInk, getInkGraphs, setInkGraphs, type Ink } from "./ink";
import {
  getCurrentPortraitId,
  getPortraitSeen,
  setPortraitSeen,
  DEFAULT_PORTRAIT,
} from "./portraits";
import { getTheme, applyTheme, DEFAULT_THEME } from "./theme";
import { getPrefsRev, setPrefsRev } from "./prefs-rev";
import { getPassState, setPassState } from "./pass";
import { getSealsState, setSealsState, DEFAULT_SEAL, DEFAULT_TITLE } from "./seals";
import { getPlaced, setPlaced } from "./studyroom";

const LANG_KEY = "telos:lang";
const PORTRAIT_KEY = "telos:portrait";
const THEME_KEY = "telos:theme";

export interface SyncState {
  daily: Daily;
  ink: Ink;
  inkGraphs: string[];
  portrait: string;
  portraitSeen: string[];
  theme: string;
  lang: string | null;
  prefsRev: number; // 偏好最后修改时间戳（LWW 用）
  pass: { claimedFree: number[]; claimedPro: number[] }; // 治学通行证领取：并集（领过即领过）
  seals: { seal: string; title: string }; // 印章雅号佩戴：偏好 LWW
  placed: string[]; // 书斋案头摆放：偏好 LWW
}

function lsGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function lsSet(key: string, v: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, v);
  } catch {
    /* ignore */
  }
}

const num = (v: unknown, d = 0): number => (typeof v === "number" && isFinite(v) ? v : d);
const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const numArr = (v: unknown): number[] => (Array.isArray(v) ? v.filter((x): x is number => typeof x === "number") : []);

// 读本机当前状态（结构已由各模块 getter 规整）。
export function collectLocalState(): SyncState {
  return {
    daily: getDaily(),
    ink: getInk(),
    inkGraphs: getInkGraphs(),
    portrait: getCurrentPortraitId(),
    portraitSeen: getPortraitSeen(),
    theme: getTheme(),
    lang: lsGet(LANG_KEY),
    prefsRev: getPrefsRev(),
    pass: getPassState(),
    seals: getSealsState(),
    placed: getPlaced(),
  };
}

// 容错规整云端来的原始 jsonb（可能旧格式/残缺）。
export function normalizeSyncState(raw: unknown): SyncState {
  const o = (raw ?? {}) as Partial<SyncState>;
  const d = (o.daily ?? {}) as Partial<Daily>;
  const i = (o.ink ?? {}) as Partial<Ink>;
  const p = (o.pass ?? {}) as Partial<SyncState["pass"]>;
  const sl = (o.seals ?? {}) as Partial<SyncState["seals"]>;
  return {
    daily: {
      days: d.days && typeof d.days === "object" ? { ...d.days } : {},
      goal: num(d.goal, DEFAULT_GOAL) || DEFAULT_GOAL,
      freezes: num(d.freezes),
      frozen: strArr(d.frozen),
      rewarded: num(d.rewarded),
      spent: num(d.spent),
    },
    ink: { earned: num(i.earned), spent: num(i.spent), balance: num(i.balance) },
    inkGraphs: strArr(o.inkGraphs),
    portrait: typeof o.portrait === "string" ? o.portrait : DEFAULT_PORTRAIT,
    portraitSeen: strArr(o.portraitSeen),
    theme: typeof o.theme === "string" ? o.theme : DEFAULT_THEME,
    lang: typeof o.lang === "string" ? o.lang : null,
    prefsRev: num(o.prefsRev),
    pass: { claimedFree: numArr(p.claimedFree), claimedPro: numArr(p.claimedPro) },
    seals: {
      seal: typeof sl.seal === "string" ? sl.seal : DEFAULT_SEAL,
      title: typeof sl.title === "string" ? sl.title : DEFAULT_TITLE,
    },
    placed: strArr(o.placed),
  };
}

// 合并：学习数据无损（并集/取大），偏好 LWW（prefs-rev 大者整组胜出）。
export function mergeState(local: SyncState, remote: SyncState): SyncState {
  const prefWin = remote.prefsRev > local.prefsRev ? remote : local;

  const days: Record<string, number> = { ...remote.daily.days };
  for (const [k, v] of Object.entries(local.daily.days)) days[k] = Math.max(days[k] ?? 0, num(v));

  const earned = Math.max(local.ink.earned, remote.ink.earned);
  const spent = Math.max(local.ink.spent, remote.ink.spent);

  return {
    daily: {
      days,
      frozen: [...new Set([...remote.daily.frozen, ...local.daily.frozen])],
      rewarded: Math.max(local.daily.rewarded, remote.daily.rewarded),
      spent: Math.max(local.daily.spent, remote.daily.spent),
      goal: prefWin.daily.goal, // 偏好
      freezes: prefWin.daily.freezes, // 偏好（余额型）
    },
    ink: { earned, spent, balance: Math.max(0, earned - spent) },
    inkGraphs: [...new Set([...remote.inkGraphs, ...local.inkGraphs])],
    portraitSeen: [...new Set([...remote.portraitSeen, ...local.portraitSeen])],
    portrait: prefWin.portrait, // 偏好
    theme: prefWin.theme, // 偏好
    lang: prefWin.lang ?? local.lang ?? remote.lang, // 偏好
    prefsRev: Math.max(local.prefsRev, remote.prefsRev),
    pass: {
      claimedFree: [...new Set([...remote.pass.claimedFree, ...local.pass.claimedFree])],
      claimedPro: [...new Set([...remote.pass.claimedPro, ...local.pass.claimedPro])],
    },
    seals: prefWin.seals, // 偏好（整组 LWW）
    placed: prefWin.placed, // 偏好
  };
}

// 把合并结果写回本机各 key。偏好直接落 key（不走会 bumpPrefs 的 setter，避免污染 prefs-rev）。
export function applyLocalState(s: SyncState): void {
  applyDaily(s.daily);
  setInk(s.ink);
  setInkGraphs(s.inkGraphs);
  setPortraitSeen(s.portraitSeen);
  lsSet(PORTRAIT_KEY, s.portrait);
  lsSet(THEME_KEY, s.theme);
  if (s.lang) lsSet(LANG_KEY, s.lang);
  applyTheme(s.theme); // 切 <html data-theme>（纯 DOM，不写 storage、不 bump）
  setPassState(s.pass);
  setSealsState(s.seals);
  setPlaced(s.placed);
  setPrefsRev(s.prefsRev);
}
