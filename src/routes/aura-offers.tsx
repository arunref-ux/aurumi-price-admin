import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AdminLayout, PageHeader } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCommerce } from "@/lib/commerce/store";
import { findPrice, formatMoney } from "@/lib/commerce/pricing";
import type {
  AuraOffer,
  AuraOfferComponent,
  Catalogue,
  MarketId,
  PriceRule,
} from "@/lib/commerce/types";
import { toast } from "sonner";

export const Route = createFileRoute("/aura-offers")({
  head: () => ({
    meta: [
      { title: "Standalone Aura Offers | Aurumi Price Admin" },
      {
        name: "description",
        content:
          "Configure standalone Aura offerings — Aura sold together with a business-context connector, without an Aurumi Workspace plan.",
      },
      { property: "og:title", content: "Standalone Aura Offers | Aurumi Price Admin" },
      {
        property: "og:description",
        content: "Aura + connector commercial offers, markets, capacity, add-ons and pricing.",
      },
    ],
  }),
  component: AuraOffersPage,
});

function AuraOffersPage() {
  const { draft, updateDraft } = useCommerce();
  const offers = draft.auraOffers ?? [];
  const [selectedId, setSelectedId] = useState(offers[0]?.id ?? "");
  const offer = offers.find((o) => o.id === selectedId) ?? offers[0];

  const standaloneConnectors = draft.connectors.filter((c) => c.standaloneAuraOffering);

  const patch = (id: string, p: Partial<AuraOffer>, summary: string) =>
    updateDraft(
      (d) => ({ ...d, auraOffers: d.auraOffers.map((o) => (o.id === id ? { ...o, ...p } : o)) }),
      summary,
      "Standalone Aura Offers",
    );

  const patchPrice = (productId: string, market: MarketId, field: "monthly" | "annual", value: number | null) =>
    updateDraft(
      (d: Catalogue) => {
        const exists = d.prices.some((r) => r.productId === productId && r.market === market);
        const marketRow = d.markets.find((m) => m.id === market)!;
        const prices: PriceRule[] = exists
          ? d.prices.map((r) =>
              r.productId === productId && r.market === market ? { ...r, [field]: value } : r,
            )
          : [
              ...d.prices,
              {
                productId,
                market,
                currency: marketRow.currency,
                monthly: field === "monthly" ? value : null,
                annual: field === "annual" ? value : null,
                annualDiscountPct: 20,
                taxIncluded: marketRow.taxIncluded,
              },
            ];
        return { ...d, prices };
      },
      `${productId} ${field} price in ${market}`,
      "Standalone Aura Offers",
    );

  return (
    <AdminLayout>
      <PageHeader
        title="Standalone Aura Offers"
        description="Aura is Aurumi's “Talk to Your Business” capability. Every supported connector works with Aura — these offers define which Aura + connector combinations can be sold directly, without an Aurumi Workspace plan."
      />

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configured offers ({offers.length})</CardTitle>
            <CardDescription>Aura + connector commercial combinations.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {offers.map((o) => {
              const connector = draft.connectors.find((c) => c.id === o.connectorId);
              return (
                <button
                  key={o.id}
                  type="button"
                  aria-pressed={o.id === offer?.id}
                  onClick={() => setSelectedId(o.id)}
                  className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                    o.id === offer?.id ? "border-accent bg-secondary" : "hover:bg-secondary/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{o.name}</span>
                    <Badge variant={o.status === "Available" && o.active ? "default" : "outline"}>
                      {o.active ? o.status : "Inactive"}
                    </Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Connector: {connector?.name ?? o.connectorId} · {o.eligibleMarkets.length} market(s)
                  </div>
                </button>
              );
            })}
            {offers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No standalone Aura offers configured.</p>
            ) : null}
            <p className="pt-2 text-xs text-muted-foreground">
              A connector only appears here once its “Standalone Aura Offering” setting is Yes on the Connectors
              page.
            </p>
          </CardContent>
        </Card>

        {offer ? (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{offer.name}</CardTitle>
                <CardDescription>
                  Product: Aura · Connector:{" "}
                  {draft.connectors.find((c) => c.id === offer.connectorId)?.name ?? offer.connectorId} · No Workspace
                  plan required
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs text-muted-foreground" htmlFor="offer-name">
                    Offer name
                  </Label>
                  <Input
                    id="offer-name"
                    value={offer.name}
                    onChange={(e) => patch(offer.id, { name: e.target.value }, `${offer.id} renamed`)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Connector</Label>
                  <Select
                    value={offer.connectorId}
                    onValueChange={(v) => patch(offer.id, { connectorId: v }, `${offer.name} connector changed`)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {standaloneConnectors.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Availability status</Label>
                  <Select
                    value={offer.status}
                    onValueChange={(v) =>
                      patch(offer.id, { status: v as AuraOffer["status"] }, `${offer.name} status = ${v}`)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Draft">Draft</SelectItem>
                      <SelectItem value="Available">Available</SelectItem>
                      <SelectItem value="Retired">Retired</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs text-muted-foreground" htmlFor="offer-desc">
                    Description
                  </Label>
                  <Textarea
                    id="offer-desc"
                    value={offer.description}
                    onChange={(e) => patch(offer.id, { description: e.target.value }, `${offer.name} description`)}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs text-muted-foreground" htmlFor="offer-terms">
                    Connector-specific commercial terms
                  </Label>
                  <Textarea
                    id="offer-terms"
                    value={offer.connectorCommercialTerms}
                    onChange={(e) =>
                      patch(offer.id, { connectorCommercialTerms: e.target.value }, `${offer.name} terms`)
                    }
                  />
                </div>
                <label className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                  <span className="text-sm">
                    Active
                    <span className="block text-xs text-muted-foreground">Sellable once published.</span>
                  </span>
                  <Switch
                    checked={offer.active}
                    onCheckedChange={(v) => patch(offer.id, { active: v }, `${offer.name} active = ${v}`)}
                  />
                </label>
                <label className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                  <span className="text-sm">
                    Quote-only pricing
                    <span className="block text-xs text-muted-foreground">
                      Configurations move to Quote required instead of simulated payment.
                    </span>
                  </span>
                  <Switch
                    checked={offer.quoteOnly}
                    onCheckedChange={(v) => patch(offer.id, { quoteOnly: v }, `${offer.name} quote-only = ${v}`)}
                  />
                </label>
                <label className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 sm:col-span-2">
                  <span className="text-sm">
                    Aurumi-assisted implementation required
                    <span className="block text-xs text-muted-foreground">
                      Professional services are scheduled with the purchase.
                    </span>
                  </span>
                  <Switch
                    checked={offer.professionalServicesRequired}
                    onCheckedChange={(v) =>
                      patch(offer.id, { professionalServicesRequired: v }, `${offer.name} professional services = ${v}`)
                    }
                  />
                </label>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Included capacity</CardTitle>
                <CardDescription>
                  Tenant-level entitlements are derived from these values — nothing is duplicated elsewhere.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-3">
                <NumberField
                  label="Included users"
                  value={offer.includedUsers}
                  onChange={(v) => patch(offer.id, { includedUsers: v }, `${offer.name} included users = ${v}`)}
                />
                <NumberField
                  label="Included Intelligence Capacity (AIC / month)"
                  value={offer.includedIntelligence}
                  onChange={(v) =>
                    patch(offer.id, { includedIntelligence: v }, `${offer.name} included AIC = ${v}`)
                  }
                />
                <NumberField
                  label="Included storage / context (GB)"
                  value={offer.includedStorageGb}
                  onChange={(v) => patch(offer.id, { includedStorageGb: v }, `${offer.name} included storage = ${v}`)}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Commercial components</CardTitle>
                <CardDescription>
                  Each component is treated explicitly: recurring, one-time, included or quote
                  required. Any required quote component sends the configuration to Quote required
                  instead of simulated payment.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {(offer.components ?? []).map((c, i) => (
                  <div
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2"
                  >
                    <span className="min-w-0">
                      <span className="text-sm font-medium">{c.label}</span>
                      <span className="block text-xs text-muted-foreground">
                        {c.kind}
                        {c.productId ? ` · priced as ${c.productId}` : ""}
                        {c.note ? ` · ${c.note}` : ""}
                      </span>
                    </span>
                    <Select
                      value={c.treatment}
                      onValueChange={(v) =>
                        patch(
                          offer.id,
                          {
                            components: (offer.components ?? []).map((x, xi) =>
                              xi === i ? { ...x, treatment: v as AuraOfferComponent["treatment"] } : x,
                            ),
                          },
                          `${offer.name} · ${c.label} treatment = ${v}`,
                        )
                      }
                    >
                      <SelectTrigger className="w-52">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="recurring">Recurring</SelectItem>
                        <SelectItem value="one_time">One-time / setup</SelectItem>
                        <SelectItem value="included">Included</SelectItem>
                        <SelectItem value="quote_required">Quote required</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
                {(offer.components ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No explicit components configured — the offer price is treated as a single Aura
                    recurring charge.
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Enabled add-ons</CardTitle>
                <CardDescription>Only these add-ons may be sold with this offer.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {draft.addOns.map((a) => {
                  const on = offer.enabledAddOnIds.includes(a.id);
                  return (
                    <label key={a.id} className="flex items-center gap-3 rounded-md border px-3 py-2">
                      <Checkbox
                        checked={on}
                        onCheckedChange={(v) =>
                          patch(
                            offer.id,
                            {
                              enabledAddOnIds: v
                                ? [...offer.enabledAddOnIds, a.id]
                                : offer.enabledAddOnIds.filter((x) => x !== a.id),
                            },
                            `${offer.name} add-on ${a.name} = ${v ? "enabled" : "disabled"}`,
                          )
                        }
                      />
                      <span>
                        <span className="text-sm font-medium">{a.name}</span>
                        <span className="block text-xs text-muted-foreground">{a.unitLabel}</span>
                      </span>
                    </label>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Markets &amp; pricing</CardTitle>
                <CardDescription>
                  The offer price is set commercially — it is not the sum of an Aura base price and a connector price.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {draft.markets.map((m) => {
                  const enabled = offer.eligibleMarkets.includes(m.id);
                  const rule = findPrice(draft, offer.id, m.id);
                  return (
                    <div key={m.id} className="rounded-md border px-3 py-2">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <label className="flex items-center gap-3">
                          <Checkbox
                            checked={enabled}
                            aria-label={`${offer.name} sold in ${m.name}`}
                            onCheckedChange={(v) =>
                              patch(
                                offer.id,
                                {
                                  eligibleMarkets: v
                                    ? [...offer.eligibleMarkets, m.id]
                                    : offer.eligibleMarkets.filter((x) => x !== m.id),
                                },
                                `${offer.name} ${v ? "enabled" : "disabled"} in ${m.name}`,
                              )
                            }
                          />
                          <span className="text-sm font-medium">
                            {m.name}
                            <span className="block text-xs text-muted-foreground">
                              {m.currency} · {m.taxName} {m.taxRatePct}%
                            </span>
                          </span>
                        </label>
                        <div className="flex items-center gap-2">
                          <PriceField
                            label="Monthly"
                            currency={m.currency}
                            value={rule?.monthly ?? null}
                            disabled={offer.quoteOnly}
                            onChange={(v) => patchPrice(offer.id, m.id, "monthly", v)}
                          />
                          <PriceField
                            label="Annual"
                            currency={m.currency}
                            value={rule?.annual ?? null}
                            disabled={offer.quoteOnly}
                            onChange={(v) => patchPrice(offer.id, m.id, "annual", v)}
                          />
                        </div>
                      </div>
                      {offer.quoteOnly ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Quote-only — no calculated amount is used in {m.name}.
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatMoney(rule?.monthly ?? null, m.currency)} / month ·{" "}
                          {formatMoney(rule?.annual ?? null, m.currency)} / year
                        </p>
                      )}
                    </div>
                  );
                })}
                <Separator />
                <p className="text-xs text-muted-foreground">
                  Standalone Aura offers follow the same Draft → Review → Published workflow as the rest of the
                  catalogue. Tenant configuration always reads the published version.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toast.info("Publish from the header to make these offer changes purchasable.")}
                >
                  How do these changes go live?
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </AdminLayout>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        min={0}
        className="tabular"
        value={value ?? ""}
        aria-label={label}
        onChange={(e) => onChange(e.target.value === "" ? null : Math.max(0, Number(e.target.value)))}
      />
    </div>
  );
}

function PriceField({
  label,
  currency,
  value,
  disabled,
  onChange,
}: {
  label: string;
  currency: string;
  value: number | null;
  disabled?: boolean;
  onChange: (v: number | null) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label} ({currency})
      </Label>
      <Input
        type="number"
        min={0}
        disabled={disabled}
        className="h-9 w-32 tabular"
        aria-label={`${label} price in ${currency}`}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Math.max(0, Number(e.target.value)))}
      />
    </div>
  );
}
