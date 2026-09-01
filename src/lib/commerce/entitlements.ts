import type { AddOn, Catalogue, Entitlement, Plan, TenantSubscription } from "./types";

/**
 * PLAN -> ENTITLEMENTS.
 * Plan capacity fields are the single source of truth; entitlements are always
 * derived from them, never stored separately.
 */
export function planEntitlements(plan: Plan): Entitlement[] {
  const out: Entitlement[] = [
    { key: "apps.standard.all", label: "All Standard Aurumi Apps", source: plan.id },
    { key: "support.level", label: plan.supportLevel, source: plan.id },
  ];
  if (plan.custom) {
    out.push(
      { key: "governance.advanced", label: "Advanced administration & governance", source: plan.id },
      { key: "sla", label: "Custom SLA", source: plan.id },
    );
    return out;
  }
  const numeric: Array<[Entitlement["key"], number | null, string]> = [
    ["users.included", plan.includedUsers, "users"],
    ["connectors.standard.quantity", plan.includedStandardConnectors, "connectors"],
    ["capacity.intelligence", plan.includedIntelligence, "AIC/mo"],
    ["capacity.storage", plan.includedStorageGb, "GB"],
    ["capacity.transfer", plan.includedTransferGb, "GB/mo"],
  ];
  for (const [key, value, unit] of numeric) {
    if (value !== null) out.push({ key, value, unit, source: plan.id });
  }
  return out;
}

function addOn(catalogue: Catalogue, id: string): AddOn | undefined {
  return catalogue.addOns.find((a) => a.id === id);
}

/** Capacity delivered by `quantity` units of an add-on, from catalogue data. */
export function addOnCapacity(catalogue: Catalogue, addOnId: string, quantity: number): number {
  return (addOn(catalogue, addOnId)?.unitSize ?? 1) * quantity;
}

/** PLAN + ADD-ONS + PREMIUM APPS + CONNECTORS -> effective tenant entitlements. */
export function deriveEntitlements(
  catalogue: Catalogue,
  sub: Pick<
    TenantSubscription,
    | "planId"
    | "additionalUsers"
    | "premiumAppIds"
    | "standardConnectorIds"
    | "additionalConnectorIds"
    | "additionalIntelligence"
    | "additionalStorageGb"
    | "additionalTransferGb"
  >,
): Entitlement[] {
  const plan = catalogue.plans.find((p) => p.id === sub.planId);
  const out: Entitlement[] = plan ? planEntitlements(plan) : [];

  if (sub.additionalUsers > 0) {
    out.push({ key: "users.included", value: sub.additionalUsers, unit: "users", source: "addon.users" });
  }
  if (sub.additionalStorageGb > 0) {
    out.push({ key: "capacity.storage", value: sub.additionalStorageGb, unit: "GB", source: "addon.storage" });
  }
  if (sub.additionalIntelligence > 0) {
    out.push({
      key: "capacity.intelligence",
      value: sub.additionalIntelligence,
      unit: "AIC/mo",
      source: "addon.intelligence",
    });
  }
  if (sub.additionalTransferGb > 0) {
    out.push({ key: "capacity.transfer", value: sub.additionalTransferGb, unit: "GB/mo", source: "addon.transfer" });
  }
  for (const appId of sub.premiumAppIds) {
    const app = catalogue.apps.find((a) => a.id === appId);
    if (app) out.push({ key: "apps.premium", label: app.name, source: app.id });
  }
  if (sub.standardConnectorIds.length) {
    out.push({
      key: "connectors.standard.quantity",
      value: 0,
      unit: "connectors",
      label: `${sub.standardConnectorIds.length} allocated`,
      source: "subscription",
    });
  }
  if (sub.additionalConnectorIds.length) {
    out.push({
      key: "connectors.additional.quantity",
      value: sub.additionalConnectorIds.length,
      unit: "connectors",
      source: "subscription",
    });
  }
  return out;
}

export interface EntitlementSummaryRow {
  key: string;
  total: number;
  unit: string | undefined;
  labels: string[];
}

/** Roll up entitlements of the same key into a single effective allowance. */
export function summariseEntitlements(entitlements: Entitlement[]): EntitlementSummaryRow[] {
  const map = new Map<string, EntitlementSummaryRow>();
  for (const e of entitlements) {
    const row: EntitlementSummaryRow = map.get(e.key) ?? { key: e.key, total: 0, unit: e.unit, labels: [] };
    if (typeof e.value === "number") row.total += e.value;
    if (e.label) row.labels.push(e.label);
    if (e.unit) row.unit = e.unit;
    map.set(e.key, row);
  }
  return [...map.values()];
}

export const ENTITLEMENT_LABELS: Record<string, string> = {
  "aura.capability": "Aura (Talk to Your Business)",
  "aura.connector": "Business context connector",
  "users.included": "Users",
  "apps.standard.all": "Standard Apps",
  "apps.premium": "Premium Apps",
  "connectors.standard.quantity": "Standard Connectors",
  "connectors.additional.quantity": "Additional Connectors",
  "capacity.intelligence": "Intelligence Capacity",
  "capacity.storage": "Storage",
  "capacity.transfer": "Data Transfer",
  "support.level": "Support",
  "governance.advanced": "Governance",
  sla: "SLA",
};
