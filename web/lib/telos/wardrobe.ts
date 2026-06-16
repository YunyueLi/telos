"use client";

// 衣橱（造型换装）——给看板娘换整套着装。设计红线：
// - 纯外观，绝不影响学习 / XP / 掌握度（cosmetic-only）。
// - 解锁混合制：花【墨】买断（确定性购买，非抽卡，墨只赚不卖）+ 季节 / 里程碑 / Pro 限定。
//   买断永久（telos:wardrobe.bought），与形象集同一「当前看板娘」真源（currentPortrait）。
// - 换装是【主动选择】（攒墨请她换上），区别于形象集的【自动见证】（随成长解锁）。
//
// 立绘走老流程：每套是一张 hero 一致的整身立绘（签名站姿、只换衣），入库后在 portraits.ts 置 ready:true。
import {
  PORTRAITS,
  DEFAULT_PORTRAIT,
  getCurrentPortraitId,
  setCurrentPortraitId,
  type Portrait,
} from "./portraits";
import { spendInk } from "./ink";
import { bumpPrefs } from "./prefs-rev";

const KEY = "telos:wardrobe";

// 衣橱套装 = attire 系列的 portrait（顺序即陈列顺序）。
export const OUTFITS: Portrait[] = PORTRAITS.filter((p) => p.series === "attire");

function read(): { bought: string[] } {
  if (typeof window === "undefined") return { bought: [] };
  try {
    const o = JSON.parse(window.localStorage.getItem(KEY) || "{}") as { bought?: string[] };
    return { bought: Array.isArray(o.bought) ? o.bought : [] };
  } catch {
    return { bought: [] };
  }
}
function write(bought: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ bought: [...new Set(bought)] }));
  } catch {
    /* ignore */
  }
}

export function getBoughtOutfits(): string[] {
  return read().bought;
}
export function ownsOutfit(id: string): boolean {
  return read().bought.includes(id);
}

// 套装墨价（仅 ink 解锁的有价；其余 0）。
export function outfitCost(o: Portrait): number {
  return o.unlock.kind === "ink" ? o.unlock.n : 0;
}

// 花墨买断：仅对【已入库 + ink 解锁 + 未购 + 余额够】生效，扣墨并记买断，返回 true。
export function buyOutfit(o: Portrait): boolean {
  if (o.unlock.kind !== "ink" || !o.ready) return false;
  if (ownsOutfit(o.id)) return true;
  if (!spendInk(o.unlock.n)) return false;
  const s = read();
  s.bought.push(o.id);
  write(s.bought);
  bumpPrefs(); // 买断=偏好类：跨设备并集
  return true;
}

// 换上（设为当前看板娘）。默认教师装 = 恢复 DEFAULT_PORTRAIT。
export function wearOutfit(id: string): void {
  setCurrentPortraitId(id);
}
export function wearDefault(): void {
  setCurrentPortraitId(DEFAULT_PORTRAIT);
}
// 当前穿的是否某套装（默认教师装时返回 false）。
export function isWearing(id: string): boolean {
  return getCurrentPortraitId() === id;
}
// 当前是否「默认教师装」（当前形象不是任何套装 id）。
export function wearingDefault(): boolean {
  const cur = getCurrentPortraitId();
  return !OUTFITS.some((o) => o.id === cur);
}

// 跨设备同步：买断取并集（偏好类，整体读写）。
export function setWardrobeBought(bought: string[]): void {
  if (typeof window === "undefined") return;
  const merged = [...new Set([...read().bought, ...(Array.isArray(bought) ? bought : [])])];
  write(merged);
}
