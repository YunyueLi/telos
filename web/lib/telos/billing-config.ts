// Community Edition keeps the product UI runnable without shipping official
// hosted-product checkout mappings. Hosted billing configuration lives outside
// the public repository.

export type Plan = "monthly" | "yearly" | "lifetime";
export type PackSku = "pack_d10" | "pack_l200";
export type BillingSku = Plan | PackSku | `tpl_${string}`;

export const BILLING = {
  provider: "community" as "community" | "creem" | "lemonsqueezy",
  freeProjectLimit: 3,
  plans: {
    monthly: { productId: "", price: "$2.9", save: "" },
    yearly: { productId: "", price: "$19", save: "-45%" },
    lifetime: { productId: "", price: "$49", save: "" },
  } as Record<Plan, { productId: string; price: string; save: string }>,
  manageUrl: "",
  hosted: {
    proDerives: 30,
    proLessons: 600,
    trialDerives: 3,
    trialLessons: 60,
  },
  packs: [
    { sku: "pack_d10" as const, price: "$1.9", label: "+10", unit: "d" as const, productId: "" },
    { sku: "pack_l200" as const, price: "$1.9", label: "+200", unit: "l" as const, productId: "" },
  ],
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
