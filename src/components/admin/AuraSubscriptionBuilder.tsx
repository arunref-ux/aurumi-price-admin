import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCommerce } from "@/lib/commerce/store";
import { findPrice, formatMoney } from "@/lib/commerce/pricing";
import { CHARGE_CLASS_LABEL } from "@/lib/commerce/cart";
import { ENTITLEMENT_LABELS, summariseEntitlements } from "@/lib/commerce/entitlements";
import {
  auraOfferAddOns,
  auraQuoteReasons,
  buildAuraQuote,
  deriveAuraEntitlements,
  findAuraOffer,
  ineligibleAuraAddOns,
  sellableAuraOffers,
  validateAuraSelection,
  type AuraSelection,
} from "@/lib/commerce/aura";
import type { BillingCycle, MarketId, TenantSubscription } from "@/lib/commerce/types";
import { toast } from "sonner";

/**
 * Standalone Aura subscription: Aura + connector, with no Workspace plan.
 * Reads the PUBLISHED catalogue only, exactly like the Workspace builder.
 */
export function AuraSubscriptionBuilder() {
  const { published: catalogue, state, saveSubscription } = useCommerce();
  const navigate = useNavigate();

  const offers = sellableAuraOffers(catalogue);
  const [tenantId, setTenantId] = useState(state.tenants[0]?.id ?? "");
  const tenant = state.tenants.find((t) => t.id === tenantId);
  const [market, setMarket] = useState<MarketId>(tenant?.primaryMarket ?? catalogue.settings.defaultMarket);
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [offerId, setOfferId] = useState(offers[0]?.id ?? "");
  const [addonQty, setAddonQty] = useState<Record<string, number>>({});

  const selection: AuraSelection = { offerId, market, cycle, addonQty };
  const offer = findAuraOffer(catalogue, offerId);
  const marketRow = catalogue.markets.find((m) => m.id === market) ?? catalogue.markets[0]!;

  const issues = useMemo(
    () => validateAuraSelection(catalogue, selection),
    [catalogue, JSON.stringify(selection)],
  );
  const errors = issues.filter((i) => i.severity === "error");
  const quoteWhy = useMemo(() => auraQuoteReasons(catalogue, selection), [catalogue, JSON.stringify(selection)]);
  const needsQuote = quoteWhy.length > 0;
  const invalidAddOns = useMemo(
    () => ineligibleAuraAddOns(catalogue, selection),
    [catalogue, JSON.stringify(selection)],
  );

  const { lines, totals } = useMemo(
    () => buildAuraQuote(catalogue, selection),
    [catalogue, JSON.stringify(selection)],
  );

  const unitSize = (id: string) => catalogue.addOns.find((a) => a.id === id)?.unitSize ?? 1;
  const capacities = {
    additionalUsers: (addonQty["addon.users"] ?? 0) * unitSize("addon.users"),
    additionalIntelligence: (addonQty["addon.intelligence"] ?? 0) * unitSize("addon.intelligence"),
    additionalStorageGb: (addonQty["addon.storage"] ?? 0) * unitSize("addon.storage"),
  };
  const entitlements = deriveAuraEntitlements(catalogue, selection, capacities);
  const summary = summariseEntitlements(entitlements);

  const clearAddOn = (id: string) => {
    const next = { ...addonQty };
    delete next[id];
    setAddonQty(next);
  };

  const confirm = (mode: "draft" | "commit") => {
    if (!tenant || !offer) return;
    if (mode === "commit" && errors.length) return;
    const now = new Date();
    const renewal = new Date(now);
    if (cycle === "annual") renewal.setFullYear(renewal.getFullYear() + 1);
    else renewal.setMonth(renewal.getMonth() + 1);

    const sub: TenantSubscription = {
      id: `sub.${Math.random().toString(36).slice(2, 9)}`,
      tenantId: tenant.id,
      productLine: "aura",
      // Intentionally no Workspace plan for a standalone Aura subscription.
      planId: "",
      auraOfferId: offer.id,
      market,
      currency: marketRow.currency,
      billingCycle: cycle,
      status: mode === "draft" ? "draft" : needsQuote ? "quote_required" : "pending_payment",
      includedUsers: offer.includedUsers,
      additionalUsers: capacities.additionalUsers,
      standardAppsEntitled: false,
      premiumAppIds: [],
      standardConnectorIds: [],
      additionalConnectorIds: [offer.connectorId],
      additionalIntelligence: capacities.additionalIntelligence,
      additionalStorageGb: capacities.additionalStorageGb,
      additionalTransferGb: 0,
      lines,
      totals,
      promotionCode: null,
      catalogueVersion: catalogue.version,
      paymentProvider: marketRow.paymentProvider,
      paymentMode: "simulated",
      paymentStatus:
        mode === "draft" ? "not_required" : needsQuote ? "quote_pending" : "awaiting_simulated_payment",
      startDate: now.toISOString(),
      renewalDate: renewal.toISOString(),
      cancellationRequested: false,
      cancellationEffective: null,
      entitlements,
      changeLog: [
        {
          id: `chg.${Math.random().toString(36).slice(2, 8)}`,
          type: mode === "commit" && needsQuote ? "quote_requested" : "created",
          description:
            mode === "draft"
              ? `Draft standalone ${offer.name} configuration saved from catalogue v${catalogue.version}`
              : needsQuote
                ? `Quote requested for ${offer.name} — ${quoteWhy.join("; ")}`
                : `Standalone ${offer.name} subscription confirmed from catalogue v${catalogue.version}`,
          timing: "immediate",
          prorated: false,
          effectiveDate: now.toISOString(),
          createdAt: now.toISOString(),
        },
      ],
    };
    saveSubscription(sub);
    toast.success(
      mode === "draft"
        ? "Draft saved — nothing has been purchased"
        : needsQuote
          ? "Quote required — no simulated payment is taken"
          : "Standalone Aura subscription created — awaiting simulated payment",
    );
    navigate({ to: "/tenants" });
  };

  const offerAddOns = offer ? auraOfferAddOns(catalogue, offer, market) : [];
  const offerRule = offer ? findPrice(catalogue, offer.id, market) : undefined;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        {issues.length ? (
          <div className="space-y-2">
            {issues.map((i) => (
              <div
                key={i.id}
                className={`rounded-md border px-3 py-2 text-sm ${
                  i.severity === "error" ? "border-destructive/50 bg-destructive/5" : "bg-secondary"
                }`}
                role={i.severity === "error" ? "alert" : undefined}
              >
                <div className="flex items-center gap-2">
                  <Badge variant={i.severity === "error" ? "destructive" : "outline"}>
                    {i.severity === "error" ? "Blocking" : "Note"}
                  </Badge>
                  <span className="font-medium">{i.message}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{i.reason}</p>
              </div>
            ))}
          </div>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tenant &amp; market</CardTitle>
            <CardDescription>Published catalogue v{catalogue.version} · no Workspace plan required</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-3">
              <Label className="text-xs text-muted-foreground">Tenant</Label>
              <Select
                value={tenantId}
                onValueChange={(v) => {
                  setTenantId(v);
                  const t = state.tenants.find((x) => x.id === v);
                  if (t) setMarket(t.primaryMarket);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {state.tenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} · {t.contactEmail}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Market</Label>
              <Select value={market} onValueChange={(v) => setMarket(v as MarketId)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {catalogue.markets
                    .filter((m) => m.active)
                    .map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Currency</Label>
              <Input readOnly value={marketRow.currency} aria-label="Currency" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Billing cycle</Label>
              <Tabs value={cycle} onValueChange={(v) => setCycle(v as BillingCycle)}>
                <TabsList className="w-full">
                  <TabsTrigger className="flex-1" value="monthly">
                    Monthly
                  </TabsTrigger>
                  <TabsTrigger className="flex-1" value="annual">
                    Annual
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Standalone Aura offering</CardTitle>
            <CardDescription>
              Only connectors marked as a standalone Aura offering can be sold this way. Others remain available
              through an Aurumi Workspace subscription.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {offers.map((o) => {
              const connector = catalogue.connectors.find((c) => c.id === o.connectorId);
              const rule = findPrice(catalogue, o.id, market);
              const selected = o.id === offerId;
              const sellableHere = o.eligibleMarkets.includes(market);
              return (
                <button
                  key={o.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setOfferId(o.id)}
                  className={`rounded-lg border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    selected ? "border-accent bg-secondary" : "hover:bg-secondary/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-display font-semibold">{o.name}</span>
                    {selected ? <Badge>Selected</Badge> : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{o.description}</p>
                  <div className="mt-3 tabular text-lg">
                    {o.quoteOnly || rule?.quoteOnly || !sellableHere
                      ? "Custom quote"
                      : `${formatMoney(cycle === "monthly" ? (rule?.monthly ?? null) : (rule?.annual ?? null), marketRow.currency)} / ${cycle === "monthly" ? "mo" : "yr"}`}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Connector: {connector?.name ?? o.connectorId} · {o.includedUsers ?? "—"} users ·{" "}
                    {(o.includedIntelligence ?? 0).toLocaleString()} AIC/mo
                  </div>
                </button>
              );
            })}
            {offers.length === 0 ? (
              <p className="text-sm text-muted-foreground sm:col-span-2">
                No standalone Aura offers are published yet.
              </p>
            ) : null}
          </CardContent>
        </Card>

        {offer ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Add-ons</CardTitle>
              <CardDescription>Only add-ons enabled for {offer.name} can be purchased with it.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {offerAddOns.map((a) => {
                const rule = findPrice(catalogue, a.id, market);
                const qty = addonQty[a.id] ?? 0;
                const invalid = qty > 0 && qty % a.quantityStep !== 0;
                return (
                  <div key={a.id} className="rounded-md border px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium">{a.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {a.unitLabel} ·{" "}
                          {formatMoney(
                            cycle === "monthly" ? (rule?.monthly ?? null) : (rule?.annual ?? null),
                            marketRow.currency,
                          )}{" "}
                          per unit · 1 unit = {a.unitSize.toLocaleString()} {a.unit}
                        </div>
                      </div>
                      <Input
                        type="number"
                        min={0}
                        step={a.quantityStep}
                        max={a.maxQuantity ?? undefined}
                        aria-label={`${a.name} quantity`}
                        aria-invalid={invalid}
                        className="w-24 tabular"
                        value={qty}
                        onChange={(e) => setAddonQty({ ...addonQty, [a.id]: Math.max(0, Number(e.target.value)) })}
                      />
                    </div>
                    {invalid ? (
                      <p className="mt-1 text-xs text-destructive">Sold in increments of {a.quantityStep}.</p>
                    ) : null}
                  </div>
                );
              })}
              {invalidAddOns.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2"
                >
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {a.name}
                      <Badge variant="destructive">Unavailable</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Quantity {a.quantity} still selected · {a.reason}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => clearAddOn(a.id)}>
                    Remove
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {offer ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Review</CardTitle>
              <CardDescription>{offer.connectorCommercialTerms}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5 text-sm">
                {lines.map((l) => (
                  <div key={l.id} className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2">
                      <Badge variant={l.chargeClass === "included" ? "secondary" : "outline"} className="shrink-0">
                        {CHARGE_CLASS_LABEL[l.chargeClass]}
                      </Badge>
                      <span className="truncate">
                        {l.label}
                        {l.recurring ? "" : " · one-time"}
                      </span>
                    </span>
                    <span className="tabular shrink-0">
                      {l.quoteOnly ? "Quoted" : formatMoney(l.unitAmount * l.quantity, totals.currency)}
                    </span>
                  </div>
                ))}
              </div>
              <Separator />
              {needsQuote ? (
                <div className="rounded-md border bg-secondary px-3 py-2 text-xs">
                  <div className="text-sm font-medium">Quote required</div>
                  <p className="mt-1 text-muted-foreground">
                    This Aura configuration has no calculable price. No simulated payment is taken.
                  </p>
                  <ul className="mt-1 list-disc pl-4 text-muted-foreground">
                    {quoteWhy.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Payment provider for {marketRow.name}: <strong>{marketRow.paymentProvider}</strong>. Checkout is
                  <strong> simulated</strong> — confirming records the subscription as
                  <strong> pending payment</strong>. No card details are collected.
                  {offerRule?.annualDiscountPct && cycle === "annual"
                    ? ` Annual pricing reflects the configured ${offerRule.annualDiscountPct}% treatment.`
                    : ""}
                </p>
              )}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="outline" className="sm:flex-1" onClick={() => confirm("draft")} disabled={!tenant}>
                  Save as draft
                </Button>
                <Button
                  className="sm:flex-1"
                  onClick={() => confirm("commit")}
                  disabled={!tenant || errors.length > 0}
                >
                  {errors.length
                    ? `Resolve ${errors.length} blocking issue(s)`
                    : needsQuote
                      ? "Request quote"
                      : "Confirm — proceed to simulated payment"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <div className="space-y-4">
        <Card className="lg:sticky lg:top-20">
          <CardHeader>
            <CardTitle className="text-base">Order summary</CardTitle>
            <CardDescription>
              {tenant?.name ?? "No tenant"} · {marketRow.name} · {cycle} · standalone Aura
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <SummaryRow label="Recurring subtotal" value={formatMoney(totals.recurringSubtotal, totals.currency)} />
            <SummaryRow
              label={`${totals.taxName} (${totals.taxRatePct}%) — simulated`}
              value={formatMoney(totals.tax, totals.currency)}
            />
            <Separator />
            <SummaryRow
              label={`Recurring ${cycle === "monthly" ? "monthly" : "annual"} charge`}
              value={formatMoney(totals.recurringTotal, totals.currency)}
              strong
            />
            {cycle === "annual" ? (
              <div className="text-xs text-muted-foreground">
                Monthly equivalent {formatMoney(totals.monthlyEquivalent ?? 0, totals.currency)}
              </div>
            ) : null}
            <SummaryRow label="Total payable now" value={formatMoney(totals.total, totals.currency)} strong />
            {lines.some((l) => l.quoteOnly) ? (
              <p className="text-xs text-muted-foreground">Quote-only items are excluded from calculated totals.</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resulting tenant entitlements</CardTitle>
            <CardDescription>Tenant-level only — user and role access lives in Tenant Administration.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            {summary.map((e) => (
              <div key={e.key} className="flex justify-between gap-3">
                <span>{ENTITLEMENT_LABELS[e.key] ?? e.key}</span>
                <span className="tabular text-right text-muted-foreground">
                  {e.total > 0 ? `${e.total.toLocaleString()} ${e.unit ?? ""}` : e.labels.join(", ")}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${strong ? "font-semibold" : ""}`}>
      <span>{label}</span>
      <span className="tabular">{value}</span>
    </div>
  );
}
