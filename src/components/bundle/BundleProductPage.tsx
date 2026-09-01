import { useMemo, useRef, useState } from "react";

import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, Layers, MessageSquare, Plug, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

import type { DemoAnswer } from "@/lib/aura/tally-demo";
import { useCommerce } from "@/lib/commerce/store";
import {
  bundleMarketOptions,
  buildBundlePurchaseIntent,
  calculateBundleQuote,
  formatBundleMoney,
  getBundleOffer,
  type BundleBillingCycle,
  type BundleMarketId,
  type BundlePurchaseIntent,
} from "@/lib/bundle/offer";
import type { BundleDemoQuestion } from "@/lib/bundle/finance-demo";

export interface BundlePageConfig {
  /** Bundle slug in the published catalogue, e.g. "finance-cash-flow". */
  slug: string;
  /** Marketing headline — the bundle outcome, not the connector list. */
  headline: string;
  supporting: string;
  demoCompanyName: string;
  demoDisclaimer: string;
  sampleQuestions: BundleDemoQuestion[];
  answer: (question: string) => DemoAnswer;
}

interface Turn {
  id: number;
  question: string;
  answer: DemoAnswer;
}

export function BundleProductPage({ config }: { config: BundlePageConfig }) {
  const demoRef = useRef<HTMLDivElement>(null);
  const pricingRef = useRef<HTMLDivElement>(null);

  // Single commercial source: the PUBLISHED Price Admin catalogue.
  const { published } = useCommerce();

  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [market, setMarket] = useState<BundleMarketId>("IN");
  const [cycle, setCycle] = useState<BundleBillingCycle>("monthly");
  const [addOnQty, setAddOnQty] = useState<Record<string, number>>({});
  const [purchaseIntent, setPurchaseIntent] = useState<BundlePurchaseIntent | null>(null);

  const markets = useMemo(() => bundleMarketOptions(published), [published]);
  const offerResult = useMemo(
    () => getBundleOffer({ catalogue: published, bundle: config.slug, market }),
    [published, config.slug, market],
  );
  const offer = offerResult.available ? offerResult.offer : null;
  const quote = useMemo(
    () => (offer ? calculateBundleQuote(offer, cycle, addOnQty) : null),
    [offer, cycle, addOnQty],
  );

  const ask = (question: string) => {
    const q = question.trim();
    if (!q) return;
    setTurns((prev) => [...prev, { id: prev.length + 1, question: q, answer: config.answer(q) }]);
    setDraft("");
    window.setTimeout(() => {
      demoRef.current
        ?.querySelector("[data-conversation-end]")
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 50);
  };

  const scrollTo = (ref: React.RefObject<HTMLDivElement | null>) =>
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const purchase = () => {
    if (!offer || !offer.availableDirectlyWithAura) return;
    // Simulated flow only — no payment provider, no card collection.
    const intent = buildBundlePurchaseIntent(offer, cycle, addOnQty);
    console.info("[simulated bundle purchase intent]", intent);
    setPurchaseIntent(intent);
    window.setTimeout(() => {
      document
        .getElementById("bundle-purchase-result")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const setQty = (id: string, qty: number, max: number) =>
    setAddOnQty((prev) => ({ ...prev, [id]: Math.max(0, Math.min(max, qty)) }));

  const money = (n: number | null | undefined) =>
    formatBundleMoney(n, offer?.currency ?? "USD");

  return (
    <main className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden bg-sidebar text-sidebar-foreground">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full opacity-20 blur-3xl"
          style={{ background: "var(--color-accent)" }}
        />
        <div className="relative mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
          <div className="flex items-center gap-3 text-sm">
            <span className="font-display text-lg font-semibold tracking-tight text-accent">AURUMI</span>
            <span className="text-sidebar-foreground/40">/</span>
            <span className="text-sidebar-foreground/70">Bundles</span>
          </div>

          <div className="mt-10 grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div>
              <p className="font-display text-sm font-semibold uppercase tracking-[0.32em] text-accent">
                Bundle
              </p>
              <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.05] sm:text-6xl">
                {config.headline}
              </h1>
              <p className="mt-5 max-w-xl text-base text-sidebar-foreground/80 sm:text-lg">
                {config.supporting}
              </p>

              <div className="mt-7 flex flex-wrap gap-2">
                {(offer?.connectors ?? []).map((c) => (
                  <span
                    key={c.id}
                    className="rounded-full border border-sidebar-border bg-sidebar-accent/40 px-3 py-1.5 text-xs font-medium"
                  >
                    {c.name}
                  </span>
                ))}
              </div>

              <div className="mt-9 flex flex-wrap gap-3">
                <Button size="lg" onClick={() => scrollTo(demoRef)}>
                  Try the demo
                  <MessageSquare className="ml-1 size-4" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-sidebar-border bg-transparent text-sidebar-foreground hover:bg-sidebar-accent"
                  onClick={() => scrollTo(pricingRef)}
                >
                  See pricing
                  <ArrowRight className="ml-1 size-4" />
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-sidebar-border bg-sidebar-accent/30 p-6">
              <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-accent">
                One bundle, four systems
              </p>
              <ul className="mt-4 space-y-3 text-sm text-sidebar-foreground/85">
                {(offer?.connectors ?? []).map((c) => (
                  <li key={c.id} className="flex gap-2.5">
                    <Plug className="mt-0.5 size-4 shrink-0 text-accent" />
                    <span>
                      <span className="font-medium text-sidebar-foreground">{c.name}</span>
                      <span className="text-sidebar-foreground/60"> · {c.category}</span>
                      <br />
                      {c.description}
                    </span>
                  </li>
                ))}
                {!offer ? (
                  <li className="text-sidebar-foreground/70">
                    This bundle is not published in the selected market.
                  </li>
                ) : null}
              </ul>
              <p className="mt-5 text-xs text-sidebar-foreground/60">
                Connectors keep their normal Aurumi identity. The bundle only changes how they are
                packaged and sold.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Demo */}
      <section ref={demoRef} className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="max-w-2xl">
          <Badge variant="secondary">Simulated demo</Badge>
          <h2 className="mt-3 font-display text-3xl font-semibold">
            Ask one question. Get an answer across every connected system.
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Talk to Your Business answers using {config.demoCompanyName}&rsquo;s combined finance
            context. {config.demoDisclaimer}
          </p>
        </div>

        <Card className="mt-8">
          <CardContent className="p-0">
            <div className="flex flex-col gap-4 px-4 py-5 sm:px-6">
              {turns.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-muted/40 px-4 py-8 text-center">
                  <p className="font-display text-sm font-semibold">
                    Start with one of the suggested questions
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Every answer is generated from the fixed demo dataset — no live systems are
                    contacted.
                  </p>
                </div>
              ) : (
                turns.map((t) => (
                  <div key={t.id} className="flex flex-col gap-3">
                    <div className="self-end max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                      {t.question}
                    </div>
                    <AnswerBlock answer={t.answer} />
                  </div>
                ))
              )}
              <div data-conversation-end />
            </div>

            <Separator />

            <div className="px-4 py-4 sm:px-6">
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  ask(draft);
                }}
              >
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Ask about cash, invoices, payments, sales or expenses"
                  aria-label="Ask a question about the demo business"
                />
                <Button type="submit" aria-label="Send question">
                  <Send className="size-4" />
                </Button>
              </form>

              <div className="mt-3 flex flex-wrap gap-2">
                {config.sampleQuestions.map((q) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => ask(q.question)}
                    className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    {q.question}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Pricing */}
      <section ref={pricingRef} className="border-t bg-muted/30">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <h2 className="font-display text-3xl font-semibold">Bundle pricing</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                One commercial package covering Talk to Your Business and every included
                connection. Prices come from the published Aurumi commercial catalogue
                {offer ? ` (v${offer.catalogueVersion})` : ""}.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Select value={market} onValueChange={(v) => setMarket(v as BundleMarketId)}>
                <SelectTrigger className="w-[200px]" aria-label="Select market">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {markets.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name} ({m.currency})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Tabs value={cycle} onValueChange={(v) => setCycle(v as BundleBillingCycle)}>
                <TabsList>
                  <TabsTrigger value="monthly">Monthly</TabsTrigger>
                  <TabsTrigger value="annual">Annual</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          {!offer ? (
            <Card className="mt-8">
              <CardContent className="py-10 text-center">
                <p className="font-display text-lg font-semibold">
                  {offerResult.available ? "" : offerResult.reason}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  This bundle has no published commercial offer for the selected market. Configure
                  and publish it in Price Admin to see pricing here.
                </p>
                <Button className="mt-5" variant="outline" asChild>
                  <Link to="/bundles">Open bundle administration</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <Card>
                <CardContent className="p-6">
                  <div className="flex flex-wrap items-baseline gap-3">
                    <span className="font-display text-4xl font-semibold tabular">
                      {quote?.quoteRequired
                        ? "Quote"
                        : money(cycle === "annual" ? offer.annualPrice : offer.monthlyPrice)}
                    </span>
                    {!quote?.quoteRequired ? (
                      <span className="text-sm text-muted-foreground">
                        {cycle === "annual" ? "per year" : "per month"}
                      </span>
                    ) : null}
                    {cycle === "annual" && (quote?.annualSavingPct ?? 0) > 0 ? (
                      <Badge>Save {quote?.annualSavingPct}%</Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {offer.marketName} · {offer.taxNote}
                  </p>

                  <Separator className="my-5" />

                  <p className="font-display text-sm font-semibold">What&rsquo;s included</p>
                  <ul className="mt-3 space-y-2 text-sm">
                    {offer.included.users !== null ? (
                      <Included text={`${offer.included.users} users`} />
                    ) : null}
                    {offer.included.intelligenceCredits !== null ? (
                      <Included
                        text={`${offer.included.intelligenceCredits.toLocaleString()} Aurumi Intelligence Credits / month`}
                      />
                    ) : null}
                    {offer.included.storageGb !== null ? (
                      <Included text={`${offer.included.storageGb} GB storage`} />
                    ) : null}
                    {offer.connectors.map((c) => (
                      <Included key={c.id} text={`${c.name} connection`} />
                    ))}
                  </ul>

                  <Separator className="my-5" />

                  <p className="font-display text-sm font-semibold">Commercial components</p>
                  <ul className="mt-3 space-y-2 text-sm">
                    {offer.components.map((c) => (
                      <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-muted-foreground">
                          {c.label}
                          {c.note ? (
                            <span className="block text-xs text-muted-foreground/80">{c.note}</span>
                          ) : null}
                        </span>
                        <span className="tabular text-sm">
                          {c.treatment === "included"
                            ? "Included"
                            : c.treatment === "quote_required"
                              ? "Quote required"
                              : c.treatment === "one_time"
                                ? `${money(c.oneTime)} one-time`
                                : `${money(cycle === "annual" ? c.annual : c.monthly)} ${cycle === "annual" ? "/ year" : "/ month"}`}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <p className="mt-5 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                    {offer.commercialTerms}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <p className="font-display text-sm font-semibold">Add capacity</p>
                  <div className="mt-4 space-y-4">
                    {offer.addOns.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No add-ons are enabled for this bundle in {offer.marketName}.
                      </p>
                    ) : null}
                    {offer.addOns.map((a) => {
                      const unit = a.recurring
                        ? cycle === "annual"
                          ? a.unitAnnual
                          : a.unitMonthly
                        : a.unitMonthly;
                      const qty = addOnQty[a.id] ?? 0;
                      return (
                        <div key={a.id} className="rounded-lg border border-border p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium">{a.name}</p>
                              <p className="text-xs text-muted-foreground">{a.description}</p>
                            </div>
                            <div className="text-right">
                              <p className="tabular text-sm">{money(unit)}</p>
                              <p className="text-xs text-muted-foreground">
                                {a.recurring
                                  ? cycle === "annual"
                                    ? `per ${a.unitSize} ${a.unit} / year`
                                    : `per ${a.unitSize} ${a.unit} / month`
                                  : `per ${a.unitSize} ${a.unit} one-time`}
                              </p>
                            </div>
                          </div>
                          <div className="mt-3 flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              aria-label={`Decrease ${a.name}`}
                              onClick={() => setQty(a.id, qty - 1, a.maxQuantity)}
                            >
                              −
                            </Button>
                            <span className="tabular w-16 text-center text-sm">
                              {(qty * a.unitSize).toLocaleString()} {a.unit}
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              aria-label={`Increase ${a.name}`}
                              onClick={() => setQty(a.id, qty + 1, a.maxQuantity)}
                            >
                              +
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <Separator className="my-5" />

                  <p className="font-display text-sm font-semibold">Order summary</p>
                  <ul className="mt-3 space-y-1.5 text-sm">
                    {quote?.lines.map((l) => (
                      <li key={l.id} className="flex justify-between gap-3">
                        <span className="text-muted-foreground">{l.label}</span>
                        <span className="tabular">
                          {l.treatment === "included"
                            ? "Included"
                            : l.treatment === "quote_required"
                              ? "Quote"
                              : money(l.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <Separator className="my-4" />

                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Recurring ({cycle === "annual" ? "per year" : "per month"})
                    </span>
                    <span className="tabular font-semibold">
                      {quote?.quoteRequired ? "Quote required" : money(quote?.cycleTotal ?? 0)}
                    </span>
                  </div>
                  {quote && quote.oneTimeTotal > 0 ? (
                    <div className="mt-1 flex justify-between text-sm">
                      <span className="text-muted-foreground">One-time charges</span>
                      <span className="tabular font-semibold">{money(quote.oneTimeTotal)}</span>
                    </div>
                  ) : null}
                  {cycle === "annual" && quote && !quote.quoteRequired ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Equivalent to {money(quote.monthlyEquivalent)} per month.
                    </p>
                  ) : null}

                  {offer.availableDirectlyWithAura ? (
                    <>
                      <Button className="mt-5 w-full" onClick={purchase}>
                        {quote?.quoteRequired ? "Request a quote" : `Get ${offer.name}`}
                      </Button>
                      <p className="mt-2 text-center text-xs text-muted-foreground">
                        Simulated checkout — no payment is taken and no card details are
                        collected.
                      </p>
                    </>
                  ) : (
                    <div className="mt-5 rounded-lg border border-border bg-muted px-3 py-3 text-center text-xs text-muted-foreground">
                      {offer.availableAsWorkspaceAddon
                        ? "This bundle is sold as an add-on to an existing Aurumi Workspace subscription. Speak to Aurumi to add it to your Workspace."
                        : "This bundle is not currently available for purchase."}
                    </div>
                  )}
                  {offer.availableDirectlyWithAura && offer.availableAsWorkspaceAddon ? (
                    <p className="mt-2 text-center text-xs text-muted-foreground">
                      Also available as an add-on to an existing Aurumi Workspace.
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          )}

          {purchaseIntent ? (
            <Card id="bundle-purchase-result" className="mt-6 border-accent">
              <CardContent className="p-6">
                <div className="flex flex-wrap items-center gap-3">
                  <Layers className="size-5 text-accent" />
                  <p className="font-display text-lg font-semibold">
                    {purchaseIntent.lifecycle === "quote_required"
                      ? "Quote requested (simulated)"
                      : "Simulated order created"}
                  </p>
                  <Badge variant="secondary">
                    {purchaseIntent.lifecycle === "quote_required"
                      ? "DRAFT → QUOTE REQUIRED"
                      : "DRAFT → PENDING PAYMENT"}
                  </Badge>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Summary label="Bundle" value={purchaseIntent.bundleName} />
                  <Summary label="Market" value={purchaseIntent.market} />
                  <Summary
                    label="Billing cycle"
                    value={purchaseIntent.cycle === "annual" ? "Annual" : "Monthly"}
                  />
                  <Summary
                    label="Recurring total"
                    value={
                      purchaseIntent.quote.quoteRequired
                        ? "Quote required"
                        : formatBundleMoney(purchaseIntent.quote.cycleTotal, purchaseIntent.currency)
                    }
                  />
                  <Summary
                    label="Connections"
                    value={`${purchaseIntent.connectorIds.length} included`}
                  />
                  <Summary
                    label="One-time charges"
                    value={formatBundleMoney(purchaseIntent.quote.oneTimeTotal, purchaseIntent.currency)}
                  />
                  <Summary
                    label="Catalogue version"
                    value={`v${purchaseIntent.catalogueVersion}`}
                  />
                  <Summary label="Payment" value="Simulated — none taken" />
                </div>
                {purchaseIntent.quote.quoteRequired ? (
                  <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                    {purchaseIntent.quote.quoteReasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function Included({ text }: { text: string }) {
  return (
    <li className="flex gap-2 text-sm">
      <Check className="mt-0.5 size-4 shrink-0 text-accent" />
      <span>{text}</span>
    </li>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-display text-sm font-semibold">{value}</p>
    </div>
  );
}

function AnswerBlock({ answer }: { answer: DemoAnswer }) {
  const max = answer.chart ? Math.max(...answer.chart.map((c) => c.value)) : 0;
  return (
    <div className="max-w-[95%] rounded-2xl rounded-bl-sm border border-border bg-muted/50 px-4 py-3">
      <p className="font-display text-sm font-semibold">{answer.headline}</p>
      <p className="mt-1 text-sm text-muted-foreground">{answer.detail}</p>

      {answer.metric ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {answer.metric.map((m) => (
            <div key={m.label} className="rounded-lg border border-border bg-card px-3 py-2">
              <p className="text-xs text-muted-foreground">{m.label}</p>
              <p className="mt-0.5 font-display text-sm font-semibold tabular">{m.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      {answer.chart ? (
        <div className="mt-3 flex items-end gap-2 sm:gap-3">
          {answer.chart.map((c) => (
            <div key={c.label} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-accent/80"
                style={{ height: `${Math.round((c.value / max) * 90) + 10}px` }}
              />
              <span className="text-[11px] text-muted-foreground">{c.label}</span>
            </div>
          ))}
        </div>
      ) : null}

      {answer.table ? (
        <div className="mt-3 -mx-1 overflow-x-auto">
          <table className="w-full min-w-[22rem] text-left text-xs">
            <thead>
              <tr className="text-muted-foreground">
                {answer.table.columns.map((c) => (
                  <th key={c} className="px-1 py-1.5 font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {answer.table.rows.map((row) => (
                <tr key={row.join("|")} className="border-t border-border">
                  {row.map((cell, i) => (
                    <td key={i} className={i === 0 ? "px-1 py-1.5" : "px-1 py-1.5 tabular"}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
