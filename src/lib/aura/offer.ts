/**
 * Simulated Aura offer / pricing provider.
 *
 * This module is deliberately shaped like the eventual pricing API so the
 * simulated provider can later be swapped for the real Price Admin endpoint
 * without touching any UI component:
 *
 *   getAuraOffer({ connector: "tally", market: "IN" })
 *
 * No commercial value should ever be hard-coded inside a component.
 */

export type AuraMarketId = "IN" | "SG" | "AE" | "US" | "INTL";
export type AuraBillingCycle = "monthly" | "annual";

export interface AuraMarketOption {
  id: AuraMarketId;
  name: string;
  currency: string;
}

export const AURA_MARKETS: AuraMarketOption[] = [
  { id: "IN", name: "India", currency: "INR" },
  { id: "SG", name: "Singapore", currency: "SGD" },
  { id: "AE", name: "United Arab Emirates", currency: "AED" },
  { id: "US", name: "United States", currency: "USD" },
  { id: "INTL", name: "International", currency: "USD" },
];

export interface AuraAddOn {
  id: string;
  name: string;
  description: string;
  unit: string;
  unitSize: number;
  /** Price per increment, in the market currency, per month. */
  unitAmount: number;
  maxQuantity: number;
  enabled: boolean;
}

export interface AuraIncludedEntitlements {
  users: number;
  intelligenceCredits: number;
  storageGb: number;
  includedConnectors: string[];
}

export interface AuraOffer {
  product: string;
  productTagline: string;
  connector: string;
  connectorName: string;
  market: AuraMarketId;
  marketName: string;
  currency: string;
  monthlyPrice: number;
  /** Total billed once per year. */
  annualPrice: number;
  included: AuraIncludedEntitlements;
  /** Price per additional connector per month, when the customer adds one later. */
  additionalConnectorMonthly: number | null;
  addOns: AuraAddOn[];
  taxNote: string;
}

interface MarketPricing {
  currency: string;
  monthlyPrice: number;
  annualPrice: number;
  additionalConnectorMonthly: number | null;
  taxNote: string;
  addOnUnitAmounts: Record<string, number>;
}

/** Per-connector simulated commercial configuration (stands in for Price Admin data). */
interface ConnectorOfferConfig {
  connectorName: string;
  included: AuraIncludedEntitlements;
  addOns: Omit<AuraAddOn, "unitAmount">[];
  pricing: Record<AuraMarketId, MarketPricing>;
}

const AURA_TALLY_PRICING: Record<AuraMarketId, MarketPricing> = {

  IN: {
    currency: "INR",
    monthlyPrice: 4999,
    annualPrice: 49990,
    additionalConnectorMonthly: 2499,
    taxNote: "Prices exclude GST.",
    addOnUnitAmounts: { "addon.users": 1499, "addon.intelligence": 1999, "addon.storage": 899 },
  },
  SG: {
    currency: "SGD",
    monthlyPrice: 129,
    annualPrice: 1290,
    additionalConnectorMonthly: 65,
    taxNote: "Prices exclude GST.",
    addOnUnitAmounts: { "addon.users": 39, "addon.intelligence": 49, "addon.storage": 25 },
  },
  AE: {
    currency: "AED",
    monthlyPrice: 359,
    annualPrice: 3590,
    additionalConnectorMonthly: 179,
    taxNote: "Prices exclude VAT.",
    addOnUnitAmounts: { "addon.users": 109, "addon.intelligence": 139, "addon.storage": 69 },
  },
  US: {
    currency: "USD",
    monthlyPrice: 99,
    annualPrice: 990,
    additionalConnectorMonthly: 49,
    taxNote: "Prices exclude applicable sales tax.",
    addOnUnitAmounts: { "addon.users": 29, "addon.intelligence": 39, "addon.storage": 19 },
  },
  INTL: {
    currency: "USD",
    monthlyPrice: 109,
    annualPrice: 1090,
    additionalConnectorMonthly: 55,
    taxNote: "Prices exclude local taxes where applicable.",
    addOnUnitAmounts: { "addon.users": 32, "addon.intelligence": 42, "addon.storage": 21 },
  },
};

const AURA_TALLY_INCLUDED: AuraIncludedEntitlements = {
  users: 10,
  intelligenceCredits: 5000,
  storageGb: 50,
  includedConnectors: ["Tally"],
};

const AURA_TALLY_ADDONS: Omit<AuraAddOn, "unitAmount">[] = [
  {
    id: "addon.users",
    name: "Additional users",
    description: "Add seats in blocks of 10.",
    unit: "users",
    unitSize: 10,
    maxQuantity: 20,
    enabled: true,
  },
  {
    id: "addon.intelligence",
    name: "Additional Intelligence Capacity",
    description: "More questions and deeper analysis each month.",
    unit: "credits",
    unitSize: 5000,
    maxQuantity: 20,
    enabled: true,
  },
  {
    id: "addon.storage",
    name: "Additional storage & context",
    description: "More business context retained for Aura.",
    unit: "GB",
    unitSize: 50,
    maxQuantity: 20,
    enabled: true,
  },
];

/**
 * Connector-keyed offer registry. Each supported Aura + Connector product has
 * its own complete commercial configuration — pricing, included entitlements
 * and add-ons — so one connector can never inherit another's commercial data.
 * Only "tally" is implemented in Phase 1.
 */
const AURA_OFFERS: Record<string, ConnectorOfferConfig> = {
  tally: {
    connectorName: "Tally",
    included: AURA_TALLY_INCLUDED,
    addOns: AURA_TALLY_ADDONS,
    pricing: AURA_TALLY_PRICING,
  },
};

export interface GetAuraOfferInput {
  connector: string;
  market: AuraMarketId;
}

/** Explicit result — an unsupported connector is never silently mapped to another offer. */
export type AuraOfferResult =
  | { available: true; offer: AuraOffer }
  | { available: false; connector: string; market: AuraMarketId };

/** Simulated pricing call, keyed by connector AND market. Deterministic and local. */
export function getAuraOffer({ connector, market }: GetAuraOfferInput): AuraOfferResult {
  const config = AURA_OFFERS[connector];
  if (!config) return { available: false, connector, market };

  const pricing = config.pricing[market];
  if (!pricing) return { available: false, connector, market };

  const marketOption = AURA_MARKETS.find((m) => m.id === market) ?? AURA_MARKETS[4]!;

  return {
    available: true,
    offer: {
      product: "Aura",
      productTagline: "Talk to Your Business",
      connector,
      connectorName: config.connectorName,
      market,
      marketName: marketOption.name,
      currency: pricing.currency,
      monthlyPrice: pricing.monthlyPrice,
      annualPrice: pricing.annualPrice,
      included: config.included,
      additionalConnectorMonthly: pricing.additionalConnectorMonthly,
      addOns: config.addOns
        .map((a) => ({
          ...a,
          unitAmount: pricing.addOnUnitAmounts[a.id] ?? 0,
        }))
        .filter((a) => a.enabled),
      taxNote: pricing.taxNote,
    },
  };
}

export function formatOfferMoney(amount: number, currency: string): string {
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

export interface AuraQuote {
  currency: string;
  cycle: AuraBillingCycle;
  /** Amount charged each billing cycle. */
  cycleTotal: number;
  /** Comparable monthly figure (annual divided by 12). */
  monthlyEquivalent: number;
  baseAmount: number;
  addOnAmount: number;
  annualSavingPct: number;
  annualBilled: number;
  lines: { id: string; label: string; amount: number }[];
}

/** Pure calculation over the simulated offer — no UI concerns. */
export function calculateAuraQuote(
  offer: AuraOffer,
  cycle: AuraBillingCycle,
  addOnQty: Record<string, number>,
): AuraQuote {
  const multiplier = cycle === "annual" ? 10 : 1; // annual = 10 months (2 months free)
  const baseAmount = cycle === "annual" ? offer.annualPrice : offer.monthlyPrice;

  const lines: AuraQuote["lines"] = [
    {
      id: "base",
      label: `Aura + ${offer.connectorName}`,
      amount: baseAmount,
    },
  ];

  let addOnAmount = 0;
  for (const addOn of offer.addOns) {
    const qty = addOnQty[addOn.id] ?? 0;
    if (!qty) continue;
    const amount = addOn.unitAmount * qty * multiplier;
    addOnAmount += amount;
    lines.push({
      id: addOn.id,
      label: `${addOn.name} · ${(qty * addOn.unitSize).toLocaleString()} ${addOn.unit}`,
      amount,
    });
  }

  const cycleTotal = baseAmount + addOnAmount;
  const monthlyList = offer.monthlyPrice + Object.entries(addOnQty).reduce((sum, [id, qty]) => {
    const addOn = offer.addOns.find((a) => a.id === id);
    return addOn ? sum + addOn.unitAmount * (qty ?? 0) : sum;
  }, 0);
  const annualBilled = cycle === "annual" ? cycleTotal : monthlyList * 12;
  const annualSavingPct =
    monthlyList > 0 ? Math.max(0, Math.round((1 - (monthlyList * 10) / (monthlyList * 12)) * 100)) : 0;

  return {
    currency: offer.currency,
    cycle,
    cycleTotal,
    monthlyEquivalent: cycle === "annual" ? Math.round(cycleTotal / 12) : cycleTotal,
    baseAmount,
    addOnAmount,
    annualSavingPct,
    annualBilled,
    lines,
  };
}

/** Everything a simulated checkout would need to hand to a real provider later. */
export interface AuraPurchaseIntent {
  product: string;
  connector: string;
  market: AuraMarketId;
  cycle: AuraBillingCycle;
  currency: string;
  addOns: { id: string; quantity: number; units: number }[];
  quote: AuraQuote;
  createdAt: string;
}

export function buildPurchaseIntent(
  offer: AuraOffer,
  cycle: AuraBillingCycle,
  addOnQty: Record<string, number>,
): AuraPurchaseIntent {
  const quote = calculateAuraQuote(offer, cycle, addOnQty);
  return {
    product: offer.product,
    connector: offer.connector,
    market: offer.market,
    cycle,
    currency: offer.currency,
    addOns: offer.addOns
      .filter((a) => (addOnQty[a.id] ?? 0) > 0)
      .map((a) => ({ id: a.id, quantity: addOnQty[a.id]!, units: addOnQty[a.id]! * a.unitSize })),
    quote,
    createdAt: new Date().toISOString(),
  };
}
