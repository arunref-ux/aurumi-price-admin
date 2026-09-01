/**
 * Simulated Bundle offer / pricing provider.
 *
 * SINGLE COMMERCIAL SOURCE: everything returned here derives from the
 * PUBLISHED Price Admin catalogue (`Catalogue.bundles` + `Catalogue.prices`).
 * There is deliberately no bundle pricing table in this module and no fallback
 * to Aura, connector or Workspace prices.
 *
 *   Price Admin -> Published BundleOffer -> this provider -> bundle landing page
 */
import { findPrice } from "@/lib/commerce/pricing";
import {
  bundleCommercialComponents,
  bundleEligibility,
  bundleQuoteReasons,
  findBundle,
} from "@/lib/commerce/bundles";
import type {
  AuraCommercialTreatment,
  BillingCycle,
  Catalogue,
  MarketId,
} from "@/lib/commerce/types";

export type BundleMarketId = MarketId;
export type BundleBillingCycle = BillingCycle;

export interface BundleMarketOption {
  id: BundleMarketId;
  name: string;
  currency: string;
}

export function bundleMarketOptions(catalogue: Catalogue): BundleMarketOption[] {
  return catalogue.markets
    .filter((m) => m.active)
    .map((m) => ({ id: m.id, name: m.name, currency: m.currency }));
}

export interface BundleAddOnView {
  id: string;
  name: string;
  description: string;
  unit: string;
  unitSize: number;
  unitMonthly: number | null;
  unitAnnual: number | null;
  recurring: boolean;
  maxQuantity: number;
}

export interface BundleConnectorView {
  id: string;
  name: string;
  category: string;
  description: string;
  /** How this connector is treated commercially inside the bundle. */
  treatment: AuraCommercialTreatment;
}

export interface BundleComponentView {
  id: string;
  label: string;
  treatment: AuraCommercialTreatment;
  note?: string | undefined;
  monthly: number | null;
  annual: number | null;
  oneTime: number | null;
}

export interface BundleOfferView {
  bundleId: string;
  slug: string;
  name: string;
  positioning: string;
  description: string;
  market: BundleMarketId;
  marketName: string;
  currency: string;
  monthlyPrice: number | null;
  annualPrice: number | null;
  included: {
    users: number | null;
    intelligenceCredits: number | null;
    storageGb: number | null;
  };
  connectors: BundleConnectorView[];
  components: BundleComponentView[];
  addOns: BundleAddOnView[];
  taxNote: string;
  commercialTerms: string;
  quoteRequired: boolean;
  quoteReasons: string[];
  /** Published purchase eligibility — two independent commercial permissions. */
  availableDirectlyWithAura: boolean;
  availableAsWorkspaceAddon: boolean;
  /** DERIVED, never stored. */
  requiresWorkspace: boolean;
  catalogueVersion: number;
}

export interface GetBundleOfferInput {
  /** Published catalogue — the authoritative commercial source. */
  catalogue: Catalogue;
  /** Bundle id or slug, e.g. "finance-cash-flow". */
  bundle: string;
  market: BundleMarketId;
}

/** Explicit result — an unconfigured bundle is never silently priced. */
export type BundleOfferResult =
  | { available: true; offer: BundleOfferView }
  | { available: false; bundle: string; market: BundleMarketId; reason: string };

function taxNoteFor(catalogue: Catalogue, market: BundleMarketId): string {
  const m = catalogue.markets.find((x) => x.id === market);
  if (!m) return "";
  return m.taxIncluded ? `Prices include ${m.taxName}.` : `Prices exclude ${m.taxName}.`;
}

export function getBundleOffer({
  catalogue,
  bundle,
  market,
}: GetBundleOfferInput): BundleOfferResult {
  const published = findBundle(catalogue, bundle);
  if (!published || !published.active || published.status !== "Available") {
    return { available: false, bundle, market, reason: "Offer not yet configured" };
  }
  if (!published.eligibleMarkets.includes(market)) {
    return { available: false, bundle, market, reason: "Not offered in this market" };
  }
  const marketRow = catalogue.markets.find((m) => m.id === market);
  if (!marketRow) {
    return { available: false, bundle, market, reason: "Market not configured" };
  }

  const rule = findPrice(catalogue, published.id, market);
  const resolved = bundleCommercialComponents(catalogue, published, market);
  const quoteReasons = bundleQuoteReasons(resolved);
  const eligibility = bundleEligibility(published);

  const connectors: BundleConnectorView[] = bundleConnectorIdsForMarket(published, market)
    .map((id): BundleConnectorView | null => {
      const c = catalogue.connectors.find((x) => x.id === id);
      if (!c) return null;
      const component = resolved.find((r) => r.connectorId === id);
      return {
        id: c.id,
        name: c.name,
        category: c.category,
        description: c.description,
        treatment: component?.treatment ?? "included",
      };
    })
    .filter((c): c is BundleConnectorView => c !== null);

  const addOns: BundleAddOnView[] = catalogue.addOns
    .filter(
      (a) =>
        a.active && published.enabledAddOnIds.includes(a.id) && a.eligibleMarkets.includes(market),
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
      bundleId: published.id,
      slug: published.slug,
      name: published.name,
      positioning: published.positioning,
      description: published.description,
      market,
      marketName: marketRow.name,
      currency: marketRow.currency,
      monthlyPrice: rule?.quoteOnly ? null : (rule?.monthly ?? null),
      annualPrice: rule?.quoteOnly ? null : (rule?.annual ?? null),
      included: {
        users: published.includedUsers,
        intelligenceCredits: published.includedIntelligence,
        storageGb: published.includedStorageGb,
      },
      connectors,
      components: resolved.map((c) => ({
        id: c.id,
        label: c.label,
        treatment: c.treatment,
        note: c.note,
        monthly: c.monthly,
        annual: c.annual,
        oneTime: c.oneTime,
      })),
      addOns,
      taxNote: taxNoteFor(catalogue, market),
      commercialTerms: published.commercialTerms,
      quoteRequired: quoteReasons.length > 0,
      quoteReasons,
      availableDirectlyWithAura: eligibility.availableDirectlyWithAura,
      availableAsWorkspaceAddon: eligibility.availableAsWorkspaceAddon,
      requiresWorkspace:
        !eligibility.availableDirectlyWithAura && eligibility.availableAsWorkspaceAddon,
      catalogueVersion: catalogue.version,
    },
  };
}

export interface BundleQuoteLine {
  id: string;
  label: string;
  treatment: AuraCommercialTreatment;
  amount: number | null;
  recurring: boolean;
}

export interface BundleQuote {
  currency: string;
  cycle: BundleBillingCycle;
  cycleTotal: number;
  monthlyEquivalent: number;
  oneTimeTotal: number;
  annualSavingPct: number;
  quoteRequired: boolean;
  quoteReasons: string[];
  lines: BundleQuoteLine[];
}

/** Pure calculation over the published bundle offer — no local prices. */
export function calculateBundleQuote(
  offer: BundleOfferView,
  cycle: BundleBillingCycle,
  addOnQty: Record<string, number>,
): BundleQuote {
  const lines: BundleQuoteLine[] = [];
  let recurring = 0;
  let oneTime = 0;

  for (const c of offer.components) {
    if (c.treatment === "included" || c.treatment === "quote_required") {
      lines.push({ id: c.id, label: c.label, treatment: c.treatment, amount: null, recurring: false });
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
export interface BundlePurchaseIntent {
  productLine: "bundle";
  bundleId: string;
  bundleName: string;
  connectorIds: string[];
  catalogueVersion: number;
  market: BundleMarketId;
  cycle: BundleBillingCycle;
  currency: string;
  addOns: { id: string; quantity: number; units: number }[];
  quote: BundleQuote;
  /** DRAFT -> QUOTE REQUIRED, or DRAFT -> PENDING PAYMENT (simulated). */
  lifecycle: "quote_required" | "pending_payment";
  createdAt: string;
}

export function buildBundlePurchaseIntent(
  offer: BundleOfferView,
  cycle: BundleBillingCycle,
  addOnQty: Record<string, number>,
): BundlePurchaseIntent {
  const quote = calculateBundleQuote(offer, cycle, addOnQty);
  return {
    productLine: "bundle",
    bundleId: offer.bundleId,
    bundleName: offer.name,
    connectorIds: offer.connectors.map((c) => c.id),
    catalogueVersion: offer.catalogueVersion,
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

export function formatBundleMoney(amount: number | null | undefined, currency: string): string {
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
