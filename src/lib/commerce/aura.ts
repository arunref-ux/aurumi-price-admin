import { computeTotals, findPrice } from "./pricing";
import type { PricedLine } from "./cart";
import type {
  AuraOffer,
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

export function auraQuoteReasons(catalogue: Catalogue, sel: AuraSelection): string[] {
  const offer = findAuraOffer(catalogue, sel.offerId);
  if (!offer) return [];
  const reasons: string[] = [];
  const rule = findPrice(catalogue, offer.id, sel.market);
  const amount = sel.cycle === "monthly" ? rule?.monthly : rule?.annual;
  if (offer.quoteOnly) reasons.push(`${offer.name} is priced by quote`);
  else if (rule?.quoteOnly) reasons.push(`${offer.name} is quote-only in this market`);
  else if (amount === null || amount === undefined) {
    reasons.push(`${offer.name} has no calculable ${sel.cycle} price in this market`);
  }
  const connector = catalogue.connectors.find((c) => c.id === offer.connectorId);
  if (connector?.quoteOnly) reasons.push(`${connector.name} is a quote-only connector`);
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
  const rule = findPrice(catalogue, offer.id, sel.market);
  const amount = sel.cycle === "monthly" ? rule?.monthly : rule?.annual;
  if (!offer.quoteOnly && !rule?.quoteOnly && (amount === null || amount === undefined)) {
    issues.push({
      id: `aura.price:${offer.id}`,
      severity: "error",
      message: `${offer.name} has no ${sel.cycle} price in this market`,
      reason: "Publish a price for the offer in this market before it can be sold.",
    });
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

export function buildAuraLines(catalogue: Catalogue, sel: AuraSelection): PricedLine[] {
  const offer = findAuraOffer(catalogue, sel.offerId);
  if (!offer) return [];
  const lines: PricedLine[] = [];
  const rule = findPrice(catalogue, offer.id, sel.market);
  const amount = sel.cycle === "monthly" ? rule?.monthly : rule?.annual;
  const quoted = offer.quoteOnly || Boolean(rule?.quoteOnly) || amount === null || amount === undefined;
  lines.push({
    id: `aura-${offer.id}`,
    productId: offer.id,
    kind: "plan",
    label: `${offer.name} (${sel.cycle === "monthly" ? "monthly" : "annual"})`,
    quantity: 1,
    unitAmount: quoted ? 0 : (amount as number),
    recurring: true,
    quoteOnly: quoted,
    chargeClass: quoted ? "custom_quote" : "add_on",
  });

  for (const [id, qty] of Object.entries(sel.addonQty)) {
    if (!qty) continue;
    const a = catalogue.addOns.find((x) => x.id === id);
    if (!a || !offer.enabledAddOnIds.includes(id)) continue;
    const addonRule = findPrice(catalogue, id, sel.market);
    const addonAmount = sel.cycle === "monthly" ? addonRule?.monthly : addonRule?.annual;
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
