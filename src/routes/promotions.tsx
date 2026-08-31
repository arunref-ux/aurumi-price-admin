import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout, PageHeader } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useCommerce } from "@/lib/commerce/store";
import type { Promotion } from "@/lib/commerce/types";

export const Route = createFileRoute("/promotions")({
  head: () => ({
    meta: [
      { title: "Promotions | Aurumi Commercial Admin" },
      {
        name: "description",
        content:
          "Percentage, fixed and first-period promotions scoped by plan, market, billing cycle and date range.",
      },
      { property: "og:title", content: "Promotions | Aurumi Commercial Admin" },
      { property: "og:description", content: "Promotion configuration for the Aurumi commercial catalogue." },
    ],
  }),
  component: PromotionsPage,
});

function PromotionsPage() {
  const { draft, updateDraft } = useCommerce();

  const patch = (id: string, p: Partial<Promotion>, summary: string) =>
    updateDraft(
      (d) => ({ ...d, promotions: d.promotions.map((x) => (x.id === id ? { ...x, ...p } : x)) }),
      summary,
      "Promotions",
    );

  const addPromotion = () =>
    updateDraft(
      (d) => ({
        ...d,
        promotions: [
          ...d.promotions,
          {
            id: `promo.${Math.random().toString(36).slice(2, 8)}`,
            name: "New promotion",
            code: "NEWCODE",
            type: "percentage",
            value: 10,
            annualOnly: false,
            eligiblePlans: d.plans.map((p) => p.id),
            eligibleMarkets: d.markets.map((m) => m.id),
            startDate: new Date().toISOString().slice(0, 10),
            endDate: new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10),
            active: false,
          },
        ],
      }),
      "Created promotion",
      "Promotions",
    );

  return (
    <AdminLayout>
      <PageHeader
        title="Promotions"
        description="Discount rules applied on top of catalogue pricing. The model supports future promotion types without redesigning pricing."
        actions={<Button onClick={addPromotion}>Add promotion</Button>}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {draft.promotions.map((p) => (
          <Card key={p.id}>
            <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="text-base">{p.name}</CardTitle>
                <CardDescription>
                  Code <span className="font-mono">{p.code}</span>
                </CardDescription>
              </div>
              <Switch
                checked={p.active}
                onCheckedChange={(v) => patch(p.id, { active: v }, `${p.name} active = ${v}`)}
              />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Name</Label>
                  <Input value={p.name} onChange={(e) => patch(p.id, { name: e.target.value }, "Promotion renamed")} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Code</Label>
                  <Input value={p.code} onChange={(e) => patch(p.id, { code: e.target.value }, "Promotion code")} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Type</Label>
                  <Select
                    value={p.type}
                    onValueChange={(v) => patch(p.id, { type: v as Promotion["type"] }, "Promotion type")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage discount</SelectItem>
                      <SelectItem value="fixed">Fixed discount</SelectItem>
                      <SelectItem value="first_period">First-period discount</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Value</Label>
                  <Input
                    type="number"
                    min={0}
                    max={p.type === "fixed" ? undefined : 100}
                    aria-invalid={p.value < 0 || (p.type !== "fixed" && p.value > 100)}
                    className="tabular"
                    value={p.value}
                    onChange={(e) => patch(p.id, { value: Math.max(0, Number(e.target.value)) }, "Promotion value")}
                  />
                  {p.type !== "fixed" && p.value > 100 ? (
                    <p className="text-xs text-destructive">Percentage discounts must be 100% or less.</p>
                  ) : null}
                  {p.endDate < p.startDate ? (
                    <p className="text-xs text-destructive">End date is before the start date.</p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Start date</Label>
                  <Input
                    type="date"
                    value={p.startDate}
                    onChange={(e) => patch(p.id, { startDate: e.target.value }, "Promotion start")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">End date</Label>
                  <Input
                    type="date"
                    value={p.endDate}
                    onChange={(e) => patch(p.id, { endDate: e.target.value }, "Promotion end")}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <Label className="text-xs">Annual billing only</Label>
                <Switch
                  checked={p.annualOnly}
                  onCheckedChange={(v) => patch(p.id, { annualOnly: v }, "Promotion annual-only")}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Eligible plans</Label>
                <div className="flex flex-wrap gap-1.5">
                  {draft.plans.map((pl) => {
                    const on = p.eligiblePlans.includes(pl.id);
                    return (
                      <Button
                        key={pl.id}
                        size="sm"
                        variant={on ? "default" : "outline"}
                        onClick={() =>
                          patch(
                            p.id,
                            {
                              eligiblePlans: on
                                ? p.eligiblePlans.filter((x) => x !== pl.id)
                                : [...p.eligiblePlans, pl.id],
                            },
                            "Promotion plan eligibility",
                          )
                        }
                      >
                        {pl.name}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Eligible markets</Label>
                <div className="flex flex-wrap gap-1.5">
                  {draft.markets.map((m) => {
                    const on = p.eligibleMarkets.includes(m.id);
                    return (
                      <Badge
                        key={m.id}
                        variant={on ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() =>
                          patch(
                            p.id,
                            {
                              eligibleMarkets: on
                                ? p.eligibleMarkets.filter((x) => x !== m.id)
                                : [...p.eligibleMarkets, m.id],
                            },
                            "Promotion market eligibility",
                          )
                        }
                      >
                        {m.name}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </AdminLayout>
  );
}
