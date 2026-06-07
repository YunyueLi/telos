#!/usr/bin/env python3
"""本地倒推服务：给网页 Demo 用的零依赖 HTTP 代理。

    POST /derive   {"goal": "..."}  -> {"goal":..., "points":[{id,name,prereqs,isGoal,minutes}]}
    GET  /health                    -> {"ok":true,"available":<bool>,"model":...}

key 从 core/.env 读取（在你自己机器上，不会外泄）。本服务默认只监听本机 127.0.0.1。
公开部署请改用 workers/derive.js（Cloudflare Worker，key 存后端 secret，不进前端）。

用法：
    python3 serve.py                 # 监听 127.0.0.1:8787
    TELOS_PORT=9000 python3 serve.py
然后让前端指向它：
    NEXT_PUBLIC_TELOS_DERIVE_URL=http://127.0.0.1:8787/derive
（或直接在网页"倒推"页里粘贴这个地址，免重新构建）
"""
from __future__ import annotations

import json
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from telos_core import llm


def _graph_to_json(goal: str, g) -> dict:
    """KnowledgeGraph -> 前端 engine.ts 能直接吃的形状（prereqs / isGoal 驼峰）。"""
    return {
        "goal": goal,
        "title": getattr(g, "title", ""),
        "points": [
            {
                "id": g[pid].id,
                "name": g[pid].name,
                "prereqs": list(g[pid].prerequisites),
                "isGoal": bool(g[pid].is_goal),
                "minutes": int(g[pid].minutes),
                "domain": g[pid].domain.value,
                "desc": g[pid].desc,
                "drill": g[pid].drill,
                "benchmark": g[pid].benchmark,
            }
            for pid in g.topological_order()
        ],
    }


class Handler(BaseHTTPRequestHandler):
    server_version = "TelosDerive/1.0"

    def _cors(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json(self, code: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):  # noqa: A002 - 安静一点的日志
        sys.stderr.write("· " + (fmt % args) + "\n")

    def do_OPTIONS(self):  # noqa: N802 - CORS 预检
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):  # noqa: N802
        if self.path.rstrip("/") in ("", "/health"):
            _, _, model = llm._config()
            self._json(200, {"ok": True, "available": llm.available(), "model": model})
        else:
            self._json(404, {"error": "not found"})

    def do_POST(self):  # noqa: N802
        path = self.path.rstrip("/")
        if path not in ("/derive", "/lesson", "/probe"):
            self._json(404, {"error": "not found"})
            return
        if not llm.available():
            self._json(503, {"error": "未配置 LLM key：在 core/.env 设置 TELOS_LLM_API_KEY（见 core/.env.example）"})
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            data = json.loads(self.rfile.read(length).decode("utf-8")) if length else {}
        except Exception:  # noqa: BLE001
            self._json(400, {"error": "请求体需为 JSON"})
            return
        if path == "/derive":
            goal = str(data.get("goal", "")).strip()
            if not goal:
                self._json(400, {"error": "goal 不能为空"})
                return
            try:
                g = llm.derive_graph(goal, lang=str(data.get("lang", "")))
            except Exception as e:  # noqa: BLE001
                self._json(502, {"error": str(e)})
                return
            self._json(200, _graph_to_json(goal, g))
        elif path == "/lesson":  # 按需微课
            name = str(data.get("name", "")).strip()
            if not name:
                self._json(400, {"error": "name 不能为空"})
                return
            prereqs = [str(p) for p in (data.get("prereqs") or [])]
            try:
                out = llm.lesson(name, str(data.get("domain", "B")), prereqs, str(data.get("goal", "")), lang=str(data.get("lang", "")))
            except Exception as e:  # noqa: BLE001
                self._json(502, {"error": str(e)})
                return
            self._json(200, out)
        else:  # /probe —— 起点诊断题（批量）
            points = data.get("points") or []
            if not isinstance(points, list) or not points:
                self._json(400, {"error": "points 不能为空"})
                return
            try:
                out = llm.probes(points, str(data.get("goal", "")), lang=str(data.get("lang", "")))
            except Exception as e:  # noqa: BLE001
                self._json(502, {"error": str(e)})
                return
            self._json(200, out)


def main() -> int:
    port = int(os.environ.get("TELOS_PORT", "8787"))
    host = os.environ.get("TELOS_HOST", "127.0.0.1")
    srv = ThreadingHTTPServer((host, port), Handler)
    status = "已配置 key ✓" if llm.available() else "未配置 key（见 core/.env.example）"
    print(f"Telos 倒推服务 → http://{host}:{port}   [{status}]")
    print(f"  健康检查 : curl http://{host}:{port}/health")
    print(f"  前端配置 : NEXT_PUBLIC_TELOS_DERIVE_URL=http://{host}:{port}/derive")
    print("  Ctrl-C 退出")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
