"use client";

// 部署更替自愈：CDN 的 HTML 缓存在新部署后可能仍引用旧哈希 chunk（文件已被替换→404），
// 动态 import 失败会让对应功能永久卡死（如导出）。这里全局捕获 chunk 加载失败 → 自动整页刷新一次
// 拉取新 HTML。60 秒冷却防死循环：刷新后若仍失败（真网络故障），不再连环重载。
import { useEffect } from "react";

const KEY = "telos:chunk-reload-at";
const CHUNK_ERR =
  /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk [^ ]* failed|error loading dynamically imported module/i;

export function ChunkGuard() {
  useEffect(() => {
    const recover = (msg: string) => {
      if (!CHUNK_ERR.test(msg)) return;
      let last = 0;
      try {
        last = Number(sessionStorage.getItem(KEY) || 0);
      } catch {
        return;
      }
      if (Date.now() - last < 60_000) return; // 冷却中：避免坏网络下的重载循环
      try {
        sessionStorage.setItem(KEY, String(Date.now()));
      } catch {
        return;
      }
      window.location.reload();
    };
    const onErr = (e: ErrorEvent) => recover(String(e.message || ""));
    const onRej = (e: PromiseRejectionEvent) => {
      const r = e.reason as { message?: string } | string | undefined;
      recover(String((typeof r === "object" && r?.message) || r || ""));
    };
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onRej);
    return () => {
      window.removeEventListener("error", onErr);
      window.removeEventListener("unhandledrejection", onRej);
    };
  }, []);
  return null;
}
