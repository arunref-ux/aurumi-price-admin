import { createFileRoute, Link } from "@tanstack/react-router";
import { AdminLayout, PageHeader } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useCommerce } from "@/lib/commerce/store";
import { findPrice, formatMoney } from "@/lib/commerce/pricing";
import { bundleComponents } from "@/lib/commerce/bundles";
import type { BundleOffer, MarketId, PriceRule } from "@/lib/commerce/types";

const title = "Bundles | Aurumi Price Admin";
const description =
  "Configure bundled commercial offers that package multiple connectors into a single sellable proposition.";

export const Route = createFileRoute("/bundles/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BundlesPage,
});

function BundlesPage() {
  const { draft, updateDraft } = useCommerce();
  const bundles = draft.bundles ?? [];

  const patch = (id: string, p: Partial<BundleOffer>, summary: string) =>
    updateDraft(
      (d) => ({ ...d, bundles: (d.bundles ?? []).map((b) => (b.id === id ? { ...b, ...p } : b)) }),
      summary,
      "Bundles",
    );

  const patchPrice = (
    productId: string,
    market: MarketId,
    field: "monthly" | "annual",
    value: number | null,
  ) =>
    updateDraft(
      (d) => ({
        ...d,
        prices: d.prices.map((p: PriceRule) =>
          p.productId === productId && p.market === market ? { ...p, [field]: value } : p,
        ),
      }),
      `Updated ${productId} ${field} price for ${market}`,
      "Bundles",
    );

  return (
    <AdminLayout>
      <PageHeader
        title="Bundles"
        description="A bundle is a commercial packaging construct: one offer that references existing connectors. Connectors keep their own classification and remain reusable everywhere else."
      />

      {bundles.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No bundles configured.
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-6">
        {bundles.map((b) => {
          const components = bundleComponents(b);
          return (
            <Card key={b.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex flex-wrap items-center gap-2">
                      {b.name}
                      <Badge variant={b.status === "Available" ? "default" : "secondary"}>
                        {b.status}
                      </Badge>
                      {b.quoteOnly ? <Badge variant="outline">Quote only</Badge> : null}
                    </CardTitle>
                    <CardDescription>{b.description}</CardDescription>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Switch
                        id={`active-${b.id}`}
                        checked={b.active}
                        onCheckedChange={(v) =>
                          patch(b.id, { active: v }, `${v ? "Activated" : "Deactivated"} ${b.name}`)
                        }
                      />
                      <Label htmlFor={`active-${b.id}`}>Active</Label>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link to="/bundles/finance-cash-flow">
                        View landing page
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <p className="text-sm font-semibold">Included connectors</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {b.connectorIds.map((id) => {
                      const conn = draft.connectors.find((c) => c.id === id);
                      return (
                        <Badge key={id} variant="secondary">
                          {conn ? `${conn.name} · ${conn.classification}` : `${id} (missing)`}
                        </Badge>
                      );
                    })}
                  </div>
                </div>

                <Separator />

                <div>
                  <p className="text-sm font-semibold">Commercial components</p>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {components.map((c) => (
                      <li key={c.id} className="flex flex-wrap justify-between gap-2">
                        <span>{c.label}</span>
                        <span className="uppercase tracking-wide text-xs">
                          {c.treatment.replace("_", " ")}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Separator />

                <div>
                  <p className="text-sm font-semibold">Bundle price by market</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {b.eligibleMarkets.map((m) => {
                      const rule = findPrice(draft, b.id, m);
                      const market = draft.markets.find((x) => x.id === m);
                      return (
                        <div key={m} className="rounded-lg border p-3">
                          <p className="text-sm font-medium">
                            {market?.name ?? m}{" "}
                            <span className="text-xs text-muted-foreground">
                              {market?.currency}
                            </span>
                          </p>
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Monthly</Label>
                              <Input
                                type="number"
                                min={0}
                                value={rule?.monthly ?? ""}
                                onChange={(e) =>
                                  patchPrice(
                                    b.id,
                                    m,
                                    "monthly",
                                    e.target.value === "" ? null : Math.max(0, Number(e.target.value)),
                                  )
                                }
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Annual</Label>
                              <Input
                                type="number"
                                min={0}
                                value={rule?.annual ?? ""}
                                onChange={(e) =>
                                  patchPrice(
                                    b.id,
                                    m,
                                    "annual",
                                    e.target.value === "" ? null : Math.max(0, Number(e.target.value)),
                                  )
                                }
                              />
                            </div>
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {rule?.monthly !== null && rule?.monthly !== undefined
                              ? `${formatMoney(rule.monthly, rule.currency)} / month`
                              : "No calculable price — quote required"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </AdminLayout>
  );
}
