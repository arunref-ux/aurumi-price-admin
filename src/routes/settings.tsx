import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout, PageHeader } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCommerce } from "@/lib/commerce/store";
import type { MarketId, Settings } from "@/lib/commerce/types";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings | Aurumi Commercial Admin" },
      {
        name: "description",
        content:
          "Configuration settings: market simulator for development, default market, capacity terminology and payment provider abstraction.",
      },
      { property: "og:title", content: "Settings | Aurumi Commercial Admin" },
      { property: "og:description", content: "Aurumi commercial admin settings and payment provider mapping." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { draft, updateDraft, reset } = useCommerce();
  const s = draft.settings;
  const patch = (p: Partial<Settings>, summary: string) =>
    updateDraft((d) => ({ ...d, settings: { ...d.settings, ...p } }), summary, "Settings");

  return (
    <AdminLayout>
      <PageHeader title="Settings" description="Environment and terminology settings for the commercial catalogue." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Market resolution</CardTitle>
            <CardDescription>
              Production resolves the market by IP address. The selector below is a development aid and can be
              switched off before launch without any other change.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <div>
                <Label>Show market selector (development only)</Label>
                <p className="text-xs text-muted-foreground">
                  Displays a country selector on the public pricing preview.
                </p>
              </div>
              <Switch
                checked={s.showMarketSelector}
                onCheckedChange={(v) => patch({ showMarketSelector: v }, `Market selector = ${v}`)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Default market</Label>
              <Select
                value={s.defaultMarket}
                onValueChange={(v) => patch({ defaultMarket: v as MarketId }, "Default market")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {draft.markets.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Customer-facing capacity terminology</CardTitle>
            <CardDescription>
              Infrastructure and model costs are internal cost drivers and must not leak into customer wording.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Intelligence unit</Label>
              <Input
                value={s.intelligenceUnitLabel}
                onChange={(e) => patch({ intelligenceUnitLabel: e.target.value }, "Intelligence unit label")}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Storage unit</Label>
              <Input
                value={s.storageUnitLabel}
                onChange={(e) => patch({ storageUnitLabel: e.target.value }, "Storage unit label")}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Data transfer unit</Label>
              <Input
                value={s.transferUnitLabel}
                onChange={(e) => patch({ transferUnitLabel: e.target.value }, "Transfer unit label")}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment providers by market</CardTitle>
            <CardDescription>
              The pricing model is provider-agnostic. Stripe is simply one configured provider; providers are
              swappable per market without touching pricing or entitlements.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {draft.markets.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                <span>{m.name}</span>
                <span className="text-muted-foreground">{m.paymentProvider}</span>
              </div>
            ))}
            <p className="pt-2 text-xs text-muted-foreground">
              Provider capabilities modelled for later integration: checkout, payment, subscription creation,
              invoice, payment status, failed payment, refund, cancellation, renewal. Checkout is mocked in this
              version — no real transactions are created.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Data</CardTitle>
            <CardDescription>Catalogue and subscriptions are stored locally in this prototype.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              onClick={() => {
                reset();
                toast.success("Catalogue reset to seeded configuration");
              }}
            >
              Reset to seeded configuration
            </Button>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
