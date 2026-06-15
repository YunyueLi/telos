"use client";

// 治学通行证——把【真实学习信号(累计 XP)】铺成一条带节点的进阶长卷，沿途授予外观荣誉。
// 反 FOMO 的「通行证」设计（守 Telos 红线）：
//  - 进度只能靠【学】推进，绝不能花钱买进度 / 买跳级（区别于赌场式 battle pass）。
//  - 无硬性倒计时胁迫：季节只是叙事皮（春启/夏进/秋成/冬藏轮换），已得奖励永久保留，不制造稀缺焦虑。
//  - 双轨：免费轨人人可领(墨)；治学轨(Pro)额外授予【独占印章/雅号/书斋陈设】+更多墨。奖励皆外观，绝不含学习优势。
//  - 治学轨独占物按【领取时是否 Pro】分账记录(claimedPro)，非 Pro 领免费轨不会白嫖独占物；日后升级可补领。
import { totalXp } from "./xp";
import { earnInk } from "./ink";
import { isPro } from "./billing";

export interface PassReward {
  ink: number;
  sealId?: string; // 授予印章（与 seals.ts SEALS 对齐，且该 seal.passStep === 本阶 i）
  titleId?: string; // 授予雅号
  decorId?: string; // 授予书斋陈设
}
export interface PassStep {
  i: number;
  xp: number; // 解锁所需累计 XP
  free: PassReward; // 免费轨
  pro: PassReward; // 治学轨（含 free 之外的额外奖励）
}

// 12 阶（前松后紧）。治学轨独占物挂在 4/6/8/10/11 阶，与 seals/studyroom 的 passStep 严格对齐。
export const STEPS: PassStep[] = [
  { i: 0, xp: 0, free: { ink: 8 }, pro: { ink: 10 } },
  { i: 1, xp: 80, free: { ink: 10 }, pro: { ink: 14 } },
  { i: 2, xp: 200, free: { ink: 12 }, pro: { ink: 18 } },
  { i: 3, xp: 360, free: { ink: 14 }, pro: { ink: 20 } },
  { i: 4, xp: 560, free: { ink: 16 }, pro: { ink: 24, decorId: "guqin" } },
  { i: 5, xp: 820, free: { ink: 18 }, pro: { ink: 28 } },
  { i: 6, xp: 1150, free: { ink: 20 }, pro: { ink: 30, sealId: "yueke" } },
  { i: 7, xp: 1560, free: { ink: 24 }, pro: { ink: 36 } },
  { i: 8, xp: 2080, free: { ink: 28 }, pro: { ink: 42, decorId: "shanshui" } },
  { i: 9, xp: 2720, free: { ink: 32 }, pro: { ink: 48 } },
  { i: 10, xp: 3520, free: { ink: 38 }, pro: { ink: 56, titleId: "buojuan" } },
  { i: 11, xp: 4500, free: { ink: 50 }, pro: { ink: 80, sealId: "zhixue" } },
];

// 季节叙事（按本地月份，纯皮肤，不影响奖励永久性）。
export function seasonKey(): string {
  const m = new Date().getMonth(); // 0=Jan
  if (m >= 2 && m <= 4) return "chun";
  if (m >= 5 && m <= 7) return "xia";
  if (m >= 8 && m <= 10) return "qiu";
  return "dong";
}

// ── 领取记录（localStorage telos:pass）：分账免费轨 / 治学轨 ──
const KEY = "telos:pass";
interface PassState {
  claimedFree: number[];
  claimedPro: number[];
}
function read(): PassState {
  if (typeof window === "undefined") return { claimedFree: [], claimedPro: [] };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const o = JSON.parse(raw) as Partial<PassState>;
      return {
        claimedFree: Array.isArray(o.claimedFree) ? o.claimedFree.filter((n) => typeof n === "number") : [],
        claimedPro: Array.isArray(o.claimedPro) ? o.claimedPro.filter((n) => typeof n === "number") : [],
      };
    }
  } catch {
    /* ignore */
  }
  return { claimedFree: [], claimedPro: [] };
}
function write(s: PassState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

// 治学轨已领阶集合 = 独占印章/雅号/陈设的「已授予」真相，供 seals/studyroom 判定解锁。
export function getPassGranted(): number[] {
  return read().claimedPro;
}

export interface PassStepView extends PassStep {
  unlocked: boolean;
  claimedFree: boolean;
  claimedPro: boolean;
  claimable: boolean; // 仍有可领（免费未领，或 Pro 且治学未领）
}
export interface PassProgress {
  seasonKey: string;
  totalXp: number;
  curStep: number; // 已达到的最高阶
  nextXp: number | null; // 下一阶门槛（null=已满阶）
  toNext: number; // 距下一阶 XP（0=满阶）
  pctToNext: number; // 0..1（当前阶→下一阶）
  maxed: boolean;
  steps: PassStepView[];
  claimableCount: number;
  pro: boolean;
}

export function passProgress(): PassProgress {
  const xp = totalXp();
  const { claimedFree, claimedPro } = read();
  const pro = isPro();
  let curStep = 0;
  for (let k = 0; k < STEPS.length; k++) if (xp >= STEPS[k].xp) curStep = k;
  const maxed = curStep >= STEPS.length - 1;
  const nextXp = maxed ? null : STEPS[curStep + 1].xp;
  const baseXp = STEPS[curStep].xp;
  const toNext = nextXp == null ? 0 : Math.max(0, nextXp - xp);
  const pctToNext = nextXp == null ? 1 : Math.min(1, Math.max(0, (xp - baseXp) / (nextXp - baseXp)));
  const steps: PassStepView[] = STEPS.map((st) => {
    const unlocked = xp >= st.xp;
    const cf = claimedFree.includes(st.i);
    const cp = claimedPro.includes(st.i);
    return {
      ...st,
      unlocked,
      claimedFree: cf,
      claimedPro: cp,
      claimable: unlocked && (!cf || (pro && !cp)),
    };
  });
  return {
    seasonKey: seasonKey(),
    totalXp: xp,
    curStep,
    nextXp,
    toNext,
    pctToNext,
    maxed,
    steps,
    claimableCount: steps.filter((s) => s.claimable).length,
    pro,
  };
}

export interface ClaimResult {
  ok: boolean;
  ink: number; // 本次发放的墨
  grantedPro: boolean; // 是否授予了治学轨独占物
  reason?: "locked" | "claimed";
}

// 领取某阶：发墨（免费轨 + Pro 时治学轨）+ 记账。幂等：已领的轨不重复发。
export function claimStep(i: number): ClaimResult {
  const st = STEPS[i];
  if (!st) return { ok: false, ink: 0, grantedPro: false, reason: "locked" };
  if (totalXp() < st.xp) return { ok: false, ink: 0, grantedPro: false, reason: "locked" };
  const s = read();
  const pro = isPro();
  let ink = 0;
  let grantedPro = false;
  if (!s.claimedFree.includes(i)) {
    earnInk(st.free.ink);
    ink += st.free.ink;
    s.claimedFree.push(i);
  }
  if (pro && !s.claimedPro.includes(i)) {
    earnInk(st.pro.ink);
    ink += st.pro.ink;
    s.claimedPro.push(i);
    grantedPro = true;
  }
  if (ink === 0 && !grantedPro) return { ok: false, ink: 0, grantedPro: false, reason: "claimed" };
  write(s);
  return { ok: true, ink, grantedPro };
}

// 一键领取所有可领台阶（沿途已铺好的奖励）。返回汇总。
export function claimAll(): { ink: number; count: number; grantedPro: number } {
  let ink = 0;
  let count = 0;
  let grantedPro = 0;
  for (const st of STEPS) {
    const r = claimStep(st.i);
    if (r.ok) {
      ink += r.ink;
      count += 1;
      if (r.grantedPro) grantedPro += 1;
    }
  }
  return { ink, count, grantedPro };
}

// 跨设备同步：领取记录取并集（领过即领过，换设备不丢、不重复发墨——发墨已落本地余额）。
export function getPassState(): PassState {
  return read();
}
export function setPassState(s: Partial<PassState>): void {
  write({
    claimedFree: Array.isArray(s.claimedFree) ? [...new Set(s.claimedFree)] : read().claimedFree,
    claimedPro: Array.isArray(s.claimedPro) ? [...new Set(s.claimedPro)] : read().claimedPro,
  });
}
