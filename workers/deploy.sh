#!/usr/bin/env bash
# 部署 Telos 倒推 Worker（公开 baseline + 私有增强）。
#
# 若存在 prompts.private.js（owner 私有调优版，git-ignored），部署时临时替换公开 prompts.js 上线、
# 部署后立刻还原——公开仓的 prompts.js 永远保持 baseline，prompts.private.js 永不进仓库。
# 没有私有版时，直接用公开 baseline 部署（clone/自部署的默认行为）。
#
# 用法：  cd workers && ./deploy.sh          （或 npm run deploy）
#        透传给 wrangler 的参数照写：./deploy.sh --dry-run
set -euo pipefail
cd "$(dirname "$0")"

PUB="prompts.js"
PRIV="prompts.private.js"
BAK=".prompts.baseline.bak"

if [ -f "$PRIV" ]; then
  echo "→ 检测到私有增强 prompt：部署期用 ${PRIV} 替换 ${PUB}（部署后自动还原）"
  cp "$PUB" "$BAK"
  # 任何退出路径都还原 baseline——绝不把私有版留在工作区 / 误提交进公开仓
  trap 'mv -f "$BAK" "$PUB" 2>/dev/null || true' EXIT
  cp "$PRIV" "$PUB"
  echo "→ 上线前一致性校验（私有增强不得丢掉公开 baseline 的铁律）"
  node check-prompt-parity.mjs
else
  echo "→ 未发现 ${PRIV}：用公开 baseline（${PUB}）部署。"
fi

npx wrangler deploy "$@"
echo "✓ 部署完成。"
