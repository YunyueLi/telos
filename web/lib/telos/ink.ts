"use client";

// 「墨」——可花的软通货。XP 是不可花的能力刻度（镜子，照出你多强）；墨是你学习时她为你研的墨，
// 攒着换东西。双轨解耦，避免"努力学习=攒钱乱花"的认知扭曲（Duolingo XP/Gems 范式）。
//
// 红线：
//  ① 墨只能靠【真实学习】赚取，绝不能用钱购买（Finch 防通胀铁律：硬通货来源单一）。
//  ② 墨只买【非学习优势】的东西（连胜冻结 / 形象主题皮），绝不卖能力、不影响 XP 与掌握度。
//
// 数据落 localStorage(telos:ink)：{ balance, earned, spent }。

const INK_KEY = "telos:ink";

export const FREEZE_INK = 100; // 兑 1 个连胜冻结（约 8 天常规努力，对标原 200 XP）
export const DAILY_INK = 12; // 每日首次达成目标的奖励（稳定产出，类似 Finch「每日领」）
export const GRAPH_INK = 100; // 学完一整张能力图谱（重大成就）

export interface Ink {
  balance: number; // 当前可用
  earned: number; // 累计赚取（统计/成就用）
  spent: number; // 累计花费
}

function fresh(): Ink {
  return { balance: 0, earned: 0, spent: 0 };
}

function read(): Ink {
  if (typeof window === "undefined") return fresh();
  try {
    const raw = window.localStorage.getItem(INK_KEY);
    if (raw) {
      const o = JSON.parse(raw) as Partial<Ink>;
      return {
        balance: Math.max(0, typeof o.balance === "number" ? o.balance : 0),
        earned: Math.max(0, typeof o.earned === "number" ? o.earned : 0),
        spent: Math.max(0, typeof o.spent === "number" ? o.spent : 0),
      };
    }
  } catch {
    /* ignore */
  }
  return fresh();
}

function write(i: Ink): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(INK_KEY, JSON.stringify(i));
  } catch {
    /* ignore */
  }
}

export function getInk(): Ink {
  return read();
}

// 赚墨（绑真实学习事件触发）。幂等性由调用方保证（如每日只在「首次达标」那一刻调一次）。
export function earnInk(amount: number): number {
  if (amount <= 0) return read().balance;
  const i = read();
  i.balance += amount;
  i.earned += amount;
  write(i);
  return i.balance;
}

// 花墨：余额够则扣并返回 true；不够返回 false（不透支）。
export function spendInk(amount: number): boolean {
  if (amount <= 0) return true;
  const i = read();
  if (i.balance < amount) return false;
  i.balance -= amount;
  i.spent += amount;
  write(i);
  return true;
}

// 完成一整张图谱发墨（幂等：每张图谱按稳定 key 只发一次，重复领证书不重复发）。
const GRAPH_DONE_KEY = "telos:ink-graphs";
export function earnGraphInk(graphKey: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(GRAPH_DONE_KEY);
    const done: string[] = raw ? JSON.parse(raw) : [];
    if (done.includes(graphKey)) return false;
    done.push(graphKey);
    window.localStorage.setItem(GRAPH_DONE_KEY, JSON.stringify(done));
    earnInk(GRAPH_INK);
    return true;
  } catch {
    return false;
  }
}
