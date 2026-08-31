import type {
  BillingCycle,
  CartLine,
  Catalogue,
  MarketId,
  OrderTotals,
  PriceRule,
  Promotion,
} from "./types";

export function findPrice(
  catalogue: Catalogue,
  productId: string,
  market: MarketId,
): PriceRule | undefined {
  return catalogue.prices.find((p) => p.productId === productId && p.market === market);
}

/** Amount charged per billing cycle (monthly amount, or annual billed amount). */
export function cycleAmount(rule: PriceRule | undefined, cycle: BillingCycle): number | null {
  if (!rule) return null;
  if (rule.quoteOnly) return null;
  return cycle === "monthly" ? rule.monthly : rule.annual;
}

/** Display price per month, for a given cycle (annual shows monthly-equivalent). */
export function monthlyEquivalent(rule: PriceRule | undefined, cycle: BillingCycle): number | null {
  if (!rule || rule.quoteOnly) return null;
  if (cycle === "monthly") return rule.monthly;
  return rule.annual === null ? null : Math.round(rule.annual / 12);
}

export function formatMoney(amount: number | null | undefined, currency: string): string {
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

export function activePromotions(
  catalogue: Catalogue,
  planId: string,
  market: MarketId,
  cycle: BillingCycle,
  code?: string | null,
): Promotion[] {
  const today = new Date().toISOString().slice(0, 10);
  return catalogue.promotions.filter(
    (p) =>
      p.active &&
      (!code || p.code.toLowerCase() === code.toLowerCase()) &&
      p.eligiblePlans.includes(planId) &&
      p.eligibleMarkets.includes(market) &&
      (!p.annualOnly || cycle === "annual") &&
      p.startDate <= today &&
      p.endDate >= today,
  );
}

export function computeTotals(
  catalogue: Catalogue,
  lines: CartLine[],
  market: MarketId,
  cycle: BillingCycle,
  promotions: Promotion[] = [],
): OrderTotals {
  const m = catalogue.markets.find((x) => x.id === market) ?? catalogue.markets[0]!;
  const recurringSubtotal = lines
    .filter((l) => l.recurring && !l.quoteOnly)
    .reduce((s, l) => s + l.unitAmount * l.quantity, 0);
  const oneTimeSubtotal = lines
    .filter((l) => !l.recurring && !l.quoteOnly)
    .reduce((s, l) => s + l.unitAmount * l.quantity, 0);

  let discount = 0;
  for (const p of promotions) {
    if (p.type === "percentage" || p.type === "first_period") {
      discount += Math.round((recurringSubtotal * p.value) / 100);
    } else {
      discount += p.value;
    }
  }
  discount = Math.min(discount, recurringSubtotal);

  const taxableBase = recurringSubtotal - discount + oneTimeSubtotal;
  const tax = m.taxIncluded ? 0 : Math.round((taxableBase * m.taxRatePct) / 100);
  const recurringTotal = recurringSubtotal - discount;
  const oneTimeTotal = oneTimeSubtotal;

  const totals: OrderTotals = {
    currency: m.currency,
    recurringSubtotal,
    oneTimeSubtotal,
    discount,
    taxableBase,
    tax,
    recurringTotal,
    oneTimeTotal,
    total: recurringTotal + oneTimeTotal + tax,
    taxRatePct: m.taxIncluded ? 0 : m.taxRatePct,
    taxName: m.taxName,
  };

  if (cycle === "annual") {
    totals.billedAnnually = recurringTotal;
    totals.monthlyEquivalent = Math.round(recurringTotal / 12);
  }
  return totals;
}

/** Strike-through monthly price + annual savings copy, derived from configuration. */
export function annualDisplay(rule: PriceRule | undefined, currency: string) {
  if (!rule || rule.monthly === null || rule.annual === null) return null;
  const equivalent = Math.round(rule.annual / 12);
  const savePct = Math.max(0, Math.round((1 - rule.annual / (rule.monthly * 12)) * 100));
  return {
    strikeMonthly: formatMoney(rule.monthly, currency),
    monthlyEquivalent: formatMoney(equivalent, currency),
    billedAnnually: formatMoney(rule.annual, currency),
    savePct,
    caption: `Billed ${formatMoney(rule.annual, currency)} annually · Save ${savePct}%`,
  };
}
