import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AdminLayout, PageHeader } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCommerce } from "@/lib/commerce/store";
import { formatMoney } from "@/lib/commerce/pricing";
import { CHARGE_CLASS_LABEL, type ChargeClass } from "@/lib/commerce/cart";
import {
  bundleAdditionEntitlements,
  ENTITLEMENT_LABELS,
  summariseEntitlements,
} from "@/lib/commerce/entitlements";
import { WorkspaceBundleAddOns } from "@/components/admin/WorkspaceBundleAddOns";
import type {
  SubscriptionStatus,
  TenantSubscription,
  WorkspaceBundleAddition,
} from "@/lib/commerce/types";
import { toast } from "sonner";

export const Route = createFileRoute("/tenants")({
  head: () => ({
    meta: [
      { title: "Tenant Subscriptions | Aurumi Price Admin" },
      {
        name: "description",
        content:
          "What each Aurumi tenant has purchased: plan, market, charges and the tenant-level entitlements that result.",
      },
      { property: "og:title", content: "Tenant Subscriptions | Aurumi Price Admin" },
      {
        property: "og:description",
        content: "Simulated tenant subscription records and their commercial entitlements.",
      },
    ],
  }),
  component: TenantsPage,
});

const STATUS_COPY: Record<SubscriptionStatus, string> = {
  draft: "Draft",
  quote_required: "Quote required",
  pending_payment: "Pending payment",
  active: "Active",
  payment_failed: "Payment failed",
  pending_cancellation: "Pending cancellation",
  cancelled: "Cancelled",
  expired: "Expired",
};

function TenantsPage() {
  const { state, published, updateSubscription } = useCommerce();
  const [selectedId, setSelectedId] = useState<string | null>(state.subscriptions[0]?.id ?? null);
  const sub = state.subscriptions.find((s) => s.id === selectedId) ?? state.subscriptions[0] ?? null;

  const needsQuote = (s: TenantSubscription) => s.lines.some((l) => l.quoteOnly);

  const tenantName = (id: string) => state.tenants.find((t) => t.id === id)?.name ?? id;
  /** Workspace subscriptions show the plan; standalone Aura shows the offer. */
  const productName = (s: TenantSubscription) => {
    if (s.productLine === "aura") {
      return published.auraOffers?.find((o) => o.id === s.auraOfferId)?.name ?? "Standalone Aura";
    }
    return published.plans.find((p) => p.id === s.planId)?.name ?? s.planId;
  };

  const transition = (
    s: TenantSubscription,
    status: SubscriptionStatus,
    paymentStatus: TenantSubscription["paymentStatus"],
    type: TenantSubscription["changeLog"][number]["type"],
    description: string,
  ) => {
    const now = new Date().toISOString();
    updateSubscription(s.id, (prev) => ({
      ...prev,
      status,
      paymentStatus,
      cancellationRequested: status === "pending_cancellation" || status === "cancelled",
      cancellationEffective: status === "pending_cancellation" ? prev.renewalDate : prev.cancellationEffective,
      changeLog: [
        {
          id: `chg.${Math.random().toString(36).slice(2, 8)}`,
          type,
          description,
          timing: "immediate",
          prorated: false,
          effectiveDate: now,
          createdAt: now,
        },
        ...prev.changeLog,
      ],
    }));
    toast.success(description);
  };

  /** Bundle addition — the Workspace plan identity is never modified. */
  const logEntry = (type: TenantSubscription["changeLog"][number]["type"], description: string) => {
    const now = new Date().toISOString();
    return {
      id: `chg.${Math.random().toString(36).slice(2, 8)}`,
      type,
      description,
      timing: "immediate" as const,
      prorated: false,
      effectiveDate: now,
      createdAt: now,
    };
  };

  const addBundleAddition = (s: TenantSubscription, addition: WorkspaceBundleAddition) => {
    updateSubscription(s.id, (prev) => ({
      ...prev,
      bundleAdditions: [...(prev.bundleAdditions ?? []), addition],
      changeLog: [
        logEntry(
          addition.status === "quote_required" ? "quote_requested" : "created",
          addition.status === "quote_required"
            ? `${addition.bundleName} added to Workspace — quote required`
            : `${addition.bundleName} added to Workspace — awaiting simulated payment`,
        ),
        ...prev.changeLog,
      ],
    }));
  };

  const activateBundleAddition = (s: TenantSubscription, additionId: string) => {
    updateSubscription(s.id, (prev) => {
      const target = (prev.bundleAdditions ?? []).find((a) => a.id === additionId);
      return {
        ...prev,
        bundleAdditions: (prev.bundleAdditions ?? []).map((a) =>
          a.id === additionId ? { ...a, status: "active" as const } : a,
        ),
        changeLog: [
          logEntry("activated", `Simulated payment succeeded — ${target?.bundleName ?? "bundle"} active`),
          ...prev.changeLog,
        ],
      };
    });
    toast.success("Simulated payment succeeded — bundle added to the Workspace subscription");
  };


  return (
    <AdminLayout>
      <PageHeader
        title="Tenant Subscriptions"
        description="What each tenant has purchased and what they are commercially entitled to. User and role access lives in Tenant Administration; usage and adoption live in Tenant Health."
        actions={
          <Button asChild>
            <Link to="/subscriptions/new">New subscription</Link>
          </Button>
        }
      />

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Subscriptions ({state.subscriptions.length})</CardTitle>
          <CardDescription>Simulated records — no billing system is connected.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Market</TableHead>
                  <TableHead>Cycle</TableHead>
                  <TableHead>Recurring</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Catalogue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.subscriptions.map((s) => (
                  <TableRow
                    key={s.id}
                    tabIndex={0}
                    onClick={() => setSelectedId(s.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedId(s.id);
                      }
                    }}
                    className={`cursor-pointer ${s.id === sub?.id ? "bg-secondary" : ""}`}
                  >
                    <TableCell className="font-medium">{tenantName(s.tenantId)}</TableCell>
                    <TableCell>
                      {productName(s)}
                      <span className="block text-xs text-muted-foreground">
                        {s.productLine === "aura" ? "Standalone Aura — no Workspace plan" : "Aurumi Workspace"}
                      </span>
                    </TableCell>
                    <TableCell>{s.market}</TableCell>
                    <TableCell>{s.billingCycle}</TableCell>
                    <TableCell className="tabular">{formatMoney(s.totals.recurringTotal, s.currency)}</TableCell>
                    <TableCell>
                      <Badge variant={s.status === "active" ? "default" : "outline"}>{STATUS_COPY[s.status]}</Badge>
                    </TableCell>
                    <TableCell className="tabular text-muted-foreground">v{s.catalogueVersion}</TableCell>
                  </TableRow>
                ))}
                {state.subscriptions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      No tenant subscriptions yet.{" "}
                      <Link className="underline" to="/subscriptions/new">
                        Build one in the Subscription Builder
                      </Link>
                      .
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {sub ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {tenantName(sub.tenantId)} · {productName(sub)}
              </CardTitle>
              <CardDescription>
                {sub.market} · {sub.currency} · {sub.billingCycle} · created from catalogue v{sub.catalogueVersion}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5 text-sm">
                {sub.lines.map((l) => {
                  const chargeClass = (l as { chargeClass?: ChargeClass }).chargeClass ?? "add_on";
                  return (
                    <div key={l.id} className="flex items-center justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2">
                        <Badge variant={chargeClass === "included" ? "secondary" : "outline"} className="shrink-0">
                          {CHARGE_CLASS_LABEL[chargeClass]}
                        </Badge>
                        <span className="truncate">
                          {l.label}
                          {l.recurring ? "" : " · one-time"}
                        </span>
                      </span>
                      <span className="tabular shrink-0">
                        {l.quoteOnly
                          ? "Quoted"
                          : chargeClass === "included"
                            ? "Included"
                            : formatMoney(l.unitAmount * l.quantity, sub.currency)}
                      </span>
                    </div>
                  );
                })}
              </div>
              <Separator />
              <div className="grid gap-1.5 text-sm sm:grid-cols-2">
                <Line label="Recurring subtotal" value={formatMoney(sub.totals.recurringSubtotal, sub.currency)} />
                <Line label="One-time subtotal" value={formatMoney(sub.totals.oneTimeSubtotal, sub.currency)} />
                <Line label="Promotions" value={`− ${formatMoney(sub.totals.discount, sub.currency)}`} />
                <Line
                  label={`${sub.totals.taxName} (${sub.totals.taxRatePct}%) — simulated`}
                  value={formatMoney(sub.totals.tax, sub.currency)}
                />
                <Line label="Recurring charge" value={formatMoney(sub.totals.recurringTotal, sub.currency)} strong />
                <Line label="One-time charges" value={formatMoney(sub.totals.oneTimeTotal, sub.currency)} strong />
              </div>
              <Separator />
              <div className="space-y-1.5">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Simulated lifecycle</div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={sub.status === "draft" ? "default" : "outline"}>Draft</Badge>→
                  {needsQuote(sub) ? (
                    <Badge variant={sub.status === "quote_required" ? "default" : "outline"}>Quote required</Badge>
                  ) : (
                    <>
                      <Badge variant={sub.status === "pending_payment" ? "default" : "outline"}>Pending payment</Badge>
                      →<Badge variant={sub.status === "active" ? "default" : "outline"}>Active</Badge>
                    </>
                  )}
                  <span className="text-xs text-muted-foreground">
                    Payment mode: {sub.paymentMode} ({sub.paymentStatus.replaceAll("_", " ")}) via{" "}
                    {sub.paymentProvider}
                  </span>
                </div>
                {needsQuote(sub) ? (
                  <p className="rounded-md border bg-secondary px-3 py-2 text-xs">
                    Your configuration includes custom pricing. An Aurumi representative will prepare a quote. No
                    simulated payment is taken for a quote-required configuration.
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2 pt-2">
                  {sub.status === "draft" ? (
                    <Button
                      size="sm"
                      onClick={() =>
                        needsQuote(sub)
                          ? transition(
                              sub,
                              "quote_required",
                              "quote_pending",
                              "quote_requested",
                              "Configuration submitted for quote — no payment due",
                            )
                          : transition(
                              sub,
                              "pending_payment",
                              "awaiting_simulated_payment",
                              "created",
                              "Draft confirmed — awaiting simulated payment",
                            )
                      }
                    >
                      {needsQuote(sub) ? "Request quote" : "Confirm configuration"}
                    </Button>
                  ) : null}
                  {sub.status === "quote_required" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        transition(
                          sub,
                          "quote_required",
                          "quote_pending",
                          "quote_requested",
                          "Quote request re-sent to the Aurumi commercial team",
                        )
                      }
                    >
                      Request quote
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    disabled={sub.status !== "pending_payment" && sub.status !== "payment_failed"}
                    onClick={() =>
                      transition(sub, "active", "simulated_paid", "activated", "Simulated payment succeeded — subscription active")
                    }
                  >
                    Simulate successful payment
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={sub.status !== "pending_payment"}
                    onClick={() =>
                      transition(sub, "payment_failed", "simulated_failed", "payment_failed", "Simulated payment failed")
                    }
                  >
                    Simulate failed payment
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={sub.status !== "active"}
                    onClick={() =>
                      transition(
                        sub,
                        "pending_cancellation",
                        sub.paymentStatus,
                        "cancel",
                        "Cancellation requested — effective at end of term",
                      )
                    }
                  >
                    Request cancellation
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={sub.status !== "pending_cancellation" && sub.status !== "cancelled"}
                    onClick={() => transition(sub, "expired", "not_required", "expired", "Subscription term expired")}
                  >
                    Simulate expiry
                  </Button>
                </div>
                <p className="pt-1 text-xs text-muted-foreground">
                  These states are simulated for prototyping. A real payment provider will own the verified payment
                  state in a later phase.
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tenant entitlements</CardTitle>
                <CardDescription>Commercial allowance, not user access.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                {summariseEntitlements([
                  ...sub.entitlements,
                  ...(sub.bundleAdditions ?? [])
                    .filter((a) => a.status === "active")
                    .flatMap((a) => bundleAdditionEntitlements(published, a)),
                ]).map((e) => (
                  <div key={e.key} className="flex justify-between gap-3">
                    <span>{ENTITLEMENT_LABELS[e.key] ?? e.key}</span>
                    <span className="tabular text-right text-muted-foreground">
                      {e.total > 0 ? `${e.total.toLocaleString()} ${e.unit ?? ""}` : e.labels.join(", ")}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <WorkspaceBundleAddOns
              published={published}
              subscription={sub}
              onAdd={(addition) => addBundleAddition(sub, addition)}
              onActivate={(additionId) => activateBundleAddition(sub, additionId)}
            />

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Subscription history</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                {sub.changeLog.map((c) => (
                  <div key={c.id} className="rounded-md border px-3 py-1.5">
                    <div>{c.description}</div>
                    <div className="text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleString()}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}
    </AdminLayout>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${strong ? "font-semibold" : ""}`}>
      <span>{label}</span>
      <span className="tabular">{value}</span>
    </div>
  );
}
