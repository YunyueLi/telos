"use client";

// 书斋装点——文房清玩（墨线 SVG，纯外观）。解锁后可摆上「案头」（最多 PLACE_MAX 件），
// 在书斋顶部组成你的一方天地。解锁绑真实学习里程碑或治学通行证授予；绝不影响学习。
import { matchUnlock, ruleHint, type UnlockRule, type LearnerStats } from "./portraits";
import { bumpPrefs } from "./prefs-rev";

export interface Decor {
  id: string; // = SVG symbol #d-<id>
  nameKey: string;
  feat?: UnlockRule;
  passStep?: number;
  pro?: boolean;
}

export const PLACE_MAX = 4; // 案头最多同时陈列件数

// 文房清玩：笔筒/镇纸/书卷/盆景/香炉/茶具/古琴/挂画。
export const DECOR: Decor[] = [
  { id: "bitong", nameKey: "decor.bitong", feat: { kind: "always" } },
  { id: "zhenzhi", nameKey: "decor.zhenzhi", feat: { kind: "streak", n: 3 } },
  { id: "juan", nameKey: "decor.juan", feat: { kind: "mastered", n: 10 } },
  { id: "penjing", nameKey: "decor.penjing", feat: { kind: "maxStreak", n: 7 } },
  { id: "xianglu", nameKey: "decor.xianglu", feat: { kind: "mastered", n: 30 } },
  { id: "chaju", nameKey: "decor.chaju", feat: { kind: "projects", n: 2 } },
  { id: "guqin", nameKey: "decor.guqin", passStep: 4, pro: true },
  { id: "shanshui", nameKey: "decor.shanshui", passStep: 8, pro: true },
];

export const DEFAULT_PLACED = ["bitong"];

export function isDecorUnlocked(d: Decor, s: LearnerStats, passClaimed: number[]): boolean {
  if (d.feat && matchUnlock(d.feat, s)) return true;
  if (d.passStep != null && passClaimed.includes(d.passStep)) return true;
  return false;
}
export function decorHint(d: Decor): { key: string; vars?: Record<string, number> } {
  if (d.feat) return ruleHint(d.feat);
  if (d.passStep != null) return { key: "un.pass", vars: { n: d.passStep + 1 } };
  return { key: "un.always" };
}
export function decorById(id: string): Decor | undefined {
  return DECOR.find((x) => x.id === id);
}

// ── 案头摆放（localStorage telos:studyroom）：{ placed: string[] } ──
const KEY = "telos:studyroom";
function read(): string[] {
  if (typeof window === "undefined") return [...DEFAULT_PLACED];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const o = JSON.parse(raw) as { placed?: string[] };
      if (Array.isArray(o.placed)) return o.placed.slice(0, PLACE_MAX);
    }
  } catch {
    /* ignore */
  }
  return [...DEFAULT_PLACED];
}
function write(placed: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ placed: placed.slice(0, PLACE_MAX) }));
  } catch {
    /* ignore */
  }
  bumpPrefs();
}

export function getPlaced(): string[] {
  return read();
}
// 切换摆放：已摆则撤下；未摆则摆上（满 PLACE_MAX 返回 false 不动）。
export function togglePlace(id: string): { placed: string[]; full: boolean } {
  const cur = read();
  if (cur.includes(id)) {
    write(cur.filter((x) => x !== id));
    return { placed: read(), full: false };
  }
  if (cur.length >= PLACE_MAX) return { placed: cur, full: true };
  write([...cur, id]);
  return { placed: read(), full: false };
}
// 跨设备同步：偏好类，整体读写。
export function setPlaced(placed: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ placed: placed.slice(0, PLACE_MAX) }));
  } catch {
    /* ignore */
  }
}
