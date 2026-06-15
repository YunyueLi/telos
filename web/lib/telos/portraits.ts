"use client";

// 看板娘形象集（关系型激励的主体）。设计红线：
// - 形象是【纯外观】，绝不提供任何学习侧优势（cosmetic-only，护"学习诚信"）。
// - 解锁绑【真实学习里程碑】（连胜/等级/掌握量/完成图谱…），是"她为你的坚持换上的新样子"——
//   关系叙事的产物，不是发给你的奖品。付费仅限 theme 系列（纯审美变体），永不碰能力。
// - 看板娘叙事只走【陪伴 / 欣慰 / 见证】，显式禁用 Duolingo 式"失望/愧疚"催促（老师人设尤其经不起）。
//
// ★ 可无限扩展：以后生成新立绘，只要把 PNG 丢进 public/portraits/ + 在 PORTRAITS 加一条，
//   解锁判定、集章册、当前形象切换全自动接住，零改逻辑。
import { useEffect, useState } from "react";
import { asset } from "@/lib/base";
import { getStreak, maxStreak, totalXp, levelInfo } from "./xp";
import type { Project } from "./project";
import { bumpPrefs } from "./prefs-rev";
import { getTheme, THEMES } from "./theme";

export type PortraitSeries = "daily" | "season" | "scene" | "milestone" | "theme";

// 解锁条件（数据驱动）。新增一种规则才需要动 isUnlocked / unlockHint。
export type UnlockRule =
  | { kind: "always" } // 初始即有
  | { kind: "streak"; n: number } // 当前连胜 ≥ n
  | { kind: "maxStreak"; n: number } // 历史最长连胜 ≥ n
  | { kind: "level"; n: number } // 等级 ≥ n
  | { kind: "xp"; n: number } // 累计 XP ≥ n
  | { kind: "projects"; n: number } // 学习项目数 ≥ n
  | { kind: "mastered"; n: number } // 累计掌握能力点 ≥ n
  | { kind: "graphs"; n: number } // 完成的图谱数（整张学完）≥ n
  | { kind: "diagnosed" } // 完成过一次起点诊断
  | { kind: "season"; months: number[] } // 当前自然月 ∈ months（1..12）
  | { kind: "paid" }; // 主题皮：Pro 或单买

export interface Portrait {
  id: string; // 稳定 id（= 立绘文件名，无扩展名）
  series: PortraitSeries;
  file: string; // public/portraits/<file>.png
  nameKey: string; // i18n：形象名
  unlock: UnlockRule;
  voiceKey?: string; // i18n：解锁时看板娘的一句话（陪伴/欣慰/见证）
  paid?: boolean; // theme 系列：cosmetic 付费（永不影响学习）
}

// 解锁判定的输入：把分散在 xp.ts / use-project 的真实学习信号聚合成一个快照。
export interface LearnerStats {
  streak: number;
  maxStreak: number;
  level: number;
  totalXp: number;
  projects: number;
  mastered: number; // 跨项目累计掌握能力点
  graphs: number; // 完成的图谱数（mastered === total 的项目数）
  diagnosed: boolean;
  isPro: boolean;
  month: number; // 1..12，当前自然月（季节系列用）
}

// 系列元信息（标题/副标题/排序）。系列先全定义好，PORTRAITS 里有哪个系列的条目就渲染哪个分组——
// 未来某系列第一张立绘入库，集章册自动多出一组。
export const SERIES: { key: PortraitSeries; nameKey: string; subKey: string }[] = [
  { key: "daily", nameKey: "pt.s.daily", subKey: "pt.s.daily.sub" },
  { key: "milestone", nameKey: "pt.s.milestone", subKey: "pt.s.milestone.sub" },
  { key: "scene", nameKey: "pt.s.scene", subKey: "pt.s.scene.sub" },
  { key: "season", nameKey: "pt.s.season", subKey: "pt.s.season.sub" },
  { key: "theme", nameKey: "pt.s.theme", subKey: "pt.s.theme.sub" },
];

// ── 形象注册表 ──────────────────────────────────────────────────────────
// 当前仅 daily 系列（12 张已入库立绘）。其余系列待立绘生成后逐条追加，无需改任何逻辑。
export const PORTRAITS: Portrait[] = [
  // 日常神态（随基础学习里程碑解锁，从"上车"到"见证成长"）
  { id: "present", series: "daily", file: "present", nameKey: "pt.present", unlock: { kind: "always" }, voiceKey: "pt.v.present" },
  { id: "teach", series: "daily", file: "teach", nameKey: "pt.teach", unlock: { kind: "always" }, voiceKey: "pt.v.teach" },
  { id: "think", series: "daily", file: "think", nameKey: "pt.think", unlock: { kind: "diagnosed" }, voiceKey: "pt.v.think" },
  { id: "welcome", series: "daily", file: "welcome", nameKey: "pt.welcome", unlock: { kind: "projects", n: 1 }, voiceKey: "pt.v.welcome" },
  { id: "notify", series: "daily", file: "notify", nameKey: "pt.notify", unlock: { kind: "streak", n: 3 }, voiceKey: "pt.v.notify" },
  { id: "reading", series: "daily", file: "reading", nameKey: "pt.reading", unlock: { kind: "mastered", n: 10 }, voiceKey: "pt.v.reading" },
  { id: "cheer", series: "daily", file: "cheer", nameKey: "pt.cheer", unlock: { kind: "streak", n: 7 }, voiceKey: "pt.v.cheer" },
  { id: "point", series: "daily", file: "point", nameKey: "pt.point", unlock: { kind: "mastered", n: 30 }, voiceKey: "pt.v.point" },
  { id: "avatar", series: "daily", file: "avatar", nameKey: "pt.avatar", unlock: { kind: "level", n: 5 }, voiceKey: "pt.v.avatar" },
  { id: "oops", series: "daily", file: "oops", nameKey: "pt.oops", unlock: { kind: "maxStreak", n: 14 }, voiceKey: "pt.v.oops" },
  // 里程碑成就（重大成就才解锁——"她为你学完一整张图谱而高兴"）
  { id: "hero", series: "milestone", file: "hero", nameKey: "pt.hero", unlock: { kind: "graphs", n: 1 }, voiceKey: "pt.v.hero" },
  { id: "zongshi", series: "milestone", file: "zongshi", nameKey: "pt.zongshi", unlock: { kind: "level", n: 15 }, voiceKey: "pt.v.zongshi" },
  // 日常神态（随基础学习里程碑解锁，延续 daily 系列）
  { id: "nod", series: "daily", file: "nod", nameKey: "pt.nod", unlock: { kind: "streak", n: 5 }, voiceKey: "pt.v.nod" },
  { id: "ponder", series: "daily", file: "ponder", nameKey: "pt.ponder", unlock: { kind: "mastered", n: 20 }, voiceKey: "pt.v.ponder" },
  { id: "applaud", series: "daily", file: "applaud", nameKey: "pt.applaud", unlock: { kind: "maxStreak", n: 10 }, voiceKey: "pt.v.applaud" },
  { id: "lantern", series: "daily", file: "lantern", nameKey: "pt.lantern", unlock: { kind: "maxStreak", n: 21 }, voiceKey: "pt.v.lantern" },
  // 学科场景（半身情境立绘，随学习广度/深度逐张点亮）
  { id: "scene-desk", series: "scene", file: "scene-desk", nameKey: "pt.desk", unlock: { kind: "mastered", n: 5 }, voiceKey: "pt.v.desk" },
  { id: "scene-window", series: "scene", file: "scene-window", nameKey: "pt.window", unlock: { kind: "level", n: 3 }, voiceKey: "pt.v.window" },
  { id: "scene-shelves", series: "scene", file: "scene-shelves", nameKey: "pt.shelves", unlock: { kind: "projects", n: 2 }, voiceKey: "pt.v.shelves" },
  { id: "scene-nightread", series: "scene", file: "scene-nightread", nameKey: "pt.nightread", unlock: { kind: "maxStreak", n: 7 }, voiceKey: "pt.v.nightread" },
  { id: "scene-summit", series: "scene", file: "scene-summit", nameKey: "pt.summit", unlock: { kind: "level", n: 8 }, voiceKey: "pt.v.summit" },
  { id: "scene-tea", series: "scene", file: "scene-tea", nameKey: "pt.tea", unlock: { kind: "streak", n: 10 }, voiceKey: "pt.v.tea" },
  { id: "scene-night", series: "scene", file: "scene-night", nameKey: "pt.night", unlock: { kind: "maxStreak", n: 14 }, voiceKey: "pt.v.night" },
  { id: "scene-lectern", series: "scene", file: "scene-lectern", nameKey: "pt.lectern", unlock: { kind: "mastered", n: 15 }, voiceKey: "pt.v.lectern" },
  { id: "scene-stroll", series: "scene", file: "scene-stroll", nameKey: "pt.stroll", unlock: { kind: "projects", n: 3 }, voiceKey: "pt.v.stroll" },
  { id: "scene-annotate", series: "scene", file: "scene-annotate", nameKey: "pt.annotate", unlock: { kind: "mastered", n: 40 }, voiceKey: "pt.v.annotate" },
  // 季节限定（当季解锁）——立绘换成带时令点缀的 season-* 版
  { id: "spring", series: "season", file: "season-spring", nameKey: "pt.spring", unlock: { kind: "season", months: [3, 4, 5] }, voiceKey: "pt.v.spring" },
  { id: "summer", series: "season", file: "season-summer", nameKey: "pt.summer", unlock: { kind: "season", months: [6, 7, 8] }, voiceKey: "pt.v.summer" },
  { id: "autumn", series: "season", file: "season-autumn", nameKey: "pt.autumn", unlock: { kind: "season", months: [9, 10, 11] }, voiceKey: "pt.v.autumn" },
  { id: "winter", series: "season", file: "season-winter", nameKey: "pt.winter", unlock: { kind: "season", months: [12, 1, 2] }, voiceKey: "pt.v.winter" },
  // 画风主题（Pro 专属，纯审美变体）——泼墨用飞白立绘 face-ink，木刻用强对比 woodcut
  { id: "xieyi", series: "theme", file: "face-ink", nameKey: "pt.xieyi", unlock: { kind: "paid" }, voiceKey: "pt.v.xieyi", paid: true },
  { id: "woodcut", series: "theme", file: "woodcut", nameKey: "pt.woodcut", unlock: { kind: "paid" }, voiceKey: "pt.v.woodcut", paid: true },
];

export const DEFAULT_PORTRAIT = "present";
const STORE_KEY = "telos:portrait";

export function portraitSrc(p: Portrait | string): string {
  const file = typeof p === "string" ? p : p.file;
  return asset(`/portraits/${file}.png`);
}

export function portraitById(id: string): Portrait | undefined {
  return PORTRAITS.find((p) => p.id === id);
}

// 单条解锁规则判定（印章 / 雅号 / 书斋陈设复用同一套语义，零重复）。
export function matchUnlock(u: UnlockRule, s: LearnerStats): boolean {
  switch (u.kind) {
    case "always":
      return true;
    case "streak":
      return s.streak >= u.n;
    case "maxStreak":
      return s.maxStreak >= u.n;
    case "level":
      return s.level >= u.n;
    case "xp":
      return s.totalXp >= u.n;
    case "projects":
      return s.projects >= u.n;
    case "mastered":
      return s.mastered >= u.n;
    case "graphs":
      return s.graphs >= u.n;
    case "diagnosed":
      return s.diagnosed;
    case "season":
      return u.months.includes(s.month);
    case "paid":
      return s.isPro; // 单买解锁后续接 app_metadata.telos_portraits，这里先按 Pro 全解锁
  }
}

export function isUnlocked(p: Portrait, s: LearnerStats): boolean {
  return matchUnlock(p.unlock, s);
}

// 通用解锁提示（印章 / 雅号 / 书斋陈设共用，措辞中性，不带形象叙事口吻）。
export function ruleHint(u: UnlockRule): { key: string; vars?: Record<string, number> } {
  switch (u.kind) {
    case "always":
      return { key: "un.always" };
    case "streak":
    case "maxStreak":
      return { key: "un.streak", vars: { n: u.n } };
    case "level":
      return { key: "un.level", vars: { n: u.n } };
    case "xp":
      return { key: "un.xp", vars: { n: u.n } };
    case "projects":
      return { key: "un.projects", vars: { n: u.n } };
    case "mastered":
      return { key: "un.mastered", vars: { n: u.n } };
    case "graphs":
      return { key: "un.graphs", vars: { n: u.n } };
    case "diagnosed":
      return { key: "un.diagnosed" };
    case "season":
      return { key: "un.season" };
    case "paid":
      return { key: "un.paid" };
  }
}

// 未解锁时给用户看的"怎么解锁"提示：返回 i18n key + 插值参数。
export function unlockHint(p: Portrait): { key: string; vars?: Record<string, number> } {
  const u = p.unlock;
  switch (u.kind) {
    case "always":
      return { key: "pt.u.always" };
    case "streak":
      return { key: "pt.u.streak", vars: { n: u.n } };
    case "maxStreak":
      return { key: "pt.u.streak", vars: { n: u.n } };
    case "level":
      return { key: "pt.u.level", vars: { n: u.n } };
    case "xp":
      return { key: "pt.u.xp", vars: { n: u.n } };
    case "projects":
      return { key: "pt.u.projects", vars: { n: u.n } };
    case "mastered":
      return { key: "pt.u.mastered", vars: { n: u.n } };
    case "graphs":
      return { key: "pt.u.graphs", vars: { n: u.n } };
    case "diagnosed":
      return { key: "pt.u.diagnosed" };
    case "season":
      return { key: "pt.u.season" };
    case "paid":
      return { key: "pt.u.paid" };
  }
}

// 当前选为"陪伴"的形象 id（localStorage）。
export function getCurrentPortraitId(): string {
  if (typeof window === "undefined") return DEFAULT_PORTRAIT;
  try {
    return window.localStorage.getItem(STORE_KEY) || DEFAULT_PORTRAIT;
  } catch {
    return DEFAULT_PORTRAIT;
  }
}

export function setCurrentPortraitId(id: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORE_KEY, id);
  } catch {
    /* ignore */
  }
  bumpPrefs(); // 当前形象=偏好：跨设备 LWW
}

// 已解锁形象基线（与 portrait-unlock-toast 同 key）：跨设备取并集，换设备不重复弹解锁庆祝。
const SEEN_KEY = "telos:portrait-seen";
export function getPortraitSeen(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}
export function setPortraitSeen(ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify([...new Set(ids)]));
  } catch {
    /* ignore */
  }
}

// 解析出"当前应显示的立绘文件名"：选中的若不存在/未解锁则回退默认，保证 hero 永远有图。
// 当前主题若绑定了看板娘画风(face)且图已入库 → 成套主题里她也换风格；留空则用用户选的形象。
function themeFaceFile(): string | null {
  const th = THEMES.find((x) => x.id === getTheme());
  return th && th.face ? th.face : null;
}

export function currentPortraitFile(s: LearnerStats | null): string {
  const themed = themeFaceFile();
  if (themed) return themed;
  const id = getCurrentPortraitId();
  const p = portraitById(id);
  if (!p) return DEFAULT_PORTRAIT;
  if (s && !isUnlocked(p, s)) return DEFAULT_PORTRAIT;
  return p.file;
}

// ── 聚合真实学习信号 → 解锁判定快照 ──────────────────────────────────────
// 跨所有项目统计掌握量/完成图谱，叠加 xp.ts 的连胜/等级，组成 LearnerStats。
export function collectStats(projects: Project[], pro: boolean): LearnerStats {
  let mastered = 0;
  let graphs = 0;
  let diagnosed = false;
  for (const p of projects) {
    const total = p.points.length;
    const m = p.points.filter((k) => (p.state.mastery[k.id] ?? 0) >= 0.8).length;
    mastered += m;
    if (total > 0 && m === total) graphs += 1;
    if (Object.keys(p.state?.mastery ?? {}).length > 0) diagnosed = true;
  }
  const xp = totalXp();
  return {
    streak: getStreak(),
    maxStreak: maxStreak(),
    level: levelInfo(xp).level,
    totalXp: xp,
    projects: projects.length,
    mastered,
    graphs,
    diagnosed,
    isPro: pro,
    month: new Date().getMonth() + 1,
  };
}

// 首页/顶栏等只读展示当前陪伴形象：mount 后读 localStorage（避免 SSR/hydration 不一致）。
export function useCurrentPortraitFile(): string {
  const [file, setFile] = useState(DEFAULT_PORTRAIT);
  useEffect(() => {
    const themed = themeFaceFile();
    if (themed) {
      setFile(themed);
      return;
    }
    const p = portraitById(getCurrentPortraitId());
    if (p) setFile(p.file);
  }, []);
  return file;
}
