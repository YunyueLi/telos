import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

// Pin the workspace root to this app dir (a stray lockfile in $HOME otherwise
// makes Turbopack infer the wrong root).
const root = dirname(fileURLToPath(import.meta.url));

// Static export served under the custom domain https://telos.ungetsu.net/app/.
// Cloudflare Pages publishes the marketing landing page at / and this app under
// /app, so production keeps a stable /app basePath with no repository prefix.
const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  output: "export",
  basePath: isProd ? "/app" : undefined,
  trailingSlash: true,
  images: { unoptimized: true },
  turbopack: { root },
  // 隐藏开发模式左下角的 Next 指示按钮（仅 dev 出现，生产本就没有）
  devIndicators: false,
};

export default nextConfig;
