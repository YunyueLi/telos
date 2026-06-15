#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────
// Telos prompt 双实现一致性校验（#3B 单源保险）
//
// derive/lesson/probe 的 prompt 在两处各写一份（有意的繁简镜像，非逐字相同）：
//   · core/telos_core/prompts.py   （本地 serve.py / Python 引擎用，繁版）
//   · workers/prompts.js           （生产 Cloudflare Worker 用，简版）
// 这里不做逐字 diff，而是校验「关键规则的不变量子串」在两端在场——防止改了一处忘了另一处。
//
// 【公开 baseline + 私有增强】owner 的私有增强 prompt（git-ignored 的 prompts_private.py /
// prompts.private.js）若存在，也必须含全部不变量——即「公开 ⊆ 私有」：私有迭代绝不能丢掉这些铁律。
//
// 用法：  node workers/check-prompt-parity.mjs        （退出码非 0 = 漂移，可挂 CI / pre-push）
// 改 prompt（尤其 STYLE_RULES、选项铁律、domain 适配）后务必跑一遍。
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

// 每项：[人类可读标签, 必须出现的稳定子串]
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

// 公开 baseline（必校验）+ 私有增强（存在才校验，clone / CI 上通常没有）
const SOURCES = [
  { label: "core/telos_core/prompts.py", path: join(here, "..", "core", "telos_core", "prompts.py"), required: true },
  { label: "workers/prompts.js", path: join(here, "prompts.js"), required: true },
  { label: "core/telos_core/prompts_private.py（私有增强）", path: join(here, "..", "core", "telos_core", "prompts_private.py"), required: false },
  { label: "workers/prompts.private.js（私有增强）", path: join(here, "prompts.private.js"), required: false },
];

const present = [];
for (const s of SOURCES) {
  if (!existsSync(s.path)) {
    if (s.required) {
      console.error(`读取失败：缺少必需文件 ${s.label}`);
      process.exit(2);
    }
    continue; // 私有文件不存在 → 跳过（clone / CI 的正常情况）
  }
  try {
    present.push({ ...s, text: readFileSync(s.path, "utf8") });
  } catch (e) {
    console.error(`读取失败：${s.label} — ${e.message}`);
    process.exit(2);
  }
}

let bad = 0;
for (const [label, needle] of INVARIANTS) {
  const missing = present.filter((s) => !s.text.includes(needle)).map((s) => s.label);
  if (missing.length === 0) {
    console.log(`✓ ${label}`);
  } else {
    bad++;
    console.error(`✗ ${label}：子串「${needle}」缺失于 → ${missing.join("、")}`);
  }
}

if (bad) {
  console.error(`\n${bad} 项 prompt 不变量不一致——公开两端须同步；私有增强(若有)绝不能丢掉这些铁律。`);
  process.exit(1);
}
const hasPriv = present.length > 2;
console.log(`\n✓ ${INVARIANTS.length} 项不变量在 ${present.length} 份实现中均在场（公开 baseline${hasPriv ? " + 私有增强" : ""}）。`);
