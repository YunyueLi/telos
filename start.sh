#!/usr/bin/env bash
# Telos · 一键本地运行：装好依赖、起「倒推代理 + 网页应用」、自动打开浏览器。
# 用法：  ./start.sh        （Ctrl-C 退出，会自动收尾后台进程）
# 想零安装直接体验？直接开线上版：https://yunyueli.github.io/telos/app/
set -euo pipefail
cd "$(dirname "$0")"

bold() { printf "\033[1m%s\033[0m\n" "$1"; }
dim() { printf "\033[2m%s\033[0m\n" "$1"; }

# 1) 环境检查
command -v python3 >/dev/null 2>&1 || { echo "✗ 需要 python3（macOS 自带 / https://python.org）"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "✗ 需要 Node.js 18+（https://nodejs.org）"; exit 1; }

# 2) 配置：首次自动从模板生成 core/.env
if [ ! -f core/.env ]; then
  cp core/.env.example core/.env
  dim "已创建 core/.env（从 .env.example）"
fi

# 3) key 友好提示（没填也照常启动，应用会优雅降级 + 支持页面内配置）
if grep -q "sk-your-own-key-here" core/.env 2>/dev/null; then
  echo
  bold "还没填 LLM key —— 倒推 / 微课需要它"
  echo "  1) 到 https://platform.deepseek.com 拿一个 key（便宜、注册常送额度）"
  echo "  2) 把 core/.env 里的 TELOS_LLM_API_KEY= 改成你的 key，保存后刷新页面即可"
  dim "  （不想装也行：直接开线上版 https://yunyueli.github.io/telos/app/ ，零配置）"
  echo
fi

# 4) 前端依赖（仅首次）
if [ ! -d web/node_modules ]; then
  bold "首次安装前端依赖（约 1 分钟）…"
  (cd web && npm install --legacy-peer-deps)
fi

# 5) 起服务：倒推代理(:8787) 后台 + 网页(:3000) 前台；退出时收尾
bold "启动 Telos …"
(cd core && python3 serve.py) &
SERVE_PID=$!
cleanup() { kill "$SERVE_PID" >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM

# 等网页起来后自动开浏览器（best-effort，不阻塞）
(
  for _ in $(seq 1 60); do
    if curl -fsS -o /dev/null "http://localhost:3000" 2>/dev/null; then
      (command -v open >/dev/null 2>&1 && open "http://localhost:3000") \
        || (command -v xdg-open >/dev/null 2>&1 && xdg-open "http://localhost:3000") \
        || true
      break
    fi
    sleep 1
  done
) &

echo
bold "➜ 应用：http://localhost:3000"
dim   "➜ 倒推代理：http://127.0.0.1:8787   （应用已零配置自动连接）"
echo
(cd web && npm run dev)
