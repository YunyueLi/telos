"use client";

import { useEffect } from "react";
import { BASE } from "@/lib/base";

// 注册 service worker（仅生产）：离线缓存外壳 + 静态资源，使 Telos 可安装、可离线。
// dev 不注册——避免与 Turbopack HMR 冲突。scope 跟随 basePath（线上 /app/）。
export function PWARegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const onLoad = () => {
      navigator.serviceWorker.register(`${BASE}/sw-v4.js`, { scope: `${BASE}/` }).catch(() => {
        /* SW 注册失败不影响使用（如无 HTTPS / 不支持） */
      });
    };
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);
  return null;
}
