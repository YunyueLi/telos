"use client";

// 印章雅号——书斋的「荣誉」维度（纯外观，绝不影响学习/掌握度/XP）。
// - 雅号(Title)：可佩戴的学者头衔，按真实学习里程碑授予，显示在「我」页 + 书斋。一次戴一个。
// - 印章(Seal)：朱红金石印（唯一彩色 accent，仅用于「钤印」这类仪式），可设「常用印」钤在完课证书上。
// 解锁来源两路：feat=真实学习成就（复用 portraits 的 matchUnlock 语义）；passStep=治学通行证某阶授予。
// 红线：只能靠「学」获得，绝不售卖、绝不能买跳级；不踩 Duolingo 式愧疚催促。
import { matchUnlock, ruleHint, type UnlockRule, type LearnerStats } from "./portraits";
import { bumpPrefs } from "./prefs-rev";

export interface Seal {
  id: string; // 稳定 id（= SVG symbol #s-<id>）
  nameKey: string;
  feat?: UnlockRule; // 成就解锁
  passStep?: number; // 治学通行证第 N 阶授予（与 pass.ts STEPS 对齐）
  pro?: boolean; // 治学轨限定（领取需 Pro）——仅标注，真正门槛在通行证领取处
}
export type Title = Seal; // 雅号与印章同构（id + 解锁来源），分表管理

// 印章：图形意象（罗盘/笔/火/同心/网格/书/山/月/书院），朱红金石描边。
export const SEALS: Seal[] = [
  { id: "qicheng", nameKey: "seal.qicheng", feat: { kind: "always" } },
  { id: "qinxue", nameKey: "seal.qinxue", feat: { kind: "streak", n: 3 } },
  { id: "buchuo", nameKey: "seal.buchuo", feat: { kind: "maxStreak", n: 14 } },
  { id: "tongtou", nameKey: "seal.tongtou", feat: { kind: "mastered", n: 30 } },
  { id: "dacheng", nameKey: "seal.dacheng", feat: { kind: "graphs", n: 1 } },
  { id: "boxue", nameKey: "seal.boxue", feat: { kind: "projects", n: 3 } },
  { id: "dengfeng", nameKey: "seal.dengfeng", feat: { kind: "level", n: 10 } },
  { id: "yueke", nameKey: "seal.yueke", passStep: 6, pro: true },
  { id: "zhixue", nameKey: "seal.zhixue", passStep: 11, pro: true },
];

// 雅号：学者头衔进阶（古意，9 语言意译）。
export const TITLES: Title[] = [
  { id: "chuxue", nameKey: "title.chuxue", feat: { kind: "always" } },
  { id: "rumen", nameKey: "title.rumen", feat: { kind: "mastered", n: 8 } },
  { id: "yousucheng", nameKey: "title.yousucheng", feat: { kind: "level", n: 5 } },
  { id: "jianjia", nameKey: "title.jianjia", feat: { kind: "maxStreak", n: 7 } },
  { id: "dengtang", nameKey: "title.dengtang", feat: { kind: "mastered", n: 30 } },
  { id: "ronghui", nameKey: "title.ronghui", feat: { kind: "graphs", n: 1 } },
  { id: "bolan", nameKey: "title.bolan", feat: { kind: "projects", n: 3 } },
  { id: "fuwuche", nameKey: "title.fuwuche", feat: { kind: "level", n: 10 } },
  { id: "buxie", nameKey: "title.buxie", feat: { kind: "maxStreak", n: 30 } },
  { id: "buojuan", nameKey: "title.buojuan", passStep: 10, pro: true },
];

export const DEFAULT_TITLE = "chuxue";
export const DEFAULT_SEAL = "qicheng";

function unlockedBy(item: Seal, s: LearnerStats, passClaimed: number[]): boolean {
  if (item.feat && matchUnlock(item.feat, s)) return true;
  if (item.passStep != null && passClaimed.includes(item.passStep)) return true;
  return false;
}
export function isSealUnlocked(seal: Seal, s: LearnerStats, passClaimed: number[]): boolean {
  return unlockedBy(seal, s, passClaimed);
}
export function isTitleUnlocked(title: Title, s: LearnerStats, passClaimed: number[]): boolean {
  return unlockedBy(title, s, passClaimed);
}

// 解锁提示：成就 → 通用 un.* 文案；通行证授予 → un.pass（带阶号，阶号对用户显示 +1）。
export function itemHint(item: Seal): { key: string; vars?: Record<string, number> } {
  if (item.feat) return ruleHint(item.feat);
  if (item.passStep != null) return { key: "un.pass", vars: { n: item.passStep + 1 } };
  return { key: "un.always" };
}

export function sealById(id: string): Seal | undefined {
  return SEALS.find((x) => x.id === id);
}
export function titleById(id: string): Title | undefined {
  return TITLES.find((x) => x.id === id);
}

// ── 当前佩戴（localStorage telos:seals）：{ seal, title } ──
const KEY = "telos:seals";
interface Worn {
  seal: string;
  title: string;
}
function readWorn(): Worn {
  if (typeof window === "undefined") return { seal: DEFAULT_SEAL, title: DEFAULT_TITLE };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const o = JSON.parse(raw) as Partial<Worn>;
      return { seal: o.seal || DEFAULT_SEAL, title: o.title || DEFAULT_TITLE };
    }
  } catch {
    /* ignore */
  }
  return { seal: DEFAULT_SEAL, title: DEFAULT_TITLE };
}
function writeWorn(w: Worn): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(w));
  } catch {
    /* ignore */
  }
  bumpPrefs(); // 佩戴=偏好：跨设备 LWW
}

export function getCurrentSeal(): string {
  return readWorn().seal;
}
export function getCurrentTitle(): string {
  return readWorn().title;
}
export function setCurrentSeal(id: string): void {
  writeWorn({ ...readWorn(), seal: id });
}
export function setCurrentTitle(id: string): void {
  writeWorn({ ...readWorn(), title: id });
}

// 跨设备同步：整体读写（合并后回填，纯偏好类）。
export function getSealsState(): Worn {
  return readWorn();
}
export function setSealsState(w: Partial<Worn>): void {
  const cur = readWorn();
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ seal: w.seal || cur.seal, title: w.title || cur.title }));
  } catch {
    /* ignore */
  }
}

// 「我」页/书斋展示：当前应显示的雅号（佩戴的若已解锁，否则回退默认 always 款，永不空）。
export function currentTitle(s: LearnerStats, passClaimed: number[]): Title {
  const t = titleById(getCurrentTitle());
  if (t && isTitleUnlocked(t, s, passClaimed)) return t;
  return titleById(DEFAULT_TITLE)!;
}
export function currentSeal(s: LearnerStats, passClaimed: number[]): Seal {
  const seal = sealById(getCurrentSeal());
  if (seal && isSealUnlocked(seal, s, passClaimed)) return seal;
  return sealById(DEFAULT_SEAL)!;
}
