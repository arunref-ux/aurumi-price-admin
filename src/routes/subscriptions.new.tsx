import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AdminLayout, PageHeader } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCommerce } from "@/lib/commerce/store";
import { activePromotions, findPrice, formatMoney } from "@/lib/commerce/pricing";
import { addOnCapacities, buildQuote, CHARGE_CLASS_LABEL } from "@/lib/commerce/cart";
import {
  ineligibleAddOnSelections,
  quoteReasons,
  validateSelection,
  type Selection,
} from "@/lib/commerce/validation";
import { deriveEntitlements, ENTITLEMENT_LABELS, summariseEntitlements } from "@/lib/commerce/entitlements";
import type { BillingCycle, MarketId, TenantSubscription } from "@/lib/commerce/types";
import { toast } from "sonner";

export const Route = createFileRoute("/subscriptions/new")({
  head: () => ({
    meta: [
      { title: "Subscription Builder | Aurumi Price Admin" },
      {
        name: "description",
        content:
          "Configure a tenant purchase from the published Aurumi catalogue: plan, premium apps, connectors, capacity add-ons, promotions and simulated checkout.",
      },
      { property: "og:title", content: "Subscription Builder | Aurumi Price Admin" },
      { property: "og:description", content: "Configure what a specific Aurumi tenant has purchased." },
    ],
  }),
  component: BuilderPage,
});

const STEPS = ["Tenant", "Plan", "Entitlements", "Premium Apps", "Connectors", "Capacity", "Review"] as const;

function BuilderPage() {
  const { published, state, saveSubscription } = useCommerce();
  const catalogue = published;
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [tenantId, setTenantId] = useState(state.tenants[0]?.id ?? "");
  const tenant = state.tenants.find((t) => t.id === tenantId);
  const [market, setMarket] = useState<MarketId>(tenant?.primaryMarket ?? catalogue.settings.defaultMarket);
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [planId, setPlanId] = useState(catalogue.plans[1]?.id ?? catalogue.plans[0]?.id ?? "");
  const [premiumAppIds, setPremiumAppIds] = useState<string[]>([]);
  const [connectorIds, setConnectorIds] = useState<string[]>([]);
  const [addonQty, setAddonQty] = useState<Record<string, number>>({});
  const [promoCode, setPromoCode] = useState("");

  const plan = catalogue.plans.find((p) => p.id === planId);
  const marketRow = catalogue.markets.find((m) => m.id === market) ?? catalogue.markets[0]!;

  const selection: Selection = { planId, market, cycle, premiumAppIds, connectorIds, addonQty };
  const issues = useMemo(() => validateSelection(catalogue, selection), [catalogue, JSON.stringify(selection)]);
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");

  const invalidAddOns = useMemo(
    () => ineligibleAddOnSelections(catalogue, selection),
    [catalogue, JSON.stringify(selection)],
  );
  const quoteWhy = useMemo(() => quoteReasons(catalogue, selection), [catalogue, JSON.stringify(selection)]);
  const needsQuote = quoteWhy.length > 0;

  // Surface add-ons that became ineligible after a plan or market change.
  const eligibilityKey = `${planId}|${market}`;
  const lastEligibilityKey = useRef(eligibilityKey);
  useEffect(() => {
    if (lastEligibilityKey.current === eligibilityKey) return;
    lastEligibilityKey.current = eligibilityKey;
    if (invalidAddOns.length) {
      toast.warning(
        `${invalidAddOns.length} selected add-on(s) are not available for this plan/market — review the Capacity step.`,
      );
    }
  }, [eligibilityKey, invalidAddOns.length]);

  const clearAddOn = (id: string) => {
    const next = { ...addonQty };
    delete next[id];
    setAddonQty(next);
  };

  const promos = plan ? activePromotions(catalogue, plan.id, market, cycle, promoCode || null) : [];
  const { lines, totals } = useMemo(
    () => buildQuote(catalogue, selection, promoCode ? promos : []),
    [catalogue, JSON.stringify(selection), promoCode, promos.length],
  );

  const capacities = addOnCapacities(catalogue, addonQty);
  const standardConnectorIds = connectorIds.filter(
    (id) => catalogue.connectors.find((c) => c.id === id)?.classification === "Standard",
  );
  const additionalConnectorIds = connectorIds.filter((id) => !standardConnectorIds.includes(id));

  const entitlements = deriveEntitlements(catalogue, {
    planId,
    premiumAppIds,
    standardConnectorIds,
    additionalConnectorIds,
    ...capacities,
  });
  const summary = summariseEntitlements(entitlements);
  const includedStd = plan?.custom ? null : (plan?.includedStandardConnectors ?? 0);

  const confirm = () => {
    if (!tenant || !plan || errors.length) return;
    const now = new Date();
    const renewal = new Date(now);
    if (cycle === "annual") renewal.setFullYear(renewal.getFullYear() + 1);
    else renewal.setMonth(renewal.getMonth() + 1);
    const stamp = (
      type: TenantSubscription["changeLog"][number]["type"],
      description: string,
    ) => ({
      id: `chg.${Math.random().toString(36).slice(2, 8)}`,
      type,
      description,
      timing: "immediate" as const,
      prorated: false,
      effectiveDate: now.toISOString(),
      createdAt: now.toISOString(),
    });

    const sub: TenantSubscription = {
      id: `sub.${Math.random().toString(36).slice(2, 9)}`,
      tenantId: tenant.id,
      planId: plan.id,
      market,
      currency: marketRow.currency,
      billingCycle: cycle,
      // Simulated lifecycle: DRAFT -> PENDING PAYMENT -> ACTIVE.
      status: "pending_payment",
      includedUsers: plan.includedUsers,
      additionalUsers: capacities.additionalUsers,
      standardAppsEntitled: true,
      premiumAppIds,
      standardConnectorIds,
      additionalConnectorIds,
      additionalIntelligence: capacities.additionalIntelligence,
      additionalStorageGb: capacities.additionalStorageGb,
      additionalTransferGb: capacities.additionalTransferGb,
      lines,
      totals,
      promotionCode: promoCode || null,
      catalogueVersion: catalogue.version,
      paymentProvider: marketRow.paymentProvider,
      paymentMode: "simulated",
      paymentStatus: "awaiting_simulated_payment",
      startDate: now.toISOString(),
      renewalDate: renewal.toISOString(),
      cancellationRequested: false,
      cancellationEffective: null,
      entitlements,
      changeLog: [
        stamp("created", `Subscription drafted on ${plan.name} from catalogue v${catalogue.version}`),
      ],
    };
    saveSubscription(sub);
    toast.success("Subscription created — awaiting simulated payment");
    navigate({ to: "/tenants" });
  };

  return (
    <AdminLayout>
      <PageHeader
        title="Tenant Subscription Builder"
        description="Commercial configuration answers “what can Aurumi sell?”. This answers “what has this tenant purchased?”. Prices are read from the published catalogue only; user- and role-level access is handled in Tenant Administration."
      />

      <div className="mb-4 -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {STEPS.map((s, i) => (
          <Button
            key={s}
            size="sm"
            className="shrink-0"
            variant={i === step ? "default" : "outline"}
            onClick={() => setStep(i)}
          >
            {i + 1}. {s}
          </Button>
        ))}
      </div>

      {issues.length ? (
        <div className="mb-4 space-y-2">
          {[...errors, ...warnings].map((i) => (
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

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{STEPS[step]}</CardTitle>
            <CardDescription>
              Step {step + 1} of {STEPS.length} · published catalogue v{catalogue.version}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {step === 0 ? (
              <div className="grid gap-3 sm:grid-cols-3">
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
              </div>
            ) : null}

            {step === 1 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {catalogue.plans
                  .filter((p) => p.active && p.eligibleMarkets.includes(market))
                  .map((p) => {
                    const rule = findPrice(catalogue, p.id, market);
                    const selected = p.id === planId;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setPlanId(p.id)}
                        className={`rounded-lg border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected ? "border-accent bg-secondary" : "hover:bg-secondary/50"}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-display font-semibold">{p.name}</span>
                          {selected ? <Badge>Selected</Badge> : null}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{p.description}</p>
                        <div className="mt-3 tabular text-lg">
                          {p.custom || rule?.quoteOnly
                            ? "Custom quote"
                            : `${formatMoney(cycle === "monthly" ? (rule?.monthly ?? null) : (rule?.annual ?? null), marketRow.currency)} / ${cycle === "monthly" ? "mo" : "yr"}`}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {p.custom
                            ? "Custom capacity · all Standard Apps"
                            : `${p.includedUsers} users · all Standard Apps · ${p.includedStandardConnectors} Standard Connectors`}
                        </div>
                      </button>
                    );
                  })}
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-2">
                {summary.map((e) => (
                  <div key={e.key} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <span>{ENTITLEMENT_LABELS[e.key] ?? e.key}</span>
                    <span className="tabular text-muted-foreground">
                      {e.total > 0 ? `${e.total.toLocaleString()} ${e.unit ?? ""}` : e.labels.join(", ")}
                    </span>
                  </div>
                ))}
                <p className="pt-2 text-xs text-muted-foreground">
                  These are tenant-level commercial entitlements, derived from the plan and add-ons. Which users or
                  roles may use them is decided in Tenant Administration / RBAC, not here.
                </p>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Every paid workspace includes all Standard Aurumi Apps. Premium Apps are purchased as add-ons.
                </p>
                {catalogue.apps
                  .filter((a) => a.classification === "Premium" && a.active)
                  .map((a) => {
                    const rule = findPrice(catalogue, a.id, market);
                    const eligible = a.eligiblePlans.includes(planId);
                    const on = premiumAppIds.includes(a.id);
                    return (
                      <label
                        key={a.id}
                        className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 ${eligible || on ? "" : "opacity-50"}`}
                      >
                        <span className="flex items-center gap-3">
                          <Checkbox
                            checked={on}
                            disabled={!eligible && !on}
                            onCheckedChange={(v) =>
                              setPremiumAppIds(v ? [...premiumAppIds, a.id] : premiumAppIds.filter((x) => x !== a.id))
                            }
                          />
                          <span>
                            <span className="text-sm font-medium">{a.name}</span>
                            <span className="block text-xs text-muted-foreground">
                              {a.category} · {eligible ? a.description : "Not available on the selected plan"}
                            </span>
                          </span>
                        </span>
                        <span className="shrink-0 text-right text-sm">
                          <Badge variant="outline">Add-on</Badge>
                          <span className="mt-1 block tabular">
                            {formatMoney(
                              cycle === "monthly" ? (rule?.monthly ?? null) : (rule?.annual ?? null),
                              marketRow.currency,
                            )}
                          </span>
                        </span>
                      </label>
                    );
                  })}
              </div>
            ) : null}

            {step === 4 ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Standard Connectors consume the plan allowance
                  {includedStd !== null ? ` (${standardConnectorIds.length} of ${includedStd} used)` : " (custom)"}.
                  Additional and Custom Connectors are charged separately and may carry one-time implementation work.
                </p>
                {catalogue.connectors
                  .filter((c) => c.active)
                  .map((c) => {
                    const rec = findPrice(catalogue, c.id, market);
                    const setup = findPrice(catalogue, `${c.id}:setup`, market);
                    const on = connectorIds.includes(c.id);
                    const eligible = c.eligiblePlans.includes(planId);
                    const isStandard = c.classification === "Standard";
                    const idx = standardConnectorIds.indexOf(c.id);
                    const withinAllowance =
                      isStandard && (includedStd === null || (idx >= 0 ? idx < includedStd : standardConnectorIds.length < includedStd));
                    const badge = c.quoteOnly
                      ? "Custom / quote"
                      : isStandard && withinAllowance && !c.hasRecurringPrice
                        ? "Included"
                        : "Additional charge";
                    return (
                      <label
                        key={c.id}
                        className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 ${eligible || on ? "" : "opacity-50"}`}
                      >
                        <span className="flex items-center gap-3">
                          <Checkbox
                            checked={on}
                            disabled={!eligible && !on}
                            onCheckedChange={(v) =>
                              setConnectorIds(v ? [...connectorIds, c.id] : connectorIds.filter((x) => x !== c.id))
                            }
                          />
                          <span>
                            <span className="text-sm font-medium">{c.name}</span>
                            <span className="block text-xs text-muted-foreground">
                              {c.classification} · {c.setupMode}
                              {c.professionalServicesRequired ? " · Professional services" : ""}
                            </span>
                          </span>
                        </span>
                        <span className="shrink-0 text-right text-xs tabular">
                          <Badge variant={badge === "Included" ? "secondary" : "outline"}>{badge}</Badge>
                          {c.hasRecurringPrice && !c.quoteOnly ? (
                            <div className="mt-1">
                              {formatMoney(
                                cycle === "monthly" ? (rec?.monthly ?? null) : (rec?.annual ?? null),
                                marketRow.currency,
                              )}{" "}
                              recurring
                            </div>
                          ) : null}
                          {c.hasOneTimePrice ? (
                            <div className="text-muted-foreground">
                              {formatMoney(setup?.monthly ?? null, marketRow.currency)} one-time
                            </div>
                          ) : null}
                        </span>
                      </label>
                    );
                  })}
              </div>
            ) : null}

            {step === 5 ? (
              <div className="space-y-3">
                {catalogue.addOns
                  .filter((a) => a.active && a.eligiblePlans.includes(planId) && a.eligibleMarkets.includes(market))
                  .map((a) => {
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
                            onChange={(e) =>
                              setAddonQty({ ...addonQty, [a.id]: Math.max(0, Number(e.target.value)) })
                            }
                          />
                        </div>
                        {invalid ? (
                          <p className="mt-1 text-xs text-destructive">
                            Sold in increments of {a.quantityStep}.
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
              </div>
            ) : null}

            {step === 6 ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground" htmlFor="promo">
                    Promotion code
                  </Label>
                  <Input
                    id="promo"
                    placeholder="e.g. AURUMI20"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                  />
                  {promoCode && promos.length === 0 ? (
                    <p className="text-xs text-destructive">No active promotion matches this code for the selection.</p>
                  ) : null}
                </div>
                <Separator />
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
                        {l.quoteOnly
                          ? "Quoted"
                          : l.chargeClass === "included"
                            ? "Included"
                            : formatMoney(l.unitAmount * l.quantity, totals.currency)}
                      </span>
                    </div>
                  ))}
                </div>
                <Separator />
                <p className="text-xs text-muted-foreground">
                  Payment provider for {marketRow.name}: <strong>{marketRow.paymentProvider}</strong>. Checkout is
                  <strong> simulated</strong> in this prototype — confirming records the subscription as
                  <strong> pending payment</strong>. A real payment provider will determine the verified payment state
                  in a later phase. No card details are collected.
                </p>
                <Button className="w-full" onClick={confirm} disabled={!tenant || !plan || errors.length > 0}>
                  {errors.length ? `Resolve ${errors.length} blocking issue(s)` : "Create subscription (simulated)"}
                </Button>
              </div>
            ) : null}

            <div className="flex justify-between pt-2">
              <Button variant="outline" disabled={step === 0} onClick={() => setStep(step - 1)}>
                Back
              </Button>
              <Button disabled={step === STEPS.length - 1} onClick={() => setStep(step + 1)}>
                Continue
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="lg:sticky lg:top-20">
            <CardHeader>
              <CardTitle className="text-base">Order summary</CardTitle>
              <CardDescription>
                {tenant?.name ?? "No tenant"} · {marketRow.name} · {cycle}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Recurring subtotal" value={formatMoney(totals.recurringSubtotal, totals.currency)} />
              <Row label="One-time subtotal" value={formatMoney(totals.oneTimeSubtotal, totals.currency)} />
              <Row label="Promotions" value={`− ${formatMoney(totals.discount, totals.currency)}`} />
              <Row
                label={`${totals.taxName} (${totals.taxRatePct}%) — simulated`}
                value={formatMoney(totals.tax, totals.currency)}
              />
              <Separator />
              <Row
                label={`Recurring ${cycle === "monthly" ? "monthly" : "annual"} charge`}
                value={formatMoney(totals.recurringTotal, totals.currency)}
                strong
              />
              {cycle === "annual" ? (
                <div className="text-xs text-muted-foreground">
                  Monthly equivalent {formatMoney(totals.monthlyEquivalent ?? 0, totals.currency)}
                </div>
              ) : null}
              <Row label="One-time charges" value={formatMoney(totals.oneTimeTotal, totals.currency)} strong />
              <Separator />
              <Row label="Total payable now" value={formatMoney(totals.total, totals.currency)} strong />
              {lines.some((l) => l.quoteOnly) ? (
                <p className="text-xs text-muted-foreground">
                  Quote-only items are excluded from calculated totals.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resulting tenant entitlements</CardTitle>
              <CardDescription>Derived from plan + add-ons.</CardDescription>
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
    </AdminLayout>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${strong ? "font-semibold" : ""}`}>
      <span>{label}</span>
      <span className="tabular">{value}</span>
    </div>
  );
}
