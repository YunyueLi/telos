"use client";

// 付费状态（占位）：决定导出是否去水印等付费特权。
// 现在恒为 false（除非本机手动置 telos:pro=1 调试）→ 免费版导出带 Telos 水印 + 品牌条。
// 后续接入计费后，把这里改为读取真实订阅状态（如 Supabase user_metadata.telos_pro / 支付回调写入），
// 即可让付费用户导出无水印——调用点 (canvas 导出) 已按 !isPro() 传 watermark，无需再改。
export function isPro(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem("telos:pro") === "1";
  } catch {
    return false;
  }
}
