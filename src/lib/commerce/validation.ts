import { findPrice } from "./pricing";
import type { BillingCycle, Catalogue, MarketId } from "./types";

export interface Issue {
  id: string;
  severity: "error" | "warning";
  message: string;
  reason: string;
}

export interface Selection {
  planId: string;
  market: MarketId;
  cycle: BillingCycle;
  premiumAppIds: string[];
  connectorIds: string[];
  addonQty: Record<string, number>;
}

/**
 * Commercial validity of a tenant selection. Errors must be resolved before a
 * subscription can be confirmed; warnings are advisory.
 */
export function validateSelection(catalogue: Catalogue, sel: Selection): Issue[] {
  const issues: Issue[] = [];
  const plan = catalogue.plans.find((p) => p.id === sel.planId);

  if (!plan) {
    return [
      { id: "plan.missing", severity: "error", message: "No plan selected", reason: "Every subscription starts from a plan." },
    ];
  }
  if (!plan.active) {
    issues.push({
      id: `plan.inactive:${plan.id}`,
      severity: "error",
      message: `${plan.name} is no longer sellable`,
      reason: "The plan is inactive in the published catalogue.",
    });
  }
  if (!plan.eligibleMarkets.includes(sel.market)) {
    issues.push({
      id: `plan.market:${plan.id}`,
      severity: "error",
      message: `${plan.name} is not sold in this market`,
      reason: `The plan is not enabled for ${sel.market}. Choose another plan or market.`,
    });
  }
  const planPrice = findPrice(catalogue, plan.id, sel.market);
  if (!plan.custom && !planPrice?.quoteOnly) {
    const amount = sel.cycle === "monthly" ? planPrice?.monthly : planPrice?.annual;
    if (amount === null || amount === undefined) {
      issues.push({
        id: `plan.price:${plan.id}`,
        severity: "error",
        message: `${plan.name} has no ${sel.cycle} price in this market`,
        reason: "Pricing must exist in the published catalogue before the plan can be sold here.",
      });
    }
  }

  // Premium apps
  for (const id of sel.premiumAppIds) {
    const app = catalogue.apps.find((a) => a.id === id);
    if (!app || !app.active) {
      issues.push({
        id: `app.inactive:${id}`,
        severity: "error",
        message: `Premium App ${app?.name ?? id} is no longer available`,
        reason: "The app has been deactivated in the published catalogue. Remove it to continue.",
      });
      continue;
    }
    if (!app.eligiblePlans.includes(plan.id)) {
      issues.push({
        id: `app.plan:${id}`,
        severity: "error",
        message: `${app.name} is not available on ${plan.name}`,
        reason: "Remove the app, or move the tenant to a plan that allows it.",
      });
    }
    const rule = findPrice(catalogue, id, sel.market);
    const amount = sel.cycle === "monthly" ? rule?.monthly : rule?.annual;
    if (amount === null || amount === undefined) {
      issues.push({
        id: `app.price:${id}`,
        severity: "error",
        message: `${app.name} has no ${sel.cycle} price in this market`,
        reason: "Premium Apps cannot be added where no published price exists.",
      });
    }
  }

  // Connectors
  const standardSelected = sel.connectorIds.filter(
    (id) => catalogue.connectors.find((c) => c.id === id)?.classification === "Standard",
  );
  for (const id of sel.connectorIds) {
    const c = catalogue.connectors.find((x) => x.id === id);
    if (!c || !c.active) {
      issues.push({
        id: `conn.inactive:${id}`,
        severity: "error",
        message: `Connector ${c?.name ?? id} is no longer available`,
        reason: "The connector has been deactivated in the published catalogue. Remove it to continue.",
      });
      continue;
    }
    if (!c.eligiblePlans.includes(plan.id)) {
      issues.push({
        id: `conn.plan:${id}`,
        severity: "error",
        message: `${c.name} is not available on ${plan.name}`,
        reason: "Remove the connector, or select a plan that permits it.",
      });
    }
    if (c.hasRecurringPrice) {
      const rule = findPrice(catalogue, c.id, sel.market);
      const amount = sel.cycle === "monthly" ? rule?.monthly : rule?.annual;
      if (!c.quoteOnly && (amount === null || amount === undefined)) {
        issues.push({
          id: `conn.price:${id}`,
          severity: "error",
          message: `${c.name} has no ${sel.cycle} price in this market`,
          reason: "Publish a price for this connector in this market, or remove it.",
        });
      }
    }
    if (c.quoteOnly) {
      issues.push({
        id: `conn.quote:${id}`,
        severity: "warning",
        message: `${c.name} is quote-only`,
        reason: "It is excluded from calculated totals and must be priced through a custom quote.",
      });
    }
    if (c.professionalServicesRequired) {
      issues.push({
        id: `conn.ps:${id}`,
        severity: "warning",
        message: `${c.name} requires Aurumi-assisted implementation`,
        reason: "Professional services must be scheduled alongside this subscription.",
      });
    }
  }
  const includedConnectors = plan.custom ? null : (plan.includedStandardConnectors ?? 0);
  if (includedConnectors !== null && standardSelected.length > includedConnectors) {
    issues.push({
      id: "conn.limit",
      severity: "error",
      message: `Standard Connector allowance exceeded (${standardSelected.length} of ${includedConnectors})`,
      reason: `${plan.name} includes ${includedConnectors} Standard Connectors. Remove connectors or upgrade the plan.`,
    });
  }

  // Add-ons
  for (const [id, qty] of Object.entries(sel.addonQty)) {
    if (!qty) continue;
    const a = catalogue.addOns.find((x) => x.id === id);
    if (!a || !a.active) {
      issues.push({
        id: `addon.inactive:${id}`,
        severity: "error",
        message: `Add-on ${a?.name ?? id} is no longer available`,
        reason: "Reset the quantity to zero to continue.",
      });
      continue;
    }
    if (!a.eligiblePlans.includes(plan.id)) {
      issues.push({
        id: `addon.plan:${id}`,
        severity: "error",
        message: `${a.name} is not available on ${plan.name}`,
        reason: "Reset the quantity, or change plan.",
      });
    }
    if (!a.eligibleMarkets.includes(sel.market)) {
      issues.push({
        id: `addon.market:${id}`,
        severity: "error",
        message: `${a.name} is not sold in this market`,
        reason: "Reset the quantity, or change market.",
      });
    }
    if (qty % a.quantityStep !== 0) {
      issues.push({
        id: `addon.step:${id}`,
        severity: "error",
        message: `${a.name} must be purchased in increments of ${a.quantityStep}`,
        reason: `Selected ${qty}. Adjust to a multiple of ${a.quantityStep}.`,
      });
    }
    if (qty < a.minQuantity) {
      issues.push({
        id: `addon.min:${id}`,
        severity: "error",
        message: `${a.name} minimum quantity is ${a.minQuantity}`,
        reason: `Selected ${qty}.`,
      });
    }
    if (a.maxQuantity !== null && qty > a.maxQuantity) {
      issues.push({
        id: `addon.max:${id}`,
        severity: "error",
        message: `${a.name} maximum quantity is ${a.maxQuantity}`,
        reason: `Selected ${qty}.`,
      });
    }
    const rule = findPrice(catalogue, id, sel.market);
    const amount = sel.cycle === "monthly" ? rule?.monthly : rule?.annual;
    if (amount === null || amount === undefined) {
      issues.push({
        id: `addon.price:${id}`,
        severity: "error",
        message: `${a.name} has no ${sel.cycle} price in this market`,
        reason: "Publish a price for this add-on, or reset the quantity.",
      });
    }
  }

  if (plan.custom) {
    issues.push({
      id: "plan.custom",
      severity: "warning",
      message: `${plan.name} is quoted commercially`,
      reason: "Capacity and price are agreed per contract, so calculated totals are indicative only.",
    });
  }

  return issues;
}

/** Catalogue-level consistency checks — errors block publishing. */
export function validateCatalogue(catalogue: Catalogue): Issue[] {
  const issues: Issue[] = [];

  for (const plan of catalogue.plans.filter((p) => p.active)) {
    if (!plan.custom) {
      const missing = (
        [
          ["included users", plan.includedUsers],
          ["included Standard Connectors", plan.includedStandardConnectors],
          ["Intelligence capacity", plan.includedIntelligence],
          ["storage", plan.includedStorageGb],
          ["data transfer", plan.includedTransferGb],
        ] as const
      ).filter(([, v]) => v === null || v === undefined || (v as number) < 0);
      for (const [label] of missing) {
        issues.push({
          id: `plan.capacity:${plan.id}:${label}`,
          severity: "error",
          message: `${plan.name} is missing ${label}`,
          reason: "Non-custom plans must define every capacity because entitlements are derived from them.",
        });
      }
    }
    for (const market of plan.eligibleMarkets) {
      const rule = findPrice(catalogue, plan.id, market);
      if (!rule) {
        issues.push({
          id: `plan.norule:${plan.id}:${market}`,
          severity: "error",
          message: `${plan.name} has no price row for ${market}`,
          reason: "A plan sold in a market needs a pricing rule in that market.",
        });
        continue;
      }
      if (!plan.custom && !rule.quoteOnly && (rule.monthly === null || rule.annual === null)) {
        issues.push({
          id: `plan.emptyprice:${plan.id}:${market}`,
          severity: "error",
          message: `${plan.name} has an incomplete price in ${market}`,
          reason: "Both monthly and annual amounts are required unless the plan is quote-only.",
        });
      }
    }
  }

  for (const a of catalogue.addOns.filter((x) => x.active)) {
    if (a.unitSize <= 0 || a.quantityStep <= 0) {
      issues.push({
        id: `addon.units:${a.id}`,
        severity: "error",
        message: `${a.name} has an invalid unit size or increment`,
        reason: "Unit size and increment must be greater than zero.",
      });
    }
    if (a.maxQuantity !== null && a.maxQuantity < a.minQuantity) {
      issues.push({
        id: `addon.range:${a.id}`,
        severity: "error",
        message: `${a.name} maximum quantity is below its minimum`,
        reason: "Correct the quantity range before publishing.",
      });
    }
  }

  for (const app of catalogue.apps.filter((x) => x.classification === "Premium" && x.active)) {
    const priced = catalogue.markets.some((m) => {
      const r = findPrice(catalogue, app.id, m.id);
      return r && (r.monthly !== null || r.annual !== null);
    });
    if (!priced) {
      issues.push({
        id: `app.noprice:${app.id}`,
        severity: "error",
        message: `Premium App ${app.name} has no price in any market`,
        reason: "Premium Apps are sold as add-ons and require a price.",
      });
    }
  }

  for (const p of catalogue.promotions.filter((x) => x.active)) {
    if (p.endDate < p.startDate) {
      issues.push({
        id: `promo.dates:${p.id}`,
        severity: "error",
        message: `Promotion ${p.name} ends before it starts`,
        reason: "Correct the promotion window.",
      });
    }
    if (!p.eligiblePlans.length || !p.eligibleMarkets.length) {
      issues.push({
        id: `promo.scope:${p.id}`,
        severity: "warning",
        message: `Promotion ${p.name} applies to no plan or market`,
        reason: "It can never be redeemed as configured.",
      });
    }
  }

  return issues;
}
