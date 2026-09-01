import { findPrice } from "./pricing";
import { bundleComponents } from "./bundles";
import type { BillingCycle, Catalogue, Connector, MarketId } from "./types";

/** Any catalogue entity a commercial component may be priced against. */
function productExists(catalogue: Catalogue, productId: string): boolean {
  const base = productId.replace(/:setup$/, "");
  return (
    catalogue.plans.some((p) => p.id === base) ||
    catalogue.apps.some((a) => a.id === base) ||
    catalogue.connectors.some((c) => c.id === base) ||
    catalogue.addOns.some((a) => a.id === base) ||
    (catalogue.auraOffers ?? []).some((o) => o.id === base) ||
    (catalogue.bundles ?? []).some((b) => b.id === base)
  );
}

/** True when a connector has at least one calculable payable amount in this selection. */
function hasCalculableAmount(catalogue: Catalogue, c: Connector, sel: Selection): boolean {
  if (c.hasRecurringPrice) {
    const rule = findPrice(catalogue, c.id, sel.market);
    const amount = sel.cycle === "monthly" ? rule?.monthly : rule?.annual;
    if (rule && !rule.quoteOnly && amount !== null && amount !== undefined) return true;
  }
  if (c.hasOneTimePrice) {
    const setup = findPrice(catalogue, `${c.id}:setup`, sel.market);
    if (setup && !setup.quoteOnly && setup.monthly !== null && setup.monthly !== undefined) return true;
  }
  return false;
}

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
 * A configuration needs a commercial quote when any selected item has no
 * calculable amount (custom plan, quote-only price rule or connector).
 * Such a configuration must never enter simulated payment.
 */
export function quoteReasons(catalogue: Catalogue, sel: Selection): string[] {
  const reasons: string[] = [];
  const plan = catalogue.plans.find((p) => p.id === sel.planId);
  if (plan?.custom) reasons.push(`${plan.name} is priced by contract`);
  const planRule = findPrice(catalogue, sel.planId, sel.market);
  if (planRule?.quoteOnly && !plan?.custom) reasons.push(`${plan?.name ?? sel.planId} is quote-only in this market`);
  for (const id of sel.connectorIds) {
    const c = catalogue.connectors.find((x) => x.id === id);
    if (!c) continue;
    if (c.quoteOnly) reasons.push(`${c.name} is a quote-only connector`);
    else if (findPrice(catalogue, id, sel.market)?.quoteOnly) reasons.push(`${c.name} has a quote-only price`);
    else if (connectorRequiresQuote(catalogue, c, sel)) {
      reasons.push(`${c.name} has a custom commercial treatment — quote required`);
    }
  }
  return reasons;
}

export function requiresQuote(catalogue: Catalogue, sel: Selection): boolean {
  return quoteReasons(catalogue, sel).length > 0;
}

/**
 * A bespoke-commercial-treatment connector whose amount cannot be calculated
 * in this selection must be quoted — never charged as $0 or sent to payment.
 */
export function connectorRequiresQuote(catalogue: Catalogue, c: Connector, sel: Selection): boolean {
  return Boolean(c.customCommercialTreatment) && !c.quoteOnly && !hasCalculableAmount(catalogue, c, sel);
}

/** Add-ons with a non-zero quantity that the current plan/market no longer allows. */
export function ineligibleAddOnSelections(catalogue: Catalogue, sel: Selection) {
  const out: { id: string; name: string; quantity: number; reason: string }[] = [];
  const plan = catalogue.plans.find((p) => p.id === sel.planId);
  for (const [id, qty] of Object.entries(sel.addonQty)) {
    if (!qty) continue;
    const a = catalogue.addOns.find((x) => x.id === id);
    if (!a) {
      out.push({ id, name: id, quantity: qty, reason: "This add-on no longer exists in the published catalogue." });
      continue;
    }
    if (!a.active) {
      out.push({ id, name: a.name, quantity: qty, reason: "This add-on is no longer sold." });
      continue;
    }
    if (!a.eligiblePlans.includes(sel.planId)) {
      out.push({
        id,
        name: a.name,
        quantity: qty,
        reason: `Not available on ${plan?.name ?? sel.planId}.`,
      });
      continue;
    }
    if (!a.eligibleMarkets.includes(sel.market)) {
      out.push({ id, name: a.name, quantity: qty, reason: `Not sold in ${sel.market}.` });
      continue;
    }
    const rule = findPrice(catalogue, id, sel.market);
    const amount = sel.cycle === "monthly" ? rule?.monthly : rule?.annual;
    if (amount === null || amount === undefined) {
      out.push({ id, name: a.name, quantity: qty, reason: `No ${sel.cycle} price published in ${sel.market}.` });
    }
  }
  return out;
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
      if (!c.quoteOnly && !connectorRequiresQuote(catalogue, c, sel) && (amount === null || amount === undefined)) {
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
    } else if (connectorRequiresQuote(catalogue, c, sel)) {
      issues.push({
        id: `conn.custom-quote:${id}`,
        severity: "warning",
        message: `${c.name} has a custom commercial treatment`,
        reason: "Its amount cannot be calculated, so it is excluded from payable totals and requires a quote.",
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
    if (!Number.isFinite(qty) || qty < 0 || !Number.isInteger(qty)) {
      issues.push({
        id: `addon.qtyvalue:${id}`,
        severity: "error",
        message: `${a.name} quantity is invalid`,
        reason: "Quantity must be a whole, non-negative number.",
      });
      continue;
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

  // Every sellable Additional / Custom Connector needs an explicit commercial treatment.
  for (const c of catalogue.connectors.filter(
    (x) => x.active && x.classification !== "Standard" && x.status !== "Planned" && x.status !== "Deprecated",
  )) {
    const treated =
      c.hasRecurringPrice ||
      c.hasOneTimePrice ||
      c.quoteOnly ||
      Boolean(c.customCommercialTreatment && c.customCommercialTreatment.trim());
    if (!treated) {
      issues.push({
        id: `conn.treatment:${c.id}`,
        severity: "error",
        message: `${c.classification} Connector ${c.name} has no commercial treatment`,
        reason:
          "A sellable Additional/Custom Connector must have a recurring price, a one-time implementation price, be quote-only, or state an explicit custom commercial treatment.",
      });
    }
  }

  // Standalone Aura offers must be commercially coherent before publishing.
  for (const o of catalogue.auraOffers ?? []) {
    if (!o.active) continue;
    const connector = catalogue.connectors.find((c) => c.id === o.connectorId);
    if (!connector) {
      issues.push({
        id: `aura.connector:${o.id}`,
        severity: "error",
        message: `${o.name} refers to a connector that does not exist`,
        reason: "Select an existing connector for this standalone Aura offer.",
      });
      continue;
    }
    if (!connector.standaloneAuraOffering) {
      issues.push({
        id: `aura.standalone:${o.id}`,
        severity: "error",
        message: `${connector.name} is not enabled as a standalone Aura offering`,
        reason:
          "The connector works with Aura, but it may not be sold directly with Aura until Standalone Aura Offering is set to Yes.",
      });
    }
    if (o.status === "Available") {
      for (const market of o.eligibleMarkets) {
        const rule = findPrice(catalogue, o.id, market);
        if (!rule) {
          issues.push({
            id: `aura.norule:${o.id}:${market}`,
            severity: "error",
            message: `${o.name} has no price row for ${market}`,
            reason: "An offer sold in a market needs a pricing rule in that market.",
          });
          continue;
        }
        if (!o.quoteOnly && !rule.quoteOnly && (rule.monthly === null || rule.annual === null)) {
          issues.push({
            id: `aura.emptyprice:${o.id}:${market}`,
            severity: "error",
            message: `${o.name} has an incomplete price in ${market}`,
            reason: "Both monthly and annual amounts are required unless the offer is quote-only.",
          });
        }
      }
    }
    for (const id of o.enabledAddOnIds) {
      if (!catalogue.addOns.some((a) => a.id === id)) {
        issues.push({
          id: `aura.addon:${o.id}:${id}`,
          severity: "warning",
          message: `${o.name} enables an add-on that no longer exists (${id})`,
          reason: "Remove it from the offer configuration.",
        });
      }
    }
  }

  // Price integrity: amounts must be finite and non-negative.
  for (const r of catalogue.prices) {
    const bad = ([["monthly", r.monthly], ["annual", r.annual]] as const).filter(
      ([, v]) => v !== null && (!Number.isFinite(v) || (v as number) < 0),
    );
    for (const [field] of bad) {
      issues.push({
        id: `price.invalid:${r.productId}:${r.market}:${field}`,
        severity: "error",
        message: `${r.productId} has an invalid ${field} price in ${r.market}`,
        reason: "Prices must be finite, non-negative numbers.",
      });
    }
    if (!Number.isFinite(r.annualDiscountPct) || r.annualDiscountPct < 0 || r.annualDiscountPct > 100) {
      issues.push({
        id: `price.discount:${r.productId}:${r.market}`,
        severity: "error",
        message: `${r.productId} has an invalid annual discount in ${r.market}`,
        reason: "Annual discount must be between 0 and 100 percent.",
      });
    }
  }

  // Add-on quantity integrity.
  for (const a of catalogue.addOns.filter((x) => x.active)) {
    const ints: [string, number][] = [
      ["unit size", a.unitSize],
      ["increment", a.quantityStep],
      ["minimum quantity", a.minQuantity],
    ];
    if (a.maxQuantity !== null) ints.push(["maximum quantity", a.maxQuantity]);
    for (const [label, v] of ints) {
      if (!Number.isFinite(v) || v < 0 || !Number.isInteger(v)) {
        issues.push({
          id: `addon.qty:${a.id}:${label}`,
          severity: "error",
          message: `${a.name} has an invalid ${label}`,
          reason: "Quantities must be whole, finite, non-negative numbers.",
        });
      }
    }
  }

  // Plan capacity integrity.
  for (const p of catalogue.plans.filter((x) => x.active && !x.custom)) {
    for (const [label, v] of [
      ["included users", p.includedUsers],
      ["Intelligence capacity", p.includedIntelligence],
      ["storage", p.includedStorageGb],
      ["data transfer", p.includedTransferGb],
      ["included Standard Connectors", p.includedStandardConnectors],
    ] as const) {
      if (v !== null && v !== undefined && (!Number.isFinite(v) || v < 0)) {
        issues.push({
          id: `plan.badcapacity:${p.id}:${label}`,
          severity: "error",
          message: `${p.name} has an invalid ${label}`,
          reason: "Capacity values must be finite and non-negative.",
        });
      }
    }
  }

  // Promotion value integrity.
  for (const p of catalogue.promotions.filter((x) => x.active)) {
    if (!Number.isFinite(p.value) || p.value < 0) {
      issues.push({
        id: `promo.value:${p.id}`,
        severity: "error",
        message: `Promotion ${p.name} has an invalid value`,
        reason: "Discount values must be finite and non-negative.",
      });
    } else if ((p.type === "percentage" || p.type === "first_period") && p.value > 100) {
      issues.push({
        id: `promo.pct:${p.id}`,
        severity: "error",
        message: `Promotion ${p.name} discounts more than 100%`,
        reason: "Percentage discounts must be between 0 and 100.",
      });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(p.endDate)) {
      issues.push({
        id: `promo.datefmt:${p.id}`,
        severity: "error",
        message: `Promotion ${p.name} has an invalid date`,
        reason: "Start and end dates must be valid calendar dates (YYYY-MM-DD).",
      });
    }
  }

  // Bundles must be commercially coherent before they can be published.
  // A bundle packages existing connectors under its own price: we never require
  // per-connector prices, a price sum, or availability in every market.
  for (const b of catalogue.bundles ?? []) {
    if (!b.active) continue;
    const label = b.name || b.id;

    if (!b.id || !b.slug || !b.name) {
      issues.push({
        id: `bundle.identity:${b.id || b.slug || "unknown"}`,
        severity: "error",
        message: `Bundle ${label} has an incomplete identity`,
        reason: "A bundle needs an id, a URL slug and a name before it can be published.",
      });
    }

    for (const id of b.connectorIds) {
      if (!catalogue.connectors.some((c) => c.id === id)) {
        issues.push({
          id: `bundle.connector:${b.id}:${id}`,
          severity: "error",
          message: `${label} references a connector that no longer exists (${id})`,
          reason: "Remove the reference or restore the connector before publishing.",
        });
      }
    }

    const components = bundleComponents(b);
    if (!components.length || (!b.connectorIds.length && !components.length)) {
      issues.push({
        id: `bundle.empty:${b.id}`,
        severity: "error",
        message: `${label} packages nothing`,
        reason: "A bundle must include at least one connector or commercial component.",
      });
    }
    for (const c of components) {
      if (c.connectorId && !catalogue.connectors.some((x) => x.id === c.connectorId)) {
        issues.push({
          id: `bundle.compconn:${b.id}:${c.id}`,
          severity: "error",
          message: `${label} component "${c.label}" points at a missing connector`,
          reason: "Every bundle component must resolve to a catalogue connector.",
        });
      }
      const needsProduct = c.treatment === "recurring" || c.treatment === "one_time";
      if (needsProduct) {
        if (!c.productId) {
          issues.push({
            id: `bundle.compproduct:${b.id}:${c.id}`,
            severity: "error",
            message: `${label} component "${c.label}" is payable but has no product`,
            reason: "A recurring or one-time component must reference a priceable product.",
          });
        } else if (!productExists(catalogue, c.productId)) {
          issues.push({
            id: `bundle.compdangling:${b.id}:${c.id}`,
            severity: "error",
            message: `${label} component "${c.label}" references a product that does not exist (${c.productId})`,
            reason: "Dangling commercial references cannot be priced.",
          });
        }
      }
    }

    if (b.status === "Available") {
      if (!b.eligibleMarkets.length) {
        issues.push({
          id: `bundle.nomarket:${b.id}`,
          severity: "error",
          message: `${label} is marked Available but sold in no market`,
          reason: "Select the markets the bundle is offered in, or set its status back to Draft.",
        });
      }
      for (const market of b.eligibleMarkets) {
        const m = catalogue.markets.find((x) => x.id === market);
        if (!m || !m.currency) {
          issues.push({
            id: `bundle.market:${b.id}:${market}`,
            severity: "error",
            message: `${label} is offered in an unknown market (${market})`,
            reason: "Bundle markets must exist in the catalogue with a valid currency.",
          });
          continue;
        }
        if (b.quoteOnly) continue;
        const rule = findPrice(catalogue, b.id, market);
        if (!rule) {
          issues.push({
            id: `bundle.norule:${b.id}:${market}`,
            severity: "error",
            message: `${label} has no price row for ${m.name}`,
            reason:
              "Add pricing for this market, remove the market, or make the bundle quote-only there.",
          });
          continue;
        }
        if (rule.quoteOnly) continue;
        const amounts: [string, number | null][] = [
          ["monthly", rule.monthly],
          ["annual", rule.annual],
        ];
        for (const [field, v] of amounts) {
          if (v === null || v === undefined) {
            issues.push({
              id: `bundle.emptyprice:${b.id}:${market}:${field}`,
              severity: "error",
              message: `${label} has no ${field} price in ${m.name}`,
              reason: "Both billing cycles need an amount unless the bundle is quote-only there.",
            });
          } else if (!Number.isFinite(v) || v < 0) {
            issues.push({
              id: `bundle.badprice:${b.id}:${market}:${field}`,
              severity: "error",
              message: `${label} has an invalid ${field} price in ${m.name}`,
              reason: "Prices must be finite, non-negative numbers.",
            });
          }
        }
      }
    }

    for (const id of b.enabledAddOnIds) {
      if (!catalogue.addOns.some((a) => a.id === id)) {
        issues.push({
          id: `bundle.addon:${b.id}:${id}`,
          severity: "warning",
          message: `${label} enables an add-on that no longer exists (${id})`,
          reason: "Remove it from the bundle configuration.",
        });
      }
    }
  }

  return issues;

}
