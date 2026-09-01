/**
 * Simulated Aura offer / pricing provider.
 *
 * SINGLE COMMERCIAL SOURCE: this provider derives everything it returns from
 * the PUBLISHED Price Admin catalogue (`Catalogue.auraOffers` + `Catalogue.prices`).
 * There is deliberately no independent pricing table here — the public
 * /aura/<connector> experience and Price Admin read the same commercial data.
 *
 *   Price Admin -> Published AuraOffer -> this provider -> public product page
 *
 * The shape is the eventual Pricing API shape, so this module can later be
 * replaced by a real service without touching any UI component.
 */

import { findPrice } from "@/lib/commerce/pricing";
import { auraCommercialComponents, findAuraOffer } from "@/lib/commerce/aura";
import type {
  AuraCommercialTreatment,
  BillingCycle,
  Catalogue,
  MarketId,
} from "@/lib/commerce/types";

export type AuraMarketId = MarketId;
export type AuraBillingCycle = BillingCycle;

export interface AuraMarketOption {
  id: AuraMarketId;
  name: string;
  currency: string;
}

/** Markets come from the published catalogue — never from a local list. */
export function auraMarketOptions(catalogue: Catalogue): AuraMarketOption[] {
  return catalogue.markets
    .filter((m) => m.active)
    .map((m) => ({ id: m.id, name: m.name, currency: m.currency }));
}

export interface AuraAddOn {
  id: string;
  name: string;
  description: string;
  unit: string;
  unitSize: number;
  /** Price per increment in the market currency, per month / per year. */
  unitMonthly: number | null;
  unitAnnual: number | null;
  recurring: boolean;
  maxQuantity: number;
}

export interface AuraIncludedEntitlements {
  users: number | null;
  intelligenceCredits: number | null;
  storageGb: number | null;
  includedConnectors: string[];
}

/** A commercial component of the offer, as presented publicly. */
export interface AuraOfferComponentView {
  id: string;
  label: string;
  treatment: AuraCommercialTreatment;
  note?: string | undefined;
  /** Amount for the selected cycle; null for included / quote-required. */
  monthly: number | null;
  annual: number | null;
  oneTime: number | null;
}

export interface AuraOffer {
  offerId: string;
  product: string;
  productTagline: string;
  connector: string;
  connectorName: string;
  market: AuraMarketId;
  marketName: string;
  currency: string;
  monthlyPrice: number | null;
  annualPrice: number | null;
  included: AuraIncludedEntitlements;
  components: AuraOfferComponentView[];
  addOns: AuraAddOn[];
  taxNote: string;
  connectorCommercialTerms: string;
  quoteRequired: boolean;
  quoteReasons: string[];
}

export interface GetAuraOfferInput {
  /** Published catalogue — the authoritative commercial source. */
  catalogue: Catalogue;
  /** Catalogue connector id, e.g. "conn.tally". */
  connector: string;
  market: AuraMarketId;
}

/** Explicit result — an unsupported connector is never silently mapped to another offer. */
export type AuraOfferResult =
  | { available: true; offer: AuraOffer }
  | { available: false; connector: string; market: AuraMarketId };

function taxNoteFor(catalogue: Catalogue, market: AuraMarketId): string {
  const m = catalogue.markets.find((x) => x.id === market);
  if (!m) return "";
  if (m.taxIncluded) return `Prices include ${m.taxName}.`;
  return `Prices exclude ${m.taxName}.`;
}

/** Simulated pricing call, keyed by connector AND market, sourced from the catalogue. */
export function getAuraOffer({ catalogue, connector, market }: GetAuraOfferInput): AuraOfferResult {
  const published = (catalogue.auraOffers ?? []).find(
    (o) => o.connectorId === connector && o.active && o.status === "Available",
  );
  if (!published) return { available: false, connector, market };
  if (!published.eligibleMarkets.includes(market)) return { available: false, connector, market };

  const connectorRow = catalogue.connectors.find((c) => c.id === published.connectorId);
  if (!connectorRow?.standaloneAuraOffering || !connectorRow.active) {
    return { available: false, connector, market };
  }
  const marketRow = catalogue.markets.find((m) => m.id === market);
  if (!marketRow) return { available: false, connector, market };

  const offer = findAuraOffer(catalogue, published.id)!;
  const rule = findPrice(catalogue, offer.id, market);

  const components = auraCommercialComponents(catalogue, offer, market).map((c) => ({
    id: c.id,
    label: c.label,
    treatment: c.treatment,
    note: c.note,
    monthly: c.monthly,
    annual: c.annual,
    oneTime: c.oneTime,
  }));

  const quoteReasons = components
    .filter((c) => c.treatment === "quote_required")
    .map((c) => `${c.label}: quote required`);

  const addOns: AuraAddOn[] = catalogue.addOns
    .filter(
      (a) => a.active && offer.enabledAddOnIds.includes(a.id) && a.eligibleMarkets.includes(market),
    )
    .map((a) => {
      const r = findPrice(catalogue, a.id, market);
      return {
        id: a.id,
        name: a.name,
        description: a.description,
        unit: a.unit,
        unitSize: a.unitSize,
        unitMonthly: r?.monthly ?? null,
        unitAnnual: r?.annual ?? null,
        recurring: a.recurring,
        maxQuantity: a.maxQuantity ?? 20,
      };
    });

  return {
    available: true,
    offer: {
      offerId: offer.id,
      product: "Aura",
      productTagline: "Talk to Your Business",
      connector: offer.connectorId,
      connectorName: connectorRow.name,
      market,
      marketName: marketRow.name,
      currency: marketRow.currency,
      monthlyPrice: rule?.quoteOnly ? null : (rule?.monthly ?? null),
      annualPrice: rule?.quoteOnly ? null : (rule?.annual ?? null),
      included: {
        users: offer.includedUsers,
        intelligenceCredits: offer.includedIntelligence,
        storageGb: offer.includedStorageGb,
        includedConnectors: [connectorRow.name],
      },
      components,
      addOns,
      taxNote: taxNoteFor(catalogue, market),
      connectorCommercialTerms: offer.connectorCommercialTerms,
      quoteRequired: quoteReasons.length > 0,
      quoteReasons,
    },
  };
}

export function formatOfferMoney(amount: number | null | undefined, currency: string): string {
  if (amount === null || amount === undefined) return "—";
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

export interface AuraQuoteLine {
  id: string;
  label: string;
  treatment: AuraCommercialTreatment;
  /** null for included and quote-required lines. */
  amount: number | null;
  recurring: boolean;
}

export interface AuraQuote {
  currency: string;
  cycle: AuraBillingCycle;
  /** Recurring amount charged each billing cycle. */
  cycleTotal: number;
  /** Comparable monthly figure. */
  monthlyEquivalent: number;
  oneTimeTotal: number;
  annualSavingPct: number;
  quoteRequired: boolean;
  quoteReasons: string[];
  lines: AuraQuoteLine[];
}

/** Pure calculation over the published offer — no UI concerns, no local prices. */
export function calculateAuraQuote(
  offer: AuraOffer,
  cycle: AuraBillingCycle,
  addOnQty: Record<string, number>,
): AuraQuote {
  const lines: AuraQuoteLine[] = [];
  let recurring = 0;
  let oneTime = 0;

  for (const c of offer.components) {
    if (c.treatment === "included") {
      lines.push({ id: c.id, label: c.label, treatment: "included", amount: null, recurring: false });
      continue;
    }
    if (c.treatment === "quote_required") {
      lines.push({ id: c.id, label: c.label, treatment: "quote_required", amount: null, recurring: false });
      continue;
    }
    if (c.treatment === "one_time") {
      const amount = c.oneTime ?? 0;
      oneTime += amount;
      lines.push({ id: c.id, label: c.label, treatment: "one_time", amount, recurring: false });
      continue;
    }
    const amount = (cycle === "annual" ? c.annual : c.monthly) ?? 0;
    recurring += amount;
    lines.push({ id: c.id, label: c.label, treatment: "recurring", amount, recurring: true });
  }

  for (const addOn of offer.addOns) {
    const qty = addOnQty[addOn.id] ?? 0;
    if (!qty) continue;
    const unit = addOn.recurring
      ? ((cycle === "annual" ? addOn.unitAnnual : addOn.unitMonthly) ?? 0)
      : (addOn.unitMonthly ?? 0);
    const amount = unit * qty;
    if (addOn.recurring) recurring += amount;
    else oneTime += amount;
    lines.push({
      id: addOn.id,
      label: `${addOn.name} · ${(qty * addOn.unitSize).toLocaleString()} ${addOn.unit}`,
      treatment: addOn.recurring ? "recurring" : "one_time",
      amount,
      recurring: addOn.recurring,
    });
  }

  const monthlyList =
    (offer.monthlyPrice ?? 0) +
    offer.addOns.reduce(
      (sum, a) => sum + (a.recurring ? (a.unitMonthly ?? 0) * (addOnQty[a.id] ?? 0) : 0),
      0,
    );
  const annualList =
    (offer.annualPrice ?? 0) +
    offer.addOns.reduce(
      (sum, a) => sum + (a.recurring ? (a.unitAnnual ?? 0) * (addOnQty[a.id] ?? 0) : 0),
      0,
    );
  const annualSavingPct =
    monthlyList > 0 && annualList > 0
      ? Math.max(0, Math.round((1 - annualList / (monthlyList * 12)) * 100))
      : 0;

  return {
    currency: offer.currency,
    cycle,
    cycleTotal: recurring,
    monthlyEquivalent: cycle === "annual" ? Math.round(recurring / 12) : recurring,
    oneTimeTotal: oneTime,
    annualSavingPct,
    quoteRequired: offer.quoteRequired,
    quoteReasons: offer.quoteReasons,
    lines,
  };
}

/** Everything a simulated checkout would hand to a real provider later. */
export interface AuraPurchaseIntent {
  product: string;
  offerId: string;
  connector: string;
  catalogueVersion: number;
  market: AuraMarketId;
  cycle: AuraBillingCycle;
  currency: string;
  addOns: { id: string; quantity: number; units: number }[];
  quote: AuraQuote;
  /** DRAFT -> QUOTE REQUIRED, or DRAFT -> PENDING PAYMENT (simulated). */
  lifecycle: "quote_required" | "pending_payment";
  createdAt: string;
}

export function buildPurchaseIntent(
  catalogue: Catalogue,
  offer: AuraOffer,
  cycle: AuraBillingCycle,
  addOnQty: Record<string, number>,
): AuraPurchaseIntent {
  const quote = calculateAuraQuote(offer, cycle, addOnQty);
  return {
    product: offer.product,
    offerId: offer.offerId,
    connector: offer.connector,
    catalogueVersion: catalogue.version,
    market: offer.market,
    cycle,
    currency: offer.currency,
    addOns: offer.addOns
      .filter((a) => (addOnQty[a.id] ?? 0) > 0)
      .map((a) => ({ id: a.id, quantity: addOnQty[a.id]!, units: addOnQty[a.id]! * a.unitSize })),
    quote,
    lifecycle: quote.quoteRequired ? "quote_required" : "pending_payment",
    createdAt: new Date().toISOString(),
  };
}
