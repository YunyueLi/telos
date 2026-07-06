// 付费方案单一配置：价格 / Creem product_id / 免费版限额，全部在这一个文件改。
// 服务商 = Merchant of Record（托管收银台 + 代缴税费），webhook 打到 workers/derive.js 的 /billing/webhook，
// 由 Worker 用 service_role 把权益写进 Supabase app_metadata（用户不可自改）→ 前端 billing.ts 读取。
//
// 上线步骤（创建产品后把空字符串填上即可，代码不用再动）：
// 1) 在服务商后台创建 3 个产品/价格：月付订阅 / 年付订阅 / 买断。
// 2) 把各自的 product_id 填进下方 productId；订阅管理默认走 Worker 动态生成 Customer Portal。
// 3) Webhook 指到 <worker>/billing/webhook，secret 用 `wrangler secret put BILLING_WEBHOOK_SECRET` 设置。
// 4) product_id 也要同步到 workers/wrangler.toml 的 CREEM_PRODUCT_*，Worker 会以服务端映射为准。

export type Plan = "monthly" | "yearly" | "lifetime";
export type PackSku = "pack_d10" | "pack_l200";
export type BillingSku = Plan | PackSku | `tpl_${string}`;

export const BILLING = {
  // "creem" | "lemonsqueezy" —— 与 Worker 端 env BILLING_PROVIDER 保持一致
  provider: "creem" as "creem" | "lemonsqueezy",
  // 免费版最多学习项目数（Pro 无限）
  freeProjectLimit: 3,
  // 展示价格（仅展示用；实收以收银台为准，服务商会按地区本地化）
  plans: {
    monthly: { productId: "PRODUCT_ID_REDACTED", price: "$2.9", save: "" },
    yearly: { productId: "PRODUCT_ID_REDACTED", price: "$19", save: "-45%" },
    lifetime: { productId: "PRODUCT_ID_REDACTED", price: "$49", save: "" },
  } as Record<Plan, { productId: string; price: string; save: string }>,
  // 可选：外部固定管理页；留空则由 Worker 按登录用户动态生成 Creem Customer Portal。
  manageUrl: "",
  // 托管 AI 配额（展示用——真源在 workers/wrangler.toml 的 HOSTED_* vars，两处保持一致）
  hosted: {
    proDerives: 30,
    proLessons: 600,
    trialDerives: 3,
    trialLessons: 60,
  },
  // 加油包（创建产品后填 product_id；plan 传 pack_d10 / pack_l200 这类 SKU 码，webhook 自动充值）
  packs: [
    { sku: "pack_d10" as const, price: "$1.9", label: "+10", unit: "d" as const, productId: "PRODUCT_ID_REDACTED" },
    { sku: "pack_l200" as const, price: "$1.9", label: "+200", unit: "l" as const, productId: "PRODUCT_ID_REDACTED" },
  ],
  // 模板店若使用一个通用 Creem 产品，在这里填 product_id；否则在每个模板 meta 上填自己的 productId。
  templateProductId: "",
};

export function billingConfigured(): boolean {
  return Boolean(BILLING.plans.monthly.productId || BILLING.plans.yearly.productId || BILLING.plans.lifetime.productId);
}

export function productConfigured(sku: BillingSku | string, productId?: string): boolean {
  const plan = BILLING.plans[sku as Plan];
  if (plan?.productId) return true;
  if (BILLING.packs.some((p) => p.sku === sku && p.productId)) return true;
  if (String(sku).startsWith("tpl_")) return Boolean(productId || BILLING.templateProductId);
  return false;
}
