/**
 * WORKSPACE PURCHASE OF BUNDLES.
 *
 * An existing Workspace subscription can add a PUBLISHED BundleOffer when
 * `availableAsWorkspaceAddon` is true. There is no second bundle product: this
 * flow consumes exactly the same published offer, market and cycle machinery
 * as the standalone Aura + Bundle landing page.
 *
 *   Existing Workspace + published Bundle = incremental Bundle charge
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { bundleEligibility, sellableBundles } from "@/lib/commerce/bundles";
import {
  calculateBundleQuote,
  formatBundleMoney,
  getBundleOffer,
  type BundleOfferView,
} from "@/lib/bundle/offer";
import type { Catalogue, TenantSubscription, WorkspaceBundleAddition } from "@/lib/commerce/types";

const TREATMENT_LABEL: Record<string, string> = {
  included: "Included",
  recurring: "Recurring",
  one_time: "One-time",
  quote_required: "Quote required",
};

export function WorkspaceBundleAddOns({
  published,
  subscription,
  onAdd,
  onActivate,
}: {
  published: Catalogue;
  subscription: TenantSubscription;
  onAdd: (addition: WorkspaceBundleAddition) => void;
  onActivate: (additionId: string) => void;
}) {
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});

  const additions = subscription.bundleAdditions ?? [];

  /** PUBLISHED catalogue only — a draft bundle is never purchasable. */
  const eligible = useMemo(
    () =>
      sellableBundles(published, subscription.market).filter(
        (b) => bundleEligibility(b).availableAsWorkspaceAddon,
      ),
    [published, subscription.market],
  );

  const offerFor = (bundleId: string): BundleOfferView | null => {
    const result = getBundleOffer({
      catalogue: published,
      bundle: bundleId,
      market: subscription.market,
    });
    return result.available ? result.offer : null;
  };

  const reviewOffer = reviewing ? offerFor(reviewing) : null;
  const quote = reviewOffer
    ? calculateBundleQuote(reviewOffer, subscription.billingCycle, qty)
    : null;

  const confirm = () => {
    if (!reviewOffer || !quote) return;
    const addition: WorkspaceBundleAddition = {
      id: `wba.${Math.random().toString(36).slice(2, 8)}`,
      bundleId: reviewOffer.bundleId,
      bundleName: reviewOffer.name,
      catalogueVersion: reviewOffer.catalogueVersion,
      market: reviewOffer.market,
      billingCycle: subscription.billingCycle,
      currency: reviewOffer.currency,
      connectorIds: reviewOffer.connectors.map((c) => c.id),
      addOns: reviewOffer.addOns
        .filter((a) => (qty[a.id] ?? 0) > 0)
        .map((a) => ({ id: a.id, quantity: qty[a.id]!, units: qty[a.id]! * a.unitSize })),
      recurringAmount: quote.cycleTotal,
      oneTimeAmount: quote.oneTimeTotal,
      quoteReasons: quote.quoteReasons,
      lines: quote.lines,
      // A quote-required bundle NEVER enters the simulated payment path.
      status: quote.quoteRequired ? "quote_required" : "pending_payment",
      createdAt: new Date().toISOString(),
    };
    onAdd(addition);
    setReviewing(null);
    setQty({});
    toast.success(
      quote.quoteRequired
        ? `${reviewOffer.name} submitted for quote — no simulated payment taken`
        : `${reviewOffer.name} added — awaiting simulated payment`,
    );
  };

  if (subscription.productLine !== "workspace") return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Available Bundles</CardTitle>
        <CardDescription>
          Published bundles this Workspace may add. Priced from the published bundle configuration in{" "}
          {subscription.market}, on the Workspace {subscription.billingCycle} cycle.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {additions.length ? (
          <div className="space-y-2">
            {additions.map((a) => (
              <div key={a.id} className="rounded-md border px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    Workspace plan + {a.bundleName}
                  </span>
                  <Badge variant={a.status === "active" ? "default" : "outline"}>
                    {a.status === "active"
                      ? "Active"
                      : a.status === "pending_payment"
                        ? "Pending simulated payment"
                        : "Quote required"}
                  </Badge>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {a.status === "quote_required"
                    ? `Quote required: ${a.quoteReasons.join("; ")}`
                    : `Incremental ${a.billingCycle} charge ${formatBundleMoney(a.recurringAmount, a.currency)}${
                        a.oneTimeAmount ? ` · one-time ${formatBundleMoney(a.oneTimeAmount, a.currency)}` : ""
                      }`}{" "}
                  · bundle catalogue v{a.catalogueVersion}
                </div>
                {a.status === "pending_payment" ? (
                  <Button size="sm" className="mt-2" onClick={() => onActivate(a.id)}>
                    Simulate successful payment
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {eligible.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No published bundle is available as a Workspace add-on in {subscription.market}.
          </p>
        ) : null}

        {eligible.map((b) => {
          const offer = offerFor(b.id);
          const already = additions.some((a) => a.bundleId === b.id);
          if (!offer) return null;
          return (
            <div key={b.id} className="rounded-md border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium">{offer.name}</div>
                  <div className="text-xs text-muted-foreground">{offer.positioning}</div>
                </div>
                <Badge variant="secondary">Available as Workspace add-on</Badge>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                {offer.connectors.map((c) => (
                  <span key={c.id} className="rounded border px-2 py-0.5">
                    {c.name}
                  </span>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="tabular text-sm">
                  {subscription.billingCycle === "annual"
                    ? formatBundleMoney(offer.annualPrice, offer.currency)
                    : formatBundleMoney(offer.monthlyPrice, offer.currency)}{" "}
                  <span className="text-xs text-muted-foreground">
                    per {subscription.billingCycle === "annual" ? "year" : "month"}
                  </span>
                </span>
                <Button
                  size="sm"
                  variant={reviewing === b.id ? "secondary" : "default"}
                  disabled={already}
                  onClick={() => {
                    setReviewing(reviewing === b.id ? null : b.id);
                    setQty({});
                  }}
                >
                  {already ? "Already added" : reviewing === b.id ? "Close review" : "Add to Workspace"}
                </Button>
              </div>

              {reviewing === b.id && reviewOffer && quote ? (
                <div className="mt-3 space-y-3 rounded-md bg-secondary p-3 text-sm">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Review — current Workspace + {reviewOffer.name}
                  </div>

                  {reviewOffer.addOns.length ? (
                    <div className="space-y-1.5">
                      <div className="text-xs text-muted-foreground">Bundle add-ons</div>
                      {reviewOffer.addOns.map((a) => (
                        <div key={a.id} className="flex items-center justify-between gap-3">
                          <label htmlFor={`wba-${a.id}`} className="min-w-0 truncate">
                            {a.name}{" "}
                            <span className="text-xs text-muted-foreground">
                              {formatBundleMoney(
                                subscription.billingCycle === "annual" ? a.unitAnnual : a.unitMonthly,
                                reviewOffer.currency,
                              )}{" "}
                              per {a.unitSize.toLocaleString()} {a.unit}
                              {a.recurring
                                ? ` per ${subscription.billingCycle === "annual" ? "year" : "month"}`
                                : " one-time"}
                            </span>
                          </label>
                          <Input
                            id={`wba-${a.id}`}
                            type="number"
                            min={0}
                            max={a.maxQuantity}
                            className="h-8 w-20"
                            value={qty[a.id] ?? 0}
                            onChange={(e) =>
                              setQty((prev) => ({
                                ...prev,
                                [a.id]: Math.max(0, Math.min(a.maxQuantity, Number(e.target.value) || 0)),
                              }))
                            }
                          />
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <Separator />
                  <div className="space-y-1">
                    {quote.lines.map((l) => (
                      <div key={l.id} className="flex items-center justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-2">
                          <Badge variant={l.treatment === "included" ? "secondary" : "outline"} className="shrink-0">
                            {TREATMENT_LABEL[l.treatment] ?? l.treatment}
                          </Badge>
                          <span className="truncate">{l.label}</span>
                        </span>
                        <span className="tabular shrink-0">
                          {l.treatment === "included"
                            ? "Included"
                            : l.amount === null
                              ? "Quoted"
                              : formatBundleMoney(l.amount, reviewOffer.currency)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <Separator />
                  <div className="space-y-1">
                    <Row
                      label={`Incremental bundle charge (${subscription.billingCycle})`}
                      value={formatBundleMoney(quote.cycleTotal, reviewOffer.currency)}
                      strong
                    />
                    {quote.oneTimeTotal ? (
                      <Row
                        label="One-time charge"
                        value={formatBundleMoney(quote.oneTimeTotal, reviewOffer.currency)}
                      />
                    ) : null}
                    <p className="pt-1 text-xs text-muted-foreground">
                      {reviewOffer.taxNote} Existing Workspace charges are unchanged — only the bundle's own
                      configured components are charged.
                    </p>
                  </div>

                  {quote.quoteRequired ? (
                    <p className="rounded-md border bg-background px-3 py-2 text-xs">
                      This bundle addition requires a quote ({quote.quoteReasons.join("; ")}). No simulated payment is
                      taken.
                    </p>
                  ) : (
                    <p className="rounded-md border bg-background px-3 py-2 text-xs">
                      SIMULATED — no real payment occurs, no card details are collected and no payment provider is
                      invoked.
                    </p>
                  )}

                  <Button size="sm" onClick={confirm}>
                    {quote.quoteRequired ? "Request quote" : "Confirm addition"}
                  </Button>
                </div>
              ) : null}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${strong ? "font-semibold" : ""}`}>
      <span>{label}</span>
      <span className="tabular">{value}</span>
    </div>
  );
}
