import { computeTotals, findPrice } from "./pricing";
import type { PricedLine } from "./cart";
import type {
  AuraCommercialTreatment,
  AuraOffer,
  AuraOfferComponent,
  BillingCycle,
  Catalogue,
  Entitlement,
  MarketId,
  OrderTotals,
} from "./types";
import type { Issue } from "./validation";

/**
 * Standalone Aura commerce.
 *
 * Aura is the product/capability ("Talk to Your Business" outwardly). A
 * connector is the business-context source. A standalone Aura offering is the
 * commercial combination of the two, sold WITHOUT an Aurumi Workspace plan.
 * Nothing here changes the Workspace model.
 */
export interface AuraSelection {
  offerId: string;
  market: MarketId;
  cycle: BillingCycle;
  addonQty: Record<string, number>;
}

export function findAuraOffer(catalogue: Catalogue, offerId: string): AuraOffer | undefined {
  return catalogue.auraOffers?.find((o) => o.id === offerId);
}

/** Offers that may be sold standalone right now, in this market. */
export function sellableAuraOffers(catalogue: Catalogue, market?: MarketId): AuraOffer[] {
  return (catalogue.auraOffers ?? []).filter((o) => {
    const connector = catalogue.connectors.find((c) => c.id === o.connectorId);
    return (
      o.active &&
      o.status === "Available" &&
      Boolean(connector?.active) &&
      Boolean(connector?.standaloneAuraOffering) &&
      (!market || o.eligibleMarkets.includes(market))
    );
  });
}

/** Add-ons explicitly enabled for this offer, and sellable in this market. */
export function auraOfferAddOns(catalogue: Catalogue, offer: AuraOffer, market: MarketId) {
  return catalogue.addOns.filter(
    (a) => a.active && offer.enabledAddOnIds.includes(a.id) && a.eligibleMarkets.includes(market),
  );
}

/**
 * Commercial components of an offer, resolved against the catalogue for one
 * market. Components are the explicit commercial model: recurring, one-time,
 * included or quote-required. A priced component whose price cannot be
 * calculated degrades to "quote_required" rather than showing a misleading 0.
 */
export interface ResolvedAuraComponent {
  id: string;
  label: string;
  kind: AuraOfferComponent["kind"];
  treatment: AuraCommercialTreatment;
  note?: string | undefined;
  required: boolean;
  monthly: number | null;
  annual: number | null;
  oneTime: number | null;
}

/** Offers written before the component model get an implicit Aura recurring charge. */
export function auraOfferComponents(offer: AuraOffer): AuraOfferComponent[] {
  if (Array.isArray(offer.components) && offer.components.length) return offer.components;
  return [
    {
      id: `${offer.id}:aura`,
      label: "Aura",
      kind: "aura",
      treatment: offer.quoteOnly ? "quote_required" : "recurring",
      productId: offer.id,
      required: true,
    },
  ];
}

export function auraCommercialComponents(
  catalogue: Catalogue,
  offer: AuraOffer,
  market: MarketId,
): ResolvedAuraComponent[] {
  const out: ResolvedAuraComponent[] = auraOfferComponents(offer).map((c) => {
    const base: ResolvedAuraComponent = {
      id: c.id,
      label: c.label,
      kind: c.kind,
      treatment: c.treatment,
      note: c.note,
      required: c.required !== false,
      monthly: null,
      annual: null,
      oneTime: null,
    };
    if (c.treatment === "included" || c.treatment === "quote_required") return base;

    const rule = c.productId ? findPrice(catalogue, c.productId, market) : undefined;
    const quoted = offer.quoteOnly || !rule || Boolean(rule.quoteOnly);

    if (c.treatment === "one_time") {
      const amount = rule?.monthly ?? null;
      if (quoted || amount === null) return { ...base, treatment: "quote_required" };
      return { ...base, oneTime: amount };
    }
    if (quoted || rule?.monthly === null || rule?.annual === null) {
      return { ...base, treatment: "quote_required" };
    }
    return { ...base, monthly: rule!.monthly, annual: rule!.annual };
  });

  const connector = catalogue.connectors.find((c) => c.id === offer.connectorId);
  if (connector?.quoteOnly && !out.some((c) => c.kind === "connector")) {
    out.push({
      id: `${offer.id}:connector`,
      label: `${connector.name} connection`,
      kind: "connector",
      treatment: "quote_required",
      required: true,
      monthly: null,
      annual: null,
      oneTime: null,
    });
  }
  if (
    offer.professionalServicesRequired &&
    !out.some((c) => c.kind === "professional_services")
  ) {
    out.push({
      id: `${offer.id}:ps`,
      label: "Implementation / professional services",
      kind: "professional_services",
      treatment: "quote_required",
      required: true,
      monthly: null,
      annual: null,
      oneTime: null,
    });
  }
  return out;
}

export function auraQuoteReasons(catalogue: Catalogue, sel: AuraSelection): string[] {
  const offer = findAuraOffer(catalogue, sel.offerId);
  if (!offer) return [];
  const reasons: string[] = [];
  if (offer.quoteOnly) reasons.push(`${offer.name} is priced by quote`);
  for (const c of auraCommercialComponents(catalogue, offer, sel.market)) {
    if (c.treatment === "quote_required" && c.required) {
      reasons.push(`${c.label} requires a quote`);
    }
  }
  return reasons;
}

export function auraRequiresQuote(catalogue: Catalogue, sel: AuraSelection): boolean {
  return auraQuoteReasons(catalogue, sel).length > 0;
}

/** Commercial validity of a standalone Aura selection. No plan is involved. */
export function validateAuraSelection(catalogue: Catalogue, sel: AuraSelection): Issue[] {
  const issues: Issue[] = [];
  const offer = findAuraOffer(catalogue, sel.offerId);
  if (!offer) {
    return [
      {
        id: "aura.offer.missing",
        severity: "error",
        message: "No standalone Aura offering selected",
        reason: "A standalone Aura subscription starts from a published Aura + connector offer.",
      },
    ];
  }
  const connector = catalogue.connectors.find((c) => c.id === offer.connectorId);
  if (!offer.active || offer.status !== "Available") {
    issues.push({
      id: `aura.inactive:${offer.id}`,
      severity: "error",
      message: `${offer.name} is not currently sellable`,
      reason: "The offer is inactive or not yet available in the published catalogue.",
    });
  }
  if (!connector) {
    issues.push({
      id: `aura.connector.missing:${offer.id}`,
      severity: "error",
      message: `${offer.name} refers to a connector that no longer exists`,
      reason: "Reconfigure the offer in Standalone Aura Offers.",
    });
  } else if (!connector.standaloneAuraOffering) {
    issues.push({
      id: `aura.connector.notstandalone:${offer.id}`,
      severity: "error",
      message: `${connector.name} cannot be sold directly with Aura`,
      reason:
        "The connector still works with Aura, but it is not marked as a standalone Aura offering. It must be purchased through an Aurumi Workspace subscription.",
    });
  } else if (!connector.active) {
    issues.push({
      id: `aura.connector.inactive:${offer.id}`,
      severity: "error",
      message: `${connector.name} is no longer available`,
      reason: "Reactivate the connector, or retire this offer.",
    });
  }
  if (!offer.eligibleMarkets.includes(sel.market)) {
    issues.push({
      id: `aura.market:${offer.id}`,
      severity: "error",
      message: `${offer.name} is not sold in this market`,
      reason: "Enable the market on the offer, or choose another market.",
    });
  }
  // A component with no calculable price is not a blocking error — it routes
  // the configuration to DRAFT -> QUOTE REQUIRED (see auraQuoteReasons).
  for (const c of auraCommercialComponents(catalogue, offer, sel.market)) {
    if (c.treatment === "quote_required" && c.required) {
      issues.push({
        id: `aura.component.quote:${c.id}`,
        severity: "warning",
        message: `${c.label} has no calculable price in this market`,
        reason: "This configuration must be quoted; it cannot enter simulated payment.",
      });
    }
  }

  for (const [id, qty] of Object.entries(sel.addonQty)) {
    if (!qty) continue;
    const a = catalogue.addOns.find((x) => x.id === id);
    if (!a || !a.active) {
      issues.push({
        id: `aura.addon.inactive:${id}`,
        severity: "error",
        message: `Add-on ${a?.name ?? id} is no longer available`,
        reason: "Reset the quantity to zero to continue.",
      });
      continue;
    }
    if (!offer.enabledAddOnIds.includes(id)) {
      issues.push({
        id: `aura.addon.disabled:${id}`,
        severity: "error",
        message: `${a.name} is not enabled for ${offer.name}`,
        reason: "Only add-ons explicitly enabled on the offer may be sold with it.",
      });
    }
    if (!a.eligibleMarkets.includes(sel.market)) {
      issues.push({
        id: `aura.addon.market:${id}`,
        severity: "error",
        message: `${a.name} is not sold in this market`,
        reason: "Reset the quantity, or change market.",
      });
    }
    if (!Number.isInteger(qty) || qty < 0) {
      issues.push({
        id: `aura.addon.qtyvalue:${id}`,
        severity: "error",
        message: `${a.name} quantity is invalid`,
        reason: "Quantity must be a whole, non-negative number.",
      });
      continue;
    }
    if (qty % a.quantityStep !== 0) {
      issues.push({
        id: `aura.addon.step:${id}`,
        severity: "error",
        message: `${a.name} must be purchased in increments of ${a.quantityStep}`,
        reason: `Selected ${qty}. Adjust to a multiple of ${a.quantityStep}.`,
      });
    }
    if (a.maxQuantity !== null && qty > a.maxQuantity) {
      issues.push({
        id: `aura.addon.max:${id}`,
        severity: "error",
        message: `${a.name} maximum quantity is ${a.maxQuantity}`,
        reason: `Selected ${qty}.`,
      });
    }
    const addonRule = findPrice(catalogue, id, sel.market);
    const addonAmount = sel.cycle === "monthly" ? addonRule?.monthly : addonRule?.annual;
    if (addonAmount === null || addonAmount === undefined) {
      issues.push({
        id: `aura.addon.price:${id}`,
        severity: "error",
        message: `${a.name} has no ${sel.cycle} price in this market`,
        reason: "Publish a price for this add-on, or reset the quantity.",
      });
    }
  }

  if (offer.professionalServicesRequired) {
    issues.push({
      id: `aura.ps:${offer.id}`,
      severity: "warning",
      message: `${offer.name} requires Aurumi-assisted implementation`,
      reason: "Professional services must be scheduled alongside this subscription.",
    });
  }
  return issues;
}

/** Add-ons with a quantity that this offer/market no longer allows. */
export function ineligibleAuraAddOns(catalogue: Catalogue, sel: AuraSelection) {
  const offer = findAuraOffer(catalogue, sel.offerId);
  const out: { id: string; name: string; quantity: number; reason: string }[] = [];
  for (const [id, qty] of Object.entries(sel.addonQty)) {
    if (!qty) continue;
    const a = catalogue.addOns.find((x) => x.id === id);
    if (!a || !a.active) {
      out.push({ id, name: a?.name ?? id, quantity: qty, reason: "This add-on is no longer sold." });
      continue;
    }
    if (offer && !offer.enabledAddOnIds.includes(id)) {
      out.push({ id, name: a.name, quantity: qty, reason: `Not enabled for ${offer.name}.` });
      continue;
    }
    if (!a.eligibleMarkets.includes(sel.market)) {
      out.push({ id, name: a.name, quantity: qty, reason: `Not sold in ${sel.market}.` });
    }
  }
  return out;
}

/** One priced/annotated line per commercial component, then per add-on. */
export function buildAuraLines(catalogue: Catalogue, sel: AuraSelection): PricedLine[] {
  const offer = findAuraOffer(catalogue, sel.offerId);
  if (!offer) return [];
  const lines: PricedLine[] = [];

  for (const c of auraCommercialComponents(catalogue, offer, sel.market)) {
    if (c.treatment === "included") {
      lines.push({
        id: `aura-${c.id}`,
        productId: c.id,
        kind: c.kind === "setup" ? "connector_setup" : "connector",
        label: c.label,
        quantity: 1,
        unitAmount: 0,
        recurring: false,
        chargeClass: "included",
      });
      continue;
    }
    if (c.treatment === "quote_required") {
      lines.push({
        id: `aura-${c.id}`,
        productId: c.id,
        kind: c.kind === "professional_services" ? "service" : "connector",
        label: c.label,
        quantity: 1,
        unitAmount: 0,
        recurring: false,
        quoteOnly: true,
        chargeClass: "custom_quote",
      });
      continue;
    }
    if (c.treatment === "one_time") {
      lines.push({
        id: `aura-${c.id}`,
        productId: c.id,
        kind: "connector_setup",
        label: c.label,
        quantity: 1,
        unitAmount: c.oneTime ?? 0,
        recurring: false,
        chargeClass: "additional_charge",
      });
      continue;
    }
    lines.push({
      id: `aura-${c.id}`,
      productId: c.id,
      kind: c.kind === "aura" ? "plan" : "connector",
      label: `${c.label} (${sel.cycle === "monthly" ? "monthly" : "annual"})`,
      quantity: 1,
      unitAmount: (sel.cycle === "monthly" ? c.monthly : c.annual) ?? 0,
      recurring: true,
      chargeClass: "add_on",
    });
  }

  for (const [id, qty] of Object.entries(sel.addonQty)) {
    if (!qty) continue;
    const a = catalogue.addOns.find((x) => x.id === id);
    if (!a || !offer.enabledAddOnIds.includes(id)) continue;
    const addonRule = findPrice(catalogue, id, sel.market);
    // Recurring add-ons follow the billing cycle; one-time add-ons never do.
    const addonAmount = !a.recurring
      ? addonRule?.monthly
      : sel.cycle === "monthly"
        ? addonRule?.monthly
        : addonRule?.annual;
    lines.push({
      id: `aura-addon-${id}`,
      productId: id,
      kind: "addon",
      label: `${a.name} × ${qty} (${(qty * a.unitSize).toLocaleString()} ${a.unit})`,
      quantity: qty,
      unitAmount: addonAmount ?? 0,
      recurring: a.recurring,
      chargeClass: "add_on",
    });
  }
  return lines;
}

export function buildAuraQuote(
  catalogue: Catalogue,
  sel: AuraSelection,
): { lines: PricedLine[]; totals: OrderTotals } {
  const lines = buildAuraLines(catalogue, sel);
  return { lines, totals: computeTotals(catalogue, lines, sel.market, sel.cycle) };
}

/** Tenant-level entitlements produced by a standalone Aura purchase. */
export function deriveAuraEntitlements(
  catalogue: Catalogue,
  sel: AuraSelection,
  capacities: {
    additionalUsers: number;
    additionalIntelligence: number;
    additionalStorageGb: number;
  },
): Entitlement[] {
  const offer = findAuraOffer(catalogue, sel.offerId);
  if (!offer) return [];
  const connector = catalogue.connectors.find((c) => c.id === offer.connectorId);
  const out: Entitlement[] = [
    { key: "aura.capability", label: "Aura — Talk to Your Business", source: offer.id },
    { key: "aura.connector", label: connector?.name ?? offer.connectorId, source: offer.id },
  ];
  if (offer.includedUsers !== null) {
    out.push({ key: "users.included", value: offer.includedUsers, unit: "users", source: offer.id });
  }
  if (offer.includedIntelligence !== null) {
    out.push({
      key: "capacity.intelligence",
      value: offer.includedIntelligence,
      unit: "AIC/mo",
      source: offer.id,
    });
  }
  if (offer.includedStorageGb !== null) {
    out.push({ key: "capacity.storage", value: offer.includedStorageGb, unit: "GB", source: offer.id });
  }
  if (capacities.additionalUsers > 0) {
    out.push({ key: "users.included", value: capacities.additionalUsers, unit: "users", source: "addon.users" });
  }
  if (capacities.additionalIntelligence > 0) {
    out.push({
      key: "capacity.intelligence",
      value: capacities.additionalIntelligence,
      unit: "AIC/mo",
      source: "addon.intelligence",
    });
  }
  if (capacities.additionalStorageGb > 0) {
    out.push({
      key: "capacity.storage",
      value: capacities.additionalStorageGb,
      unit: "GB",
      source: "addon.storage",
    });
  }
  return out;
}
