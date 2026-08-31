import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AdminLayout, PageHeader } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCommerce } from "@/lib/commerce/store";
import { annualDisplay, formatMoney } from "@/lib/commerce/pricing";
import type { BillingCycle, Market } from "@/lib/commerce/types";

export const Route = createFileRoute("/markets")({
  head: () => ({
    meta: [
      { title: "Markets & Pricing | Aurumi Commercial Admin" },
      {
        name: "description",
        content:
          "Regional pricing by product × market × billing cycle, with currency, tax treatment and payment provider per market.",
      },
      { property: "og:title", content: "Markets & Pricing | Aurumi Commercial Admin" },
      { property: "og:description", content: "Regional pricing, tax treatment and payment provider configuration." },
    ],
  }),
  component: MarketsPage,
});

function MarketsPage() {
  const { draft, updateDraft } = useCommerce();
  const [cycle, setCycle] = useState<BillingCycle>("monthly");

  const patchMarket = (id: string, p: Partial<Market>, summary: string) =>
    updateDraft(
      (d) => ({ ...d, markets: d.markets.map((m) => (m.id === id ? { ...m, ...p } : m)) }),
      summary,
      "Markets",
    );

  const products = [
    ...draft.plans.map((p) => ({ id: p.id, name: `Plan · ${p.name}` })),
    ...draft.apps
      .filter((a) => a.classification === "Premium")
      .map((a) => ({ id: a.id, name: `Premium App · ${a.name}` })),
    ...draft.addOns.map((a) => ({ id: a.id, name: `Add-on · ${a.name}` })),
  ];

  return (
    <AdminLayout>
      <PageHeader
        title="Markets & Pricing"
        description="Pricing is configured per PRODUCT × MARKET × BILLING CYCLE. The public website will resolve the market by IP; a market simulator is available in Settings during development."
        actions={
          <Tabs value={cycle} onValueChange={(v) => setCycle(v as BillingCycle)}>
            <TabsList>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
              <TabsTrigger value="annual">Annual</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {draft.markets.map((m) => (
          <Card key={m.id}>
            <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
              <div>
                <CardTitle className="text-base">{m.name}</CardTitle>
                <CardDescription>
                  {m.currency} · {m.paymentProvider}
                </CardDescription>
              </div>
              <Switch
                checked={m.active}
                onCheckedChange={(v) => patchMarket(m.id, { active: v }, `${m.name} active = ${v}`)}
              />
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{m.taxName} rate %</Label>
                  <Input
                    type="number"
                    className="tabular"
                    value={m.taxRatePct}
                    onChange={(e) =>
                      patchMarket(m.id, { taxRatePct: Number(e.target.value) }, `${m.name} tax rate`)
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Payment provider</Label>
                  <Input
                    value={m.paymentProvider}
                    onChange={(e) =>
                      patchMarket(m.id, { paymentProvider: e.target.value }, `${m.name} payment provider`)
                    }
                  />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <Label className="text-xs">Prices include tax</Label>
                <Switch
                  checked={m.taxIncluded}
                  onCheckedChange={(v) => patchMarket(m.id, { taxIncluded: v }, `${m.name} tax inclusive = ${v}`)}
                />
              </div>
              <div className="flex flex-wrap gap-1">
                {m.paymentMethods.map((pm) => (
                  <Badge key={pm} variant="outline">
                    {pm}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Price matrix — {cycle}</CardTitle>
          <CardDescription>
            Annual view shows the billed amount, monthly-equivalent and savings copy the website renders.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                {draft.markets.map((m) => (
                  <TableHead key={m.id}>{m.name}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  {draft.markets.map((m) => {
                    const rule = draft.prices.find((r) => r.productId === p.id && r.market === m.id);
                    if (!rule || rule.quoteOnly || rule.monthly === null)
                      return (
                        <TableCell key={m.id} className="text-xs text-muted-foreground">
                          Quoted
                        </TableCell>
                      );
                    if (cycle === "monthly")
                      return (
                        <TableCell key={m.id} className="tabular">
                          {formatMoney(rule.monthly, rule.currency)}
                        </TableCell>
                      );
                    const display = annualDisplay(rule, rule.currency);
                    return (
                      <TableCell key={m.id} className="tabular text-xs">
                        <div className="text-sm">{display?.monthlyEquivalent}/mo</div>
                        <div className="text-muted-foreground">{display?.caption}</div>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
