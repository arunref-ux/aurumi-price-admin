import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AdminLayout, PageHeader } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCommerce } from "@/lib/commerce/store";
import { formatMoney } from "@/lib/commerce/pricing";

import { ENTITLEMENT_LABELS } from "@/lib/commerce/entitlements";
import type { AddOn, MarketId } from "@/lib/commerce/types";

export const Route = createFileRoute("/addons")({
  head: () => ({
    meta: [
      { title: "Capacity & Add-ons | Aurumi Commercial Admin" },
      {
        name: "description",
        content:
          "Configure extra team members, storage, Intelligence Capacity and data transfer add-ons, their units, limits and entitlements.",
      },
      { property: "og:title", content: "Capacity & Add-ons | Aurumi Commercial Admin" },
      { property: "og:description", content: "Add-on catalogue and the entitlements each purchase generates." },
    ],
  }),
  component: AddOnsPage,
});

function AddOnsPage() {
  const { draft, updateDraft } = useCommerce();
  const [market, setMarket] = useState<MarketId>("US");

  const patch = (id: string, p: Partial<AddOn>, summary: string) =>
    updateDraft(
      (d) => ({ ...d, addOns: d.addOns.map((a) => (a.id === id ? { ...a, ...p } : a)) }),
      summary,
      "Add-ons",
    );

  const setPrice = (id: string, patchPrice: { monthly?: number | null; annual?: number | null }) =>
    updateDraft(
      (d) => ({
        ...d,
        prices: d.prices.map((r) => (r.productId === id && r.market === market ? { ...r, ...patchPrice } : r)),
      }),
      `Updated add-on pricing (${id}) in ${market}`,
      "Pricing",
    );

  return (
    <AdminLayout>
      <PageHeader
        title="Capacity & Add-ons"
        description="Add-ons are priced in customer-facing capacity units. Infrastructure and model costs remain internal cost drivers and are never exposed as customer terminology."
        actions={
          <Select value={market} onValueChange={(v) => setMarket(v as MarketId)}>
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {draft.markets.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  Prices in {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {draft.addOns.map((a) => {
          const rule = draft.prices.find((r) => r.productId === a.id && r.market === market);
          const size = a.unitSize;
          return (
            <Card key={a.id}>
              <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
                <div>
                  <CardTitle className="text-base">{a.name}</CardTitle>
                  <CardDescription>{a.description}</CardDescription>
                </div>
                <Switch
                  checked={a.active}
                  onCheckedChange={(v) => patch(a.id, { active: v }, `${a.name} active = ${v}`)}
                />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="secondary">Unit: {a.unit}</Badge>
                  <Badge variant="outline">{a.unitLabel}</Badge>
                  <Badge variant="outline">
                    1 unit = {size.toLocaleString()} {a.unit}
                  </Badge>
                  <Badge variant="outline">Sold in increments of {a.quantityStep}</Badge>
                  <Badge variant="outline">{a.recurring ? "Recurring" : "One-time"}</Badge>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Small label={`Unit price / month (${rule?.currency ?? ""})`}>
                    <Input
                      type="number"
                      className="tabular"
                      value={rule?.monthly ?? ""}
                      onChange={(e) =>
                        setPrice(a.id, { monthly: e.target.value === "" ? null : Number(e.target.value) })
                      }
                    />
                  </Small>
                  <Small label={`Unit price / year (${rule?.currency ?? ""})`}>
                    <Input
                      type="number"
                      className="tabular"
                      value={rule?.annual ?? ""}
                      onChange={(e) =>
                        setPrice(a.id, { annual: e.target.value === "" ? null : Number(e.target.value) })
                      }
                    />
                  </Small>
                  <Small label="Minimum quantity">
                    <Input
                      type="number"
                      className="tabular"
                      value={a.minQuantity}
                      onChange={(e) => patch(a.id, { minQuantity: Number(e.target.value) }, `${a.name} min qty`)}
                    />
                  </Small>
                  <Small label="Maximum quantity">
                    <Input
                      type="number"
                      className="tabular"
                      value={a.maxQuantity ?? ""}
                      onChange={(e) =>
                        patch(
                          a.id,
                          { maxQuantity: e.target.value === "" ? null : Number(e.target.value) },
                          `${a.name} max qty`,
                        )
                      }
                    />
                  </Small>
                </div>

                <div className="rounded-md bg-secondary px-3 py-2 text-xs">
                  <div className="font-medium">Entitlement generated per unit purchased</div>
                  <div className="text-muted-foreground">
                    {ENTITLEMENT_LABELS[a.entitlement.key] ?? a.entitlement.key} +{size.toLocaleString()}{" "}
                    {a.entitlement.unit}
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  Eligible plans:{" "}
                  {a.eligiblePlans.map((id) => draft.plans.find((p) => p.id === id)?.name ?? id).join(", ")} ·
                  Example: 3 units ={" "}
                  <span className="tabular">
                    {formatMoney((rule?.monthly ?? 0) * 3, rule?.currency ?? "USD")}
                  </span>
                  /mo
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </AdminLayout>
  );
}

function Small({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
