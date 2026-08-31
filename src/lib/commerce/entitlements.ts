import { ADDON_UNIT_SIZE } from "./seed";
import type { Catalogue, Entitlement, TenantSubscription } from "./types";

/** PLAN -> ENTITLEMENTS, plus ADD-ON / PREMIUM APP / CONNECTOR -> ADDITIONAL ENTITLEMENTS. */
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
  const out: Entitlement[] = plan ? plan.entitlements.map((e) => ({ ...e })) : [];

  if (sub.additionalUsers > 0) {
    out.push({
      key: "users.included",
      value: sub.additionalUsers * (ADDON_UNIT_SIZE["addon.users"] ?? 1),
      unit: "users",
      source: "addon.users",
    });
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
      value: sub.standardConnectorIds.length,
      unit: "allocated",
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

/** Roll up entitlements of the same key into a single effective allowance. */
export function summariseEntitlements(entitlements: Entitlement[]) {
  const map = new Map<string, { key: string; total: number; unit?: string; labels: string[] }>();
  for (const e of entitlements) {
    const row = map.get(e.key) ?? { key: e.key, total: 0, unit: e.unit, labels: [] };
    if (typeof e.value === "number") row.total += e.value;
    if (e.label) row.labels.push(e.label);
    if (e.unit) row.unit = e.unit;
    map.set(e.key, row);
  }
  return [...map.values()];
}

export const ENTITLEMENT_LABELS: Record<string, string> = {
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
