import { createFileRoute, Link } from "@tanstack/react-router";
import { AdminLayout, PageHeader } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCommerce } from "@/lib/commerce/store";
import { formatMoney } from "@/lib/commerce/pricing";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Commercial Dashboard | Aurumi Admin" },
      {
        name: "description",
        content:
          "Overview of Aurumi's commercial catalogue: plans, apps, connectors, add-ons, markets and draft vs published configuration.",
      },
      { property: "og:title", content: "Commercial Dashboard | Aurumi Admin" },
      {
        property: "og:description",
        content: "Aurumi internal dashboard for commercial catalogue and tenant subscriptions.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { draft, published, state, hasUnpublishedChanges } = useCommerce();

  const stats = [
    { label: "Active plans", value: draft.plans.filter((p) => p.active).length, to: "/plans" },
    {
      label: "Standard Apps",
      value: draft.apps.filter((a) => a.classification === "Standard" && a.active).length,
      to: "/apps",
    },
    {
      label: "Premium Apps",
      value: draft.apps.filter((a) => a.classification === "Premium" && a.active).length,
      to: "/apps",
    },
    {
      label: "Standard Connectors",
      value: draft.connectors.filter((c) => c.classification === "Standard").length,
      to: "/connectors",
    },
    {
      label: "Additional / Custom Connectors",
      value: draft.connectors.filter((c) => c.classification !== "Standard").length,
      to: "/connectors",
    },
    { label: "Active add-ons", value: draft.addOns.filter((a) => a.active).length, to: "/addons" },
    { label: "Markets", value: draft.markets.filter((m) => m.active).length, to: "/markets" },
    { label: "Tenant subscriptions", value: state.subscriptions.length, to: "/tenants" },
  ] as const;

  const usPrices = draft.plans
    .filter((p) => !p.custom)
    .map((p) => {
      const rule = draft.prices.find((r) => r.productId === p.id && r.market === "US");
      const pubRule = published.prices.find((r) => r.productId === p.id && r.market === "US");
      return {
        plan: p.name,
        monthly: rule?.monthly ?? null,
        publishedMonthly: pubRule?.monthly ?? null,
        currency: rule?.currency ?? "USD",
      };
    });

  return (
    <AdminLayout>
      <PageHeader
        title="Commercial Dashboard"
        description="What Aurumi sells, how it is priced, and what tenants have purchased. Catalogue edits are saved as draft configuration and only reach the public pricing page when published."
        actions={
          <Button asChild>
            <Link to="/subscriptions/new">New tenant subscription</Link>
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} to={s.to} className="block">
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardContent className="p-5">
                <div className="text-3xl font-semibold tabular">{s.value}</div>
                <div className="mt-1 text-sm text-muted-foreground">{s.label}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Plan pricing (United States reference market)</CardTitle>
            <CardDescription>Draft values compared with the currently published catalogue.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {usPrices.map((row) => {
              const changed = row.monthly !== row.publishedMonthly;
              return (
                <div
                  key={row.plan}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <span className="font-medium">{row.plan}</span>
                  <span className="flex items-center gap-3 tabular">
                    {changed ? (
                      <span className="text-muted-foreground line-through">
                        {formatMoney(row.publishedMonthly, row.currency)}
                      </span>
                    ) : null}
                    <span>{formatMoney(row.monthly, row.currency)}/mo</span>
                    {changed ? <Badge>Draft change</Badge> : null}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configuration state</CardTitle>
            <CardDescription>
              {hasUnpublishedChanges ? "Draft differs from published." : "Draft matches published."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {state.changeLog.length === 0 ? (
              <p className="text-muted-foreground">No configuration changes yet.</p>
            ) : (
              state.changeLog.slice(0, 6).map((c) => (
                <div key={c.id} className="rounded-md border px-3 py-2">
                  <div className="font-medium">{c.summary}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.entity} · {new Date(c.at).toLocaleString()}
                  </div>
                </div>
              ))
            )}
            <Button variant="outline" size="sm" asChild className="mt-2 w-full">
              <Link to="/changes">Review changes</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
