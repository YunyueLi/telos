#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────
// Telos prompt 双实现一致性校验（#3B 单源保险）
//
// derive/lesson/probe 的 prompt 在两处各写一份：
//   · core/telos_core/llm.py   （本地 serve.py / Python 引擎用）
//   · workers/derive.js        （生产 Cloudflare Worker 用）
// 两者是【有意的繁简镜像】（JS 为精简版，非逐字相同），故这里不做逐字 diff，
// 而是校验「关键规则的不变量子串」在两端都在场——防止改了一处忘了另一处。
//
// 用法：  node workers/check-prompt-parity.mjs        （退出码非 0 = 漂移，可挂 CI / pre-push）
// 改 prompt（尤其 _STYLE_RULES / STYLE_RULES、选项铁律、domain 适配）后务必跑一遍。
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const PY = join(here, "..", "core", "telos_core", "llm.py");
const JS = join(here, "derive.js");

// 每项：[人类可读标签, 必须同时出现在两份实现里的稳定子串]
const INVARIANTS = [
  ["文风铁律·标题", "文风铁律"],
  ["文风铁律·AI 套路句式禁令", "不是…而是"],
  ["文风铁律·禁升华尾巴", "升华尾巴"],
  ["lesson·选项铁律(中庸即答案)", "中庸即答案"],
  ["lesson·domain A–F 适配", "A 记忆"],
  ["probe·同质选项", "同质选项"],
  ["probe·应试高手自检", "应试高手"],
  ["derive·domain 判定", "A=陈述记忆"],
];

let py;
let js;
try {
  py = readFileSync(PY, "utf8");
  js = readFileSync(JS, "utf8");
} catch (e) {
  console.error(`读取失败：${e.message}`);
  process.exit(2);
}

let bad = 0;
for (const [label, needle] of INVARIANTS) {
  const inPy = py.includes(needle);
  const inJs = js.includes(needle);
  if (inPy && inJs) {
    console.log(`✓ ${label}`);
  } else {
    bad++;
    console.error(
      `✗ ${label}：不一致 — llm.py=${inPy ? "有" : "缺"} derive.js=${inJs ? "有" : "缺"}（子串「${needle}」）`,
    );
  }
}

if (bad) {
  console.error(`\n${bad} 项 prompt 不变量在两端不一致 —— 改 prompt 时请同步 llm.py 与 derive.js。`);
  process.exit(1);
}
console.log(`\n✓ ${INVARIANTS.length} 项 prompt 不变量在 llm.py 与 derive.js 两端均在场。`);
