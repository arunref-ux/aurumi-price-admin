import { computeTotals, findPrice } from "./pricing";
import type { Selection } from "./validation";
import type { CartLine, Catalogue, OrderTotals, Promotion } from "./types";

export type ChargeClass = "included" | "add_on" | "additional_charge" | "custom_quote";

export interface PricedLine extends CartLine {
  chargeClass: ChargeClass;
}

/**
 * Turns a commercial selection into priced cart lines. All price lookup and
 * classification lives here — never in UI components.
 */
export function buildLines(catalogue: Catalogue, sel: Selection): PricedLine[] {
  const lines: PricedLine[] = [];
  const plan = catalogue.plans.find((p) => p.id === sel.planId);
  const amountFor = (productId: string, recurring = true): number | null => {
    const rule = findPrice(catalogue, productId, sel.market);
    if (!rule) return null;
    if (!recurring) return rule.monthly;
    return sel.cycle === "monthly" ? rule.monthly : rule.annual;
  };

  if (plan) {
    const rule = findPrice(catalogue, plan.id, sel.market);
    const quoteOnly = plan.custom || Boolean(rule?.quoteOnly);
    lines.push({
      id: `plan-${plan.id}`,
      productId: plan.id,
      kind: "plan",
      label: `${plan.name} plan (${sel.cycle === "monthly" ? "monthly" : "annual"})`,
      quantity: 1,
      unitAmount: amountFor(plan.id) ?? 0,
      recurring: true,
      quoteOnly,
      chargeClass: quoteOnly ? "custom_quote" : "add_on",
    });
  }

  for (const id of sel.premiumAppIds) {
    const app = catalogue.apps.find((a) => a.id === id);
    if (!app) continue;
    lines.push({
      id: `app-${id}`,
      productId: id,
      kind: "premium_app",
      label: `Premium App · ${app.name}`,
      quantity: 1,
      unitAmount: amountFor(id) ?? 0,
      recurring: true,
      chargeClass: "add_on",
    });
  }

  const includedStandard = plan?.custom ? null : (plan?.includedStandardConnectors ?? 0);
  let standardUsed = 0;
  for (const id of sel.connectorIds) {
    const c = catalogue.connectors.find((x) => x.id === id);
    if (!c) continue;
    const isStandard = c.classification === "Standard";
    if (isStandard) standardUsed += 1;
    const withinAllowance =
      isStandard && (includedStandard === null || standardUsed <= includedStandard);

    if (isStandard && withinAllowance && !c.hasRecurringPrice) {
      lines.push({
        id: `conn-${id}`,
        productId: id,
        kind: "connector",
        label: `Standard Connector · ${c.name}`,
        quantity: 1,
        unitAmount: 0,
        recurring: true,
        chargeClass: "included",
      });
    } else if (c.hasRecurringPrice) {
      lines.push({
        id: `conn-${id}`,
        productId: id,
        kind: "connector",
        label: `${c.classification} Connector · ${c.name}`,
        quantity: 1,
        unitAmount: amountFor(id) ?? 0,
        recurring: true,
        quoteOnly: c.quoteOnly,
        chargeClass: c.quoteOnly ? "custom_quote" : "additional_charge",
      });
    } else if (c.quoteOnly) {
      lines.push({
        id: `conn-quote-${id}`,
        productId: id,
        kind: "connector",
        label: `${c.name} — custom integration`,
        quantity: 1,
        unitAmount: 0,
        recurring: true,
        quoteOnly: true,
        chargeClass: "custom_quote",
      });
    }

    if (c.hasOneTimePrice) {
      lines.push({
        id: `conn-setup-${id}`,
        productId: `${id}:setup`,
        kind: "connector_setup",
        label: `Implementation · ${c.name}`,
        quantity: 1,
        unitAmount: amountFor(`${id}:setup`, false) ?? 0,
        recurring: false,
        quoteOnly: c.quoteOnly,
        chargeClass: c.quoteOnly ? "custom_quote" : "additional_charge",
      });
    }
  }

  for (const [id, qty] of Object.entries(sel.addonQty)) {
    if (!qty) continue;
    const addon = catalogue.addOns.find((a) => a.id === id);
    if (!addon) continue;
    lines.push({
      id: `addon-${id}`,
      productId: id,
      kind: "addon",
      label: `${addon.name} × ${qty} (${(qty * addon.unitSize).toLocaleString()} ${addon.unit})`,
      quantity: qty,
      unitAmount: amountFor(id, addon.recurring) ?? 0,
      recurring: addon.recurring,
      chargeClass: "add_on",
    });
  }

  return lines;
}

export interface QuoteResult {
  lines: PricedLine[];
  totals: OrderTotals;
  appliedPromotions: Promotion[];
}

export function buildQuote(
  catalogue: Catalogue,
  sel: Selection,
  promotions: Promotion[] = [],
): QuoteResult {
  const lines = buildLines(catalogue, sel);
  return {
    lines,
    totals: computeTotals(catalogue, lines, sel.market, sel.cycle, promotions),
    appliedPromotions: promotions,
  };
}

/** Capacity derived from add-on quantities, using catalogue unit sizes. */
export function addOnCapacities(catalogue: Catalogue, addonQty: Record<string, number>) {
  const size = (id: string) => catalogue.addOns.find((a) => a.id === id)?.unitSize ?? 1;
  return {
    additionalUsers: (addonQty["addon.users"] ?? 0) * size("addon.users"),
    additionalStorageGb: (addonQty["addon.storage"] ?? 0) * size("addon.storage"),
    additionalIntelligence: (addonQty["addon.intelligence"] ?? 0) * size("addon.intelligence"),
    additionalTransferGb: (addonQty["addon.transfer"] ?? 0) * size("addon.transfer"),
  };
}

export const CHARGE_CLASS_LABEL: Record<ChargeClass, string> = {
  included: "Included",
  add_on: "Add-on",
  additional_charge: "Additional charge",
  custom_quote: "Custom / quote",
};
