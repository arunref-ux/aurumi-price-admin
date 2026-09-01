/**
 * Bundle commerce.
 *
 * A Bundle is a commercial packaging construct: one offer that references
 * several existing catalogue components. Connectors keep their own identity,
 * classification and pricing — the bundle only decides how they are SOLD.
 * The commercial-treatment vocabulary is shared with standalone Aura offers,
 * so there is exactly one commercial model in the prototype.
 */
import { findPrice } from "./pricing";
import type {
  AuraCommercialTreatment,
  BundleOffer,
  BundleOfferComponent,
  Catalogue,
  MarketId,
} from "./types";

export function findBundle(catalogue: Catalogue, idOrSlug: string): BundleOffer | undefined {
  return (catalogue.bundles ?? []).find((b) => b.id === idOrSlug || b.slug === idOrSlug);
}

/** Bundles sellable right now, optionally in one market. */
export function sellableBundles(catalogue: Catalogue, market?: MarketId): BundleOffer[] {
  return (catalogue.bundles ?? []).filter(
    (b) =>
      b.active &&
      b.status === "Available" &&
      (!market || b.eligibleMarkets.includes(market)),
  );
}

/** Add-ons explicitly enabled by the bundle offer, sellable in this market. */
export function bundleAddOns(catalogue: Catalogue, bundle: BundleOffer, market: MarketId) {
  return catalogue.addOns.filter(
    (a) => a.active && bundle.enabledAddOnIds.includes(a.id) && a.eligibleMarkets.includes(market),
  );
}

export interface ResolvedBundleComponent {
  id: string;
  label: string;
  kind: BundleOfferComponent["kind"];
  treatment: AuraCommercialTreatment;
  note?: string | undefined;
  connectorId?: string | undefined;
  required: boolean;
  monthly: number | null;
  annual: number | null;
  oneTime: number | null;
}

/** Bundles stored before the component model get an implicit recurring charge. */
export function bundleComponents(bundle: BundleOffer): BundleOfferComponent[] {
  if (Array.isArray(bundle.components) && bundle.components.length) return bundle.components;
  return [
    {
      id: `${bundle.id}:bundle`,
      label: bundle.name,
      kind: "bundle",
      treatment: bundle.quoteOnly ? "quote_required" : "recurring",
      productId: bundle.id,
      required: true,
    },
  ];
}

/**
 * Resolve components against catalogue prices for one market. A priced
 * component whose amount cannot be calculated degrades to "quote_required"
 * rather than presenting a misleading zero.
 */
export function bundleCommercialComponents(
  catalogue: Catalogue,
  bundle: BundleOffer,
  market: MarketId,
): ResolvedBundleComponent[] {
  return bundleComponents(bundle).map((c) => {
    const base: ResolvedBundleComponent = {
      id: c.id,
      label: c.label,
      kind: c.kind,
      treatment: c.treatment,
      note: c.note,
      connectorId: c.connectorId,
      required: c.required !== false,
      monthly: null,
      annual: null,
      oneTime: null,
    };
    if (c.treatment === "included" || c.treatment === "quote_required") return base;

    const rule = c.productId ? findPrice(catalogue, c.productId, market) : undefined;
    const quoted = bundle.quoteOnly || !rule || Boolean(rule.quoteOnly);

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
}

/**
 * Only a REQUIRED quote-only component forces DRAFT -> QUOTE REQUIRED.
 * An optional quote-only component is a priceable extra the buyer can leave
 * out, so it must not block the simulated payment path on its own.
 */
export function bundleQuoteReasons(components: ResolvedBundleComponent[]): string[] {
  return components
    .filter((c) => c.treatment === "quote_required" && c.required)
    .map((c) => `${c.label}: quote required`);
}

/**
 * Purchase eligibility. Legacy stored bundles (written before the two
 * commercial permissions existed) are read as eligible through both routes,
 * which matches how they were previously sold.
 */
export function bundleEligibility(bundle: BundleOffer): {
  availableDirectlyWithAura: boolean;
  availableAsWorkspaceAddon: boolean;
} {
  return {
    availableDirectlyWithAura: bundle.availableDirectlyWithAura !== false,
    availableAsWorkspaceAddon: bundle.availableAsWorkspaceAddon !== false,
  };
}

/** DERIVED — never stored. */
export function bundleRequiresWorkspace(bundle: BundleOffer): boolean {
  const e = bundleEligibility(bundle);
  return !e.availableDirectlyWithAura && e.availableAsWorkspaceAddon;
}
