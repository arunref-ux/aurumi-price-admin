import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AdminLayout, PageHeader } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCommerce } from "@/lib/commerce/store";
import { formatMoney } from "@/lib/commerce/pricing";
import type { MarketId, Plan, SupportLevel } from "@/lib/commerce/types";
import { ENTITLEMENT_LABELS } from "@/lib/commerce/entitlements";
import { toast } from "sonner";

export const Route = createFileRoute("/plans")({
  head: () => ({
    meta: [
      { title: "Plans | Aurumi Commercial Admin" },
      {
        name: "description",
        content: "Configure Aurumi plans: included users, capacity, connectors, support level, markets and pricing.",
      },
      { property: "og:title", content: "Plans | Aurumi Commercial Admin" },
      { property: "og:description", content: "Plan configuration and entitlements for the Aurumi catalogue." },
    ],
  }),
  component: PlansPage,
});

const SUPPORT_LEVELS: SupportLevel[] = ["Standard", "Priority", "Premium", "Dedicated"];

function PlansPage() {
  const { draft, updateDraft } = useCommerce();
  const [selectedId, setSelectedId] = useState(draft.plans[0]?.id ?? "");
  const [market, setMarket] = useState<MarketId>("US");
  const plan = draft.plans.find((p) => p.id === selectedId) ?? draft.plans[0]!;

  const setPlan = (patch: Partial<Plan>) =>
    updateDraft(
      (d) => ({ ...d, plans: d.plans.map((p) => (p.id === plan.id ? { ...p, ...patch } : p)) }),
      `Updated plan ${plan.name}`,
      "Plans",
    );

  const priceRule = draft.prices.find((r) => r.productId === plan.id && r.market === market);

  const setPrice = (patch: { monthly?: number | null; annual?: number | null; annualDiscountPct?: number }) =>
    updateDraft(
      (d) => ({
        ...d,
        prices: d.prices.map((r) =>
          r.productId === plan.id && r.market === market ? { ...r, ...patch } : r,
        ),
      }),
      `Updated ${plan.name} pricing in ${market}`,
      "Pricing",
    );

  return (
    <AdminLayout>
      <PageHeader
        title="Plans"
        description="Plans define the base commercial package. Prices are stored per plan × market × billing cycle; entitlements define what the plan allows a tenant to use."
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Plan catalogue</CardTitle>
            <CardDescription>Select a plan to configure it.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plan</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Std. connectors</TableHead>
                  <TableHead>Support</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {draft.plans.map((p) => (
                  <TableRow
                    key={p.id}
                    onClick={() => setSelectedId(p.id)}
                    className={p.id === plan.id ? "cursor-pointer bg-secondary" : "cursor-pointer"}
                  >
                    <TableCell>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.description}</div>
                    </TableCell>
                    <TableCell className="tabular">{p.custom ? "Custom" : p.includedUsers}</TableCell>
                    <TableCell className="tabular">
                      {p.custom ? "Custom" : p.includedStandardConnectors}
                    </TableCell>
                    <TableCell>{p.supportLevel}</TableCell>
                    <TableCell className="space-x-1">
                      <Badge variant={p.active ? "default" : "secondary"}>
                        {p.active ? "Active" : "Inactive"}
                      </Badge>
                      {p.publicVisible ? <Badge variant="outline">Public</Badge> : null}
                      {p.custom ? <Badge variant="outline">Quoted</Badge> : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{plan.name} configuration</CardTitle>
              <CardDescription>Stored as data — never hard-coded in the UI.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Plan name">
                <Input value={plan.name} onChange={(e) => setPlan({ name: e.target.value })} />
              </Field>
              <Field label="Short description">
                <Textarea
                  rows={2}
                  value={plan.description}
                  onChange={(e) => setPlan({ description: e.target.value })}
                />
              </Field>
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <Label htmlFor="active">Active</Label>
                <Switch id="active" checked={plan.active} onCheckedChange={(v) => setPlan({ active: v })} />
              </div>
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <Label htmlFor="public">Publicly visible</Label>
                <Switch
                  id="public"
                  checked={plan.publicVisible}
                  onCheckedChange={(v) => setPlan({ publicVisible: v })}
                />
              </div>
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <div>
                  <Label htmlFor="custom">Custom / quoted plan</Label>
                  <p className="text-xs text-muted-foreground">Enterprise-style bespoke capacity and terms.</p>
                </div>
                <Switch id="custom" checked={plan.custom} onCheckedChange={(v) => setPlan({ custom: v })} />
              </div>

              {plan.custom ? (
                <p className="rounded-md bg-secondary p-3 text-xs text-muted-foreground">
                  Custom plans are not forced into the standard price grid. Capacity, apps, connectors,
                  governance, SLA and commercial terms are agreed per tenant and captured on the
                  subscription record.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <NumField
                    label="Included users"
                    value={plan.includedUsers}
                    onChange={(v) => setPlan({ includedUsers: v })}
                  />
                  <NumField
                    label="Std. connectors"
                    value={plan.includedStandardConnectors}
                    onChange={(v) => setPlan({ includedStandardConnectors: v })}
                  />
                  <NumField
                    label="Intelligence (AIC/mo)"
                    value={plan.includedIntelligence}
                    onChange={(v) => setPlan({ includedIntelligence: v })}
                  />
                  <NumField
                    label="Storage (GB)"
                    value={plan.includedStorageGb}
                    onChange={(v) => setPlan({ includedStorageGb: v })}
                  />
                  <NumField
                    label="Data transfer (GB/mo)"
                    value={plan.includedTransferGb}
                    onChange={(v) => setPlan({ includedTransferGb: v })}
                  />
                  <Field label="Support level">
                    <Select
                      value={plan.supportLevel}
                      onValueChange={(v) => setPlan({ supportLevel: v as SupportLevel })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SUPPORT_LEVELS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              )}

              <Field label="Eligible markets">
                <div className="flex flex-wrap gap-2">
                  {draft.markets.map((m) => {
                    const on = plan.eligibleMarkets.includes(m.id);
                    return (
                      <Button
                        key={m.id}
                        size="sm"
                        variant={on ? "default" : "outline"}
                        onClick={() =>
                          setPlan({
                            eligibleMarkets: on
                              ? plan.eligibleMarkets.filter((x) => x !== m.id)
                              : [...plan.eligibleMarkets, m.id],
                          })
                        }
                      >
                        {m.name}
                      </Button>
                    );
                  })}
                </div>
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pricing</CardTitle>
              <CardDescription>Product × market × billing cycle.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field label="Market">
                <Select value={market} onValueChange={(v) => setMarket(v as MarketId)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {draft.markets.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} ({m.currency})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {priceRule?.quoteOnly ? (
                <p className="rounded-md bg-secondary p-3 text-xs text-muted-foreground">
                  This plan is quote-only in this market. The public page shows “Contact sales”.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <NumField
                    label={`Monthly (${priceRule?.currency ?? ""})`}
                    value={priceRule?.monthly ?? null}
                    onChange={(v) => setPrice({ monthly: v })}
                  />
                  <NumField
                    label={`Annual (${priceRule?.currency ?? ""})`}
                    value={priceRule?.annual ?? null}
                    onChange={(v) => setPrice({ annual: v })}
                  />
                  <NumField
                    label="Annual discount %"
                    value={priceRule?.annualDiscountPct ?? 0}
                    onChange={(v) => setPrice({ annualDiscountPct: v ?? 0 })}
                  />
                  <div className="self-end text-xs text-muted-foreground">
                    Monthly-equivalent:{" "}
                    <span className="tabular">
                      {formatMoney(
                        priceRule?.annual ? Math.round(priceRule.annual / 12) : null,
                        priceRule?.currency ?? "USD",
                      )}
                    </span>
                  </div>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!priceRule?.monthly) return;
                  setPrice({
                    annual: Math.round(priceRule.monthly * 12 * (1 - priceRule.annualDiscountPct / 100)),
                  });
                  toast.success("Annual price recalculated from discount");
                }}
              >
                Recalculate annual from discount
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Included entitlements</CardTitle>
              <CardDescription>Price says what they pay; entitlement says what they may use.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              {plan.entitlements.map((e, i) => (
                <div key={`${e.key}-${i}`} className="flex justify-between rounded-md border px-3 py-1.5">
                  <span>{ENTITLEMENT_LABELS[e.key] ?? e.key}</span>
                  <span className="tabular text-muted-foreground">
                    {e.value !== undefined ? `${e.value.toLocaleString()} ${e.unit ?? ""}` : e.label}
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

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

export function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <Field label={label}>
      <Input
        type="number"
        className="tabular"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      />
    </Field>
  );
}
