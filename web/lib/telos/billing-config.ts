// 付费方案单一配置：价格 / 收银台链接 / 免费版限额，全部在这一个文件改。
// 服务商 = Merchant of Record（托管收银台 + 代缴税费），webhook 打到 workers/derive.js 的 /billing/webhook，
// 由 Worker 用 service_role 把权益写进 Supabase app_metadata（用户不可自改）→ 前端 billing.ts 读取。
//
// 上线步骤（创建产品后把空字符串填上即可，代码不用再动）：
// 1) 在服务商后台创建 3 个产品/价格：月付订阅 / 年付订阅 / 买断。
// 2) 把各自的 checkout 链接填进下方 url；customer portal 链接填 manageUrl。
// 3) Webhook 指到 <worker>/billing/webhook，secret 用 `wrangler secret put BILLING_WEBHOOK_SECRET` 设置。

export type Plan = "monthly" | "yearly" | "lifetime";

export const BILLING = {
  // "creem" | "lemonsqueezy" —— 与 Worker 端 env BILLING_PROVIDER 保持一致
  provider: "creem" as "creem" | "lemonsqueezy",
  // 免费版最多学习项目数（Pro 无限）
  freeProjectLimit: 3,
  // 展示价格（仅展示用；实收以收银台为准，服务商会按地区本地化）
  plans: {
    monthly: { url: "", price: "$2.9", save: "" },
    yearly: { url: "", price: "$19", save: "-45%" },
    lifetime: { url: "", price: "$49", save: "" },
  } as Record<Plan, { url: string; price: string; save: string }>,
  // 用户自助管理/取消订阅（customer portal）
  manageUrl: "",
  // 托管 AI 配额（展示用——真源在 workers/wrangler.toml 的 HOSTED_* vars，两处保持一致）
  hosted: {
    proDerives: 30,
    proLessons: 600,
    trialDerives: 3,
    trialLessons: 60,
  },
  // 加油包（创建产品后填 checkout 链接；plan 传 pack_d10 / pack_l200 这类 SKU 码，webhook 自动充值）
  packs: [
    { sku: "pack_d10", price: "$1.9", label: "+10", unit: "d" as const, url: "" },
    { sku: "pack_l200", price: "$1.9", label: "+200", unit: "l" as const, url: "" },
  ],
};

export function billingConfigured(): boolean {
  return Boolean(BILLING.plans.monthly.url || BILLING.plans.yearly.url || BILLING.plans.lifetime.url);
}

// 收银台链接：带上 user_id + plan/SKU（webhook 回传后据此定位账号与方案；pack_* 走加油包充值）与预填邮箱。
export function checkoutUrl(plan: Plan | string, uid: string, email?: string): string {
  const base =
    BILLING.plans[plan as Plan]?.url || BILLING.packs.find((p) => p.sku === plan)?.url || "";
  if (!base) return "";
  const u = new URL(base);
  if (BILLING.provider === "lemonsqueezy") {
    u.searchParams.set("checkout[custom][user_id]", uid);
    u.searchParams.set("checkout[custom][plan]", plan);
    if (email) u.searchParams.set("checkout[email]", email);
  } else {
    // Creem：metadata 透传，webhook 在 object.metadata 取回
    u.searchParams.set("metadata[user_id]", uid);
    u.searchParams.set("metadata[plan]", plan);
    if (email) u.searchParams.set("customer_email", email);
  }
  return u.toString();
}
