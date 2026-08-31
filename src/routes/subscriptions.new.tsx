import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
import { activePromotions, computeTotals, findPrice, formatMoney } from "@/lib/commerce/pricing";
import { ADDON_UNIT_SIZE } from "@/lib/commerce/seed";
import { deriveEntitlements, ENTITLEMENT_LABELS, summariseEntitlements } from "@/lib/commerce/entitlements";
import type { BillingCycle, CartLine, MarketId, TenantSubscription } from "@/lib/commerce/types";
import { toast } from "sonner";

export const Route = createFileRoute("/subscriptions/new")({
  head: () => ({
    meta: [
      { title: "Subscription Builder | Aurumi Admin" },
      {
        name: "description",
        content:
          "Build a tenant subscription: select tenant and plan, review entitlements, add premium apps, connectors and capacity, then confirm the order.",
      },
      { property: "og:title", content: "Subscription Builder | Aurumi Admin" },
      { property: "og:description", content: "Configure what a specific Aurumi tenant has purchased." },
    ],
  }),
  component: BuilderPage,
});

const STEPS = [
  "Tenant",
  "Plan",
  "Entitlements",
  "Premium Apps",
  "Connectors",
  "Capacity",
  "Review order",
] as const;

function BuilderPage() {
  const { published, draft, state, saveSubscription } = useCommerce();
  const catalogue = published;
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [tenantId, setTenantId] = useState(state.tenants[0]?.id ?? "");
  const tenant = state.tenants.find((t) => t.id === tenantId);
  const [market, setMarket] = useState<MarketId>(tenant?.primaryMarket ?? draft.settings.defaultMarket);
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [planId, setPlanId] = useState(catalogue.plans[1]?.id ?? "");
  const [premiumAppIds, setPremiumAppIds] = useState<string[]>([]);
  const [connectorIds, setConnectorIds] = useState<string[]>([]);
  const [addonQty, setAddonQty] = useState<Record<string, number>>({});
  const [promoCode, setPromoCode] = useState("");

  const plan = catalogue.plans.find((p) => p.id === planId);
  const marketRow = catalogue.markets.find((m) => m.id === market)!;

  const standardConnectorIds = connectorIds.filter(
    (id) => catalogue.connectors.find((c) => c.id === id)?.classification === "Standard",
  );
  const additionalConnectorIds = connectorIds.filter((id) => !standardConnectorIds.includes(id));

  const lines: CartLine[] = useMemo(() => {
    const out: CartLine[] = [];
    if (plan) {
      const rule = findPrice(catalogue, plan.id, market);
      out.push({
        id: `plan-${plan.id}`,
        productId: plan.id,
        kind: "plan",
        label: `${plan.name} plan (${cycle})`,
        quantity: 1,
        unitAmount: (cycle === "monthly" ? rule?.monthly : rule?.annual) ?? 0,
        recurring: true,
        quoteOnly: rule?.quoteOnly || plan.custom,
      });
    }
    for (const id of premiumAppIds) {
      const app = catalogue.apps.find((a) => a.id === id)!;
      const rule = findPrice(catalogue, id, market);
      out.push({
        id: `app-${id}`,
        productId: id,
        kind: "premium_app",
        label: `Premium App · ${app.name}`,
        quantity: 1,
        unitAmount: (cycle === "monthly" ? rule?.monthly : rule?.annual) ?? 0,
        recurring: true,
      });
    }
    for (const id of connectorIds) {
      const c = catalogue.connectors.find((x) => x.id === id)!;
      if (c.hasRecurringPrice) {
        const rule = findPrice(catalogue, id, market);
        out.push({
          id: `conn-${id}`,
          productId: id,
          kind: "connector",
          label: `${c.classification} Connector · ${c.name}`,
          quantity: 1,
          unitAmount: (cycle === "monthly" ? rule?.monthly : rule?.annual) ?? 0,
          recurring: true,
          quoteOnly: c.quoteOnly,
        });
      }
      if (c.hasOneTimePrice) {
        const rule = findPrice(catalogue, `${id}:setup`, market);
        out.push({
          id: `conn-setup-${id}`,
          productId: `${id}:setup`,
          kind: "connector_setup",
          label: `Implementation · ${c.name}`,
          quantity: 1,
          unitAmount: rule?.monthly ?? 0,
          recurring: false,
          quoteOnly: c.quoteOnly,
        });
      }
      if (c.quoteOnly && !c.hasRecurringPrice && !c.hasOneTimePrice) {
        out.push({
          id: `conn-quote-${id}`,
          productId: id,
          kind: "connector",
          label: `${c.name} (custom quote)`,
          quantity: 1,
          unitAmount: 0,
          recurring: true,
          quoteOnly: true,
        });
      }
    }
    for (const [id, qty] of Object.entries(addonQty)) {
      if (!qty) continue;
      const addon = catalogue.addOns.find((a) => a.id === id)!;
      const rule = findPrice(catalogue, id, market);
      out.push({
        id: `addon-${id}`,
        productId: id,
        kind: "addon",
        label: `${addon.name} × ${qty}`,
        quantity: qty,
        unitAmount: (cycle === "monthly" ? rule?.monthly : rule?.annual) ?? 0,
        recurring: true,
      });
    }
    return out;
  }, [catalogue, plan, market, cycle, premiumAppIds, connectorIds, addonQty]);

  const promos = plan ? activePromotions(catalogue, plan.id, market, cycle, promoCode || null) : [];
  const totals = computeTotals(catalogue, lines, market, cycle, promoCode ? promos : []);

  const subShape = {
    planId,
    additionalUsers: addonQty["addon.users"] ?? 0,
    premiumAppIds,
    standardConnectorIds,
    additionalConnectorIds,
    additionalIntelligence: (addonQty["addon.intelligence"] ?? 0) * (ADDON_UNIT_SIZE["addon.intelligence"] ?? 1),
    additionalStorageGb: (addonQty["addon.storage"] ?? 0) * (ADDON_UNIT_SIZE["addon.storage"] ?? 1),
    additionalTransferGb: (addonQty["addon.transfer"] ?? 0) * (ADDON_UNIT_SIZE["addon.transfer"] ?? 1),
  };
  const entitlements = deriveEntitlements(catalogue, subShape);
  const summary = summariseEntitlements(entitlements);

  const confirm = () => {
    if (!tenant || !plan) return;
    const now = new Date();
    const renewal = new Date(now);
    if (cycle === "annual") renewal.setFullYear(renewal.getFullYear() + 1);
    else renewal.setMonth(renewal.getMonth() + 1);

    const sub: TenantSubscription = {
      id: `sub.${Math.random().toString(36).slice(2, 9)}`,
      tenantId: tenant.id,
      planId: plan.id,
      market,
      currency: marketRow.currency,
      billingCycle: cycle,
      status: "active",
      includedUsers: plan.includedUsers,
      additionalUsers: subShape.additionalUsers,
      standardAppsEntitled: true,
      premiumAppIds,
      standardConnectorIds,
      additionalConnectorIds,
      additionalIntelligence: subShape.additionalIntelligence,
      additionalStorageGb: subShape.additionalStorageGb,
      additionalTransferGb: subShape.additionalTransferGb,
      lines,
      totals,
      promotionCode: promoCode || null,
      paymentProvider: marketRow.paymentProvider,
      paymentStatus: "mock_paid",
      startDate: now.toISOString(),
      renewalDate: renewal.toISOString(),
      cancellationRequested: false,
      cancellationEffective: null,
      entitlements,
      changeLog: [
        {
          id: `chg.${Math.random().toString(36).slice(2, 8)}`,
          type: "created",
          description: `Subscription created on ${plan.name}`,
          timing: "immediate",
          prorated: false,
          effectiveDate: now.toISOString(),
          createdAt: now.toISOString(),
        },
      ],
    };
    saveSubscription(sub);
    toast.success("Subscription confirmed (checkout simulated — no payment was taken)");
    navigate({ to: "/tenants" });
  };

  return (
    <AdminLayout>
      <PageHeader
        title="Tenant Subscription Builder"
        description="Commercial configuration answers “what does Aurumi sell?”. This answers “what has this tenant purchased?”. Every price below is read from the published catalogue."
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {STEPS.map((s, i) => (
          <Button key={s} size="sm" variant={i === step ? "default" : "outline"} onClick={() => setStep(i)}>
            {i + 1}. {s}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{STEPS[step]}</CardTitle>
            <CardDescription>Step {step + 1} of {STEPS.length}</CardDescription>
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
                      {catalogue.markets.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Currency</Label>
                  <Input readOnly value={marketRow.currency} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Billing cycle</Label>
                  <Tabs value={cycle} onValueChange={(v) => setCycle(v as BillingCycle)}>
                    <TabsList className="w-full">
                      <TabsTrigger className="flex-1" value="monthly">Monthly</TabsTrigger>
                      <TabsTrigger className="flex-1" value="annual">Annual</TabsTrigger>
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
                        onClick={() => setPlanId(p.id)}
                        className={`rounded-lg border p-4 text-left transition-colors ${selected ? "border-accent bg-secondary" : "hover:bg-secondary/50"}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-display font-semibold">{p.name}</span>
                          {selected ? <Badge>Selected</Badge> : null}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{p.description}</p>
                        <div className="mt-3 tabular text-lg">
                          {p.custom || rule?.quoteOnly
                            ? "Custom quote"
                            : `${formatMoney(cycle === "monthly" ? rule?.monthly ?? null : rule?.annual ?? null, marketRow.currency)} / ${cycle === "monthly" ? "mo" : "yr"}`}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {p.custom ? "Custom capacity" : `${p.includedUsers} users included`}
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
                  Tenant entitlements are not user access. The tenant administrator decides which users and roles
                  can open which apps.
                </p>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="space-y-2">
                {catalogue.apps
                  .filter((a) => a.classification === "Premium" && a.active)
                  .map((a) => {
                    const rule = findPrice(catalogue, a.id, market);
                    const eligible = a.eligiblePlans.includes(planId);
                    const on = premiumAppIds.includes(a.id);
                    return (
                      <label
                        key={a.id}
                        className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 ${eligible ? "" : "opacity-50"}`}
                      >
                        <span className="flex items-center gap-3">
                          <Checkbox
                            checked={on}
                            disabled={!eligible}
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
                        <span className="tabular text-sm">
                          {formatMoney(cycle === "monthly" ? rule?.monthly ?? null : rule?.annual ?? null, marketRow.currency)}
                        </span>
                      </label>
                    );
                  })}
              </div>
            ) : null}

            {step === 4 ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Standard Connectors count against the plan allowance
                  {plan && !plan.custom ? ` (${standardConnectorIds.length}/${plan.includedStandardConnectors} used)` : ""}.
                  Additional and Custom Connectors are charged separately and may require Aurumi-assisted
                  implementation.
                </p>
                {catalogue.connectors
                  .filter((c) => c.active)
                  .map((c) => {
                    const rec = findPrice(catalogue, c.id, market);
                    const setup = findPrice(catalogue, `${c.id}:setup`, market);
                    const on = connectorIds.includes(c.id);
                    const eligible = c.eligiblePlans.includes(planId);
                    return (
                      <label
                        key={c.id}
                        className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 ${eligible ? "" : "opacity-50"}`}
                      >
                        <span className="flex items-center gap-3">
                          <Checkbox
                            checked={on}
                            disabled={!eligible}
                            onCheckedChange={(v) =>
                              setConnectorIds(v ? [...connectorIds, c.id] : connectorIds.filter((x) => x !== c.id))
                            }
                          />
                          <span>
                            <span className="text-sm font-medium">{c.name}</span>
                            <span className="block text-xs text-muted-foreground">
                              {c.classification} · {c.setupMode}
                              {c.professionalServicesRequired ? " · Professional services required" : ""}
                            </span>
                          </span>
                        </span>
                        <span className="text-right text-xs tabular">
                          {c.quoteOnly ? (
                            "Custom quote"
                          ) : (
                            <>
                              <div>
                                {c.hasRecurringPrice
                                  ? `${formatMoney(cycle === "monthly" ? rec?.monthly ?? null : rec?.annual ?? null, marketRow.currency)} recurring`
                                  : "Included in plan"}
                              </div>
                              {c.hasOneTimePrice ? (
                                <div className="text-muted-foreground">
                                  {formatMoney(setup?.monthly ?? null, marketRow.currency)} one-time
                                </div>
                              ) : null}
                            </>
                          )}
                        </span>
                      </label>
                    );
                  })}
              </div>
            ) : null}

            {step === 5 ? (
              <div className="space-y-3">
                {catalogue.addOns
                  .filter((a) => a.active && a.eligiblePlans.includes(planId))
                  .map((a) => {
                    const rule = findPrice(catalogue, a.id, market);
                    const qty = addonQty[a.id] ?? 0;
                    return (
                      <div key={a.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                        <div>
                          <div className="text-sm font-medium">{a.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {a.unitLabel} ·{" "}
                            {formatMoney(cycle === "monthly" ? rule?.monthly ?? null : rule?.annual ?? null, marketRow.currency)}{" "}
                            per unit
                          </div>
                        </div>
                        <Input
                          type="number"
                          min={0}
                          max={a.maxQuantity ?? undefined}
                          className="w-24 tabular"
                          value={qty}
                          onChange={(e) => setAddonQty({ ...addonQty, [a.id]: Math.max(0, Number(e.target.value)) })}
                        />
                      </div>
                    );
                  })}
              </div>
            ) : null}

            {step === 6 ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Promotion code</Label>
                  <Input
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
                    <div key={l.id} className="flex justify-between">
                      <span>
                        {l.label}
                        {l.recurring ? "" : " (one-time)"}
                      </span>
                      <span className="tabular">
                        {l.quoteOnly ? "Quoted" : formatMoney(l.unitAmount * l.quantity, totals.currency)}
                      </span>
                    </div>
                  ))}
                </div>
                <Separator />
                <p className="text-xs text-muted-foreground">
                  Payment provider for {marketRow.name}: <strong>{marketRow.paymentProvider}</strong>. Checkout is
                  simulated in this version — confirming records the subscription and its entitlements without
                  creating a real payment.
                </p>
                <Button className="w-full" onClick={confirm} disabled={!tenant || !plan}>
                  Confirm subscription (simulated checkout)
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
          <Card className="sticky top-20">
            <CardHeader>
              <CardTitle className="text-base">Order summary</CardTitle>
              <CardDescription>
                {tenant?.name ?? "No tenant"} · {marketRow.name} · {cycle}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Recurring subtotal" value={formatMoney(totals.recurringSubtotal, totals.currency)} />
              <Row label="One-time subtotal" value={formatMoney(totals.oneTimeSubtotal, totals.currency)} />
              <Row label="Discount" value={`− ${formatMoney(totals.discount, totals.currency)}`} />
              <Row
                label={`${totals.taxName} (${totals.taxRatePct}%)`}
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
                  Some selected items are quoted separately and are excluded from the calculated totals.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resulting tenant entitlements</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              {summary.map((e) => (
                <div key={e.key} className="flex justify-between">
                  <span>{ENTITLEMENT_LABELS[e.key] ?? e.key}</span>
                  <span className="tabular text-muted-foreground">
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
    <div className={`flex justify-between ${strong ? "font-semibold" : ""}`}>
      <span>{label}</span>
      <span className="tabular">{value}</span>
    </div>
  );
}
