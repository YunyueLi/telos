#!/usr/bin/env bash
# 把付费模板内容（templates-private.json，owner 私有）灌进 Cloudflare KV，
# 键 = tpl:<id>。Worker 的 /template 端点鉴权（已购该模板 或 Pro）后下发。
#
# 为什么：付费图谱内容不能进公开前端 / 仓库（会被白嫖）。前端只留 meta + 大纲预览，
# 完整 desc/drill/benchmark 存 KV，按账号鉴权下发。免费模板（科二）内容留前端。
#
# 前置：
#   1) 已创建 KV namespace 并在 wrangler.toml 取消注释 TELOS_USAGE 绑定：
#        npx wrangler kv namespace create TELOS_USAGE   # 把返回的 id 填进 wrangler.toml
#   2) 本目录有 templates-private.json（git-ignored 的内容母版）。
#   3) 安装 jq。
# 用法：  cd workers && ./seed-templates.sh
# 内容上新/改动后重跑本脚本即可（KV 覆盖写）。

set -euo pipefail
cd "$(dirname "$0")"

SRC="templates-private.json"
BINDING="TELOS_USAGE" # 复用托管 AI 的 KV namespace；键前缀 tpl: 区分用途

[ -f "$SRC" ] || { echo "✗ 缺 $SRC（owner 私有内容母版，git-ignored）"; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "✗ 需要 jq：brew install jq"; exit 1; }

ids=$(jq -r 'keys[] | select(startswith("_") | not)' "$SRC")
[ -n "$ids" ] || { echo "✗ $SRC 里没有可灌的模板"; exit 1; }

for id in $ids; do
  tmp="$(mktemp)"
  jq -c --arg k "$id" '.[$k]' "$SRC" >"$tmp"
  n=$(jq 'length' "$tmp")
  echo "→ tpl:${id} (${n} 节点)"
  npx wrangler kv key put "tpl:${id}" --path="$tmp" --binding="$BINDING" --remote
  rm -f "$tmp"
done

echo "✓ 完成。已购 / Pro 用户现在可从 /template 下发导入这些模板。"
