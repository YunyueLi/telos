// Base path for static assets referenced by raw <img>/href (Next does NOT
// auto-prefix those with basePath). Keep in sync with next.config.ts basePath.
export const BASE = process.env.NODE_ENV === "production" ? "/app" : "";

export const asset = (p: string): string => `${BASE}${p}`;
