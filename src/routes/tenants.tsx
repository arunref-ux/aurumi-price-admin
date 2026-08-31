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
import { ENTITLEMENT_LABELS, summariseEntitlements } from "@/lib/commerce/entitlements";
import type { SubscriptionStatus, TenantSubscription } from "@/lib/commerce/types";
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

  const tenantName = (id: string) => state.tenants.find((t) => t.id === id)?.name ?? id;
  const planName = (id: string) => published.plans.find((p) => p.id === id)?.name ?? id;

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
                  <TableHead>Plan</TableHead>
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
                    <TableCell>{planName(s.planId)}</TableCell>
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
                {tenantName(sub.tenantId)} · {planName(sub.planId)}
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
                  <Badge variant="outline">Draft</Badge>→
                  <Badge variant={sub.status === "pending_payment" ? "default" : "outline"}>Pending payment</Badge>→
                  <Badge variant={sub.status === "active" ? "default" : "outline"}>Active</Badge>
                  <span className="text-xs text-muted-foreground">
                    Payment mode: {sub.paymentMode} ({sub.paymentStatus.replaceAll("_", " ")}) via{" "}
                    {sub.paymentProvider}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
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
                {summariseEntitlements(sub.entitlements).map((e) => (
                  <div key={e.key} className="flex justify-between gap-3">
                    <span>{ENTITLEMENT_LABELS[e.key] ?? e.key}</span>
                    <span className="tabular text-right text-muted-foreground">
                      {e.total > 0 ? `${e.total.toLocaleString()} ${e.unit ?? ""}` : e.labels.join(", ")}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

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
