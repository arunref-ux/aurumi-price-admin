import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AdminLayout, PageHeader } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCommerce } from "@/lib/commerce/store";
import { annualDisplay, findPrice, formatMoney } from "@/lib/commerce/pricing";
import { planEntitlements, ENTITLEMENT_LABELS } from "@/lib/commerce/entitlements";
import type { BillingCycle, MarketId } from "@/lib/commerce/types";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Public Pricing Preview | Aurumi Price Admin" },
      {
        name: "description",
        content:
          "Preview how the published Aurumi catalogue reads to customers: plan pricing per market and billing cycle, premium apps and add-ons.",
      },
      { property: "og:title", content: "Public Pricing Preview | Aurumi Price Admin" },
      { property: "og:description", content: "Published Aurumi plan pricing, per market and billing cycle." },
    ],
  }),
  component: PricingPreview,
});

function PricingPreview() {
  const { published, hasUnpublishedChanges } = useCommerce();
  const [market, setMarket] = useState<MarketId>(published.settings.defaultMarket);
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const m = published.markets.find((x) => x.id === market) ?? published.markets[0]!;

  return (
    <AdminLayout>
      <PageHeader
        title="Public Pricing Preview"
        description="Exactly what the published catalogue would show to customers. Draft edits never appear here until they are published."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Published catalogue v{published.version}</Badge>
            {hasUnpublishedChanges ? <Badge>Draft changes not shown</Badge> : null}
            <Select value={market} onValueChange={(v) => setMarket(v as MarketId)}>
              <SelectTrigger className="w-52" aria-label="Market">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {published.markets
                  .filter((x) => x.active)
                  .map((x) => (
                    <SelectItem key={x.id} value={x.id}>
                      {x.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Tabs value={cycle} onValueChange={(v) => setCycle(v as BillingCycle)}>
              <TabsList>
                <TabsTrigger value="monthly">Monthly</TabsTrigger>
                <TabsTrigger value="annual">Annual</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-4">
        {published.plans
          .filter((p) => p.active && p.publicVisible && p.eligibleMarkets.includes(market))
          .sort((a, b) => a.order - b.order)
          .map((p) => {
            const rule = findPrice(published, p.id, market);
            const annual = annualDisplay(rule, m.currency);
            return (
              <Card key={p.id} className="flex flex-col">
                <CardHeader>
                  <CardTitle className="font-display text-lg">{p.name}</CardTitle>
                  <CardDescription>{p.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-3">
                  <div>
                    {p.custom || rule?.quoteOnly ? (
                      <div className="font-display text-2xl">Talk to sales</div>
                    ) : cycle === "monthly" ? (
                      <div className="font-display text-2xl tabular">
                        {formatMoney(rule?.monthly ?? null, m.currency)}
                        <span className="text-sm text-muted-foreground"> /mo</span>
                      </div>
                    ) : (
                      <div>
                        <div className="font-display text-2xl tabular">
                          {annual?.monthlyEquivalent ?? "—"}
                          <span className="text-sm text-muted-foreground"> /mo</span>
                        </div>
                        <div className="text-xs text-muted-foreground">{annual?.caption}</div>
                      </div>
                    )}
                    <div className="mt-1 text-xs text-muted-foreground">
                      {m.taxIncluded ? `${m.taxName} included` : `Excludes ${m.taxName}`}
                    </div>
                  </div>
                  <Separator />
                  <ul className="space-y-1 text-sm">
                    {planEntitlements(p).map((e, i) => (
                      <li key={`${e.key}-${i}`} className="flex justify-between gap-2">
                        <span className="text-muted-foreground">{ENTITLEMENT_LABELS[e.key] ?? e.key}</span>
                        <span className="tabular text-right">
                          {e.value !== undefined ? `${e.value.toLocaleString()} ${e.unit ?? ""}` : e.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Premium Aurumi Apps</CardTitle>
            <CardDescription>All Standard Apps are included with every paid workspace.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            {published.apps
              .filter((a) => a.classification === "Premium" && a.active && a.publicVisible)
              .map((a) => {
                const rule = findPrice(published, a.id, market);
                return (
                  <div key={a.id} className="flex justify-between gap-3">
                    <span>{a.name}</span>
                    <span className="tabular">
                      {formatMoney(cycle === "monthly" ? (rule?.monthly ?? null) : (rule?.annual ?? null), m.currency)}
                    </span>
                  </div>
                );
              })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Capacity add-ons</CardTitle>
            <CardDescription>Purchased in catalogue-defined increments.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            {published.addOns
              .filter((a) => a.active && a.eligibleMarkets.includes(market))
              .map((a) => {
                const rule = findPrice(published, a.id, market);
                return (
                  <div key={a.id} className="flex justify-between gap-3">
                    <span>
                      {a.name}
                      <span className="block text-xs text-muted-foreground">{a.unitLabel}</span>
                    </span>
                    <span className="tabular">
                      {formatMoney(cycle === "monthly" ? (rule?.monthly ?? null) : (rule?.annual ?? null), m.currency)}
                    </span>
                  </div>
                );
              })}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
