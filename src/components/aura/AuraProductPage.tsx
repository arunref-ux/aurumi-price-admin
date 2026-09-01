import { useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Check,
  MessageSquare,
  Plug,
  Send,
  Sparkles,
  TrendingUp,
} from "lucide-react";
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
import { toast } from "sonner";
import type { AuraConnectorConfig } from "@/lib/aura/connectors";
import type { DemoAnswer } from "@/lib/aura/tally-demo";
import {
  AURA_MARKETS,
  buildPurchaseIntent,
  calculateAuraQuote,
  formatOfferMoney,
  getAuraOffer,
  type AuraBillingCycle,
  type AuraMarketId,
} from "@/lib/aura/offer";

interface Turn {
  id: number;
  question: string;
  answer: DemoAnswer;
}

export function AuraProductPage({ connector }: { connector: AuraConnectorConfig }) {
  const demoRef = useRef<HTMLDivElement>(null);
  const pricingRef = useRef<HTMLDivElement>(null);

  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [market, setMarket] = useState<AuraMarketId>("IN");
  const [cycle, setCycle] = useState<AuraBillingCycle>("monthly");
  const [addOnQty, setAddOnQty] = useState<Record<string, number>>({});

  const offer = useMemo(() => getAuraOffer({ connector: connector.id, market }), [connector.id, market]);
  const quote = useMemo(() => calculateAuraQuote(offer, cycle, addOnQty), [offer, cycle, addOnQty]);

  const ask = (question: string) => {
    const q = question.trim();
    if (!q) return;
    setTurns((prev) => [...prev, { id: prev.length + 1, question: q, answer: connector.answer(q) }]);
    setDraft("");
    window.setTimeout(() => {
      demoRef.current?.querySelector("[data-conversation-end]")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 50);
  };

  const scrollTo = (ref: React.RefObject<HTMLDivElement | null>) =>
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const purchase = () => {
    const intent = buildPurchaseIntent(offer, cycle, addOnQty);
    // Simulated purchase flow — no payment provider, no card collection.
    console.info("[simulated purchase intent]", intent);
    toast.success(`Simulated checkout started — Aura + ${offer.connectorName}`, {
      description: `${offer.marketName} · ${cycle === "annual" ? "Annual" : "Monthly"} · ${formatOfferMoney(
        quote.cycleTotal,
        quote.currency,
      )}${cycle === "annual" ? " billed annually" : " per month"}. No payment is taken in this demo.`,
    });
  };

  const setQty = (id: string, qty: number, max: number) =>
    setAddOnQty((prev) => ({ ...prev, [id]: Math.max(0, Math.min(max, qty)) }));

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
            <span className="text-sidebar-foreground/70">Aura + {connector.name}</span>
          </div>

          <div className="mt-10 grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div>
              <p className="font-display text-sm font-semibold uppercase tracking-[0.32em] text-accent">Aura</p>
              <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.05] sm:text-6xl">
                Talk to Your Business
              </h1>
              <p className="mt-5 max-w-xl text-lg text-sidebar-foreground/80 sm:text-xl">
                Your business already has the answers. Just ask.
              </p>
              <p className="mt-5 max-w-xl text-sidebar-foreground/65">{connector.heroSupporting}</p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Button
                  size="lg"
                  className="bg-accent text-accent-foreground hover:bg-accent/90"
                  onClick={() => scrollTo(pricingRef)}
                >
                  Get Aura + {connector.name}
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-sidebar-border bg-transparent text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  onClick={() => scrollTo(demoRef)}
                >
                  Try the Demo
                </Button>
              </div>
            </div>

            {/* Aura + Connector = Talk to your business */}
            <div className="rounded-2xl border border-sidebar-border bg-sidebar-accent/40 p-6 sm:p-8">
              <div className="flex items-center justify-center gap-4 sm:gap-6">
                <Pill label="Aura" accent />
                <span className="font-display text-2xl text-sidebar-foreground/50">+</span>
                <Pill label={connector.name} />
              </div>
              <div className="mt-6 flex items-center justify-center gap-3">
                <span className="font-display text-2xl text-sidebar-foreground/50">=</span>
                <p className="font-display text-lg font-semibold text-accent sm:text-xl">
                  Talk to your business
                </p>
              </div>
              <p className="mt-6 text-center text-sm text-sidebar-foreground/60">
                Keep {connector.name} exactly as it is. Aura simply gives you a conversational way to
                understand what's inside it.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Focused TTYB simulation */}
      <section ref={demoRef} className="scroll-mt-6 border-b border-border bg-muted/40 py-16 sm:py-24">
        <div className="mx-auto max-w-4xl px-5 sm:px-8">
          <div className="text-center">
            <h2 className="font-display text-3xl font-semibold sm:text-4xl">
              See Aura in action with {connector.name}
            </h2>
            <p className="mt-3 text-muted-foreground">Ask questions about your business in plain language.</p>
          </div>

          <Card className="mt-10 overflow-hidden border-border/70 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-4 py-3 sm:px-6">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Sparkles className="h-4 w-4 text-accent" />
                Aura
                <Badge variant="secondary" className="ml-1 font-normal">
                  {connector.name} context
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground">{connector.demoDisclaimer}</span>
            </div>

            <CardContent className="space-y-5 bg-card p-4 sm:p-6">
              <div className="max-h-[26rem] space-y-5 overflow-y-auto pr-1">
                {turns.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">
                    Ask anything about sales, customers, receivables, expenses or GST for{" "}
                    <span className="font-medium text-foreground">{connector.demoCompanyName}</span> — the
                    representative business used in this demo.
                  </div>
                ) : (
                  turns.map((t) => (
                    <div key={t.id} className="space-y-3">
                      <div className="flex justify-end">
                        <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-sm text-primary-foreground">
                          {t.question}
                        </p>
                      </div>
                      <AnswerBlock answer={t.answer} />
                    </div>
                  ))
                )}
                <div data-conversation-end />
              </div>

              <form
                className="flex flex-col gap-2 sm:flex-row"
                onSubmit={(e) => {
                  e.preventDefault();
                  ask(draft);
                }}
              >
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Ask Aura about your business..."
                  aria-label="Ask Aura about your business"
                  className="h-11"
                />
                <Button type="submit" className="h-11 shrink-0" disabled={!draft.trim()}>
                  <Send className="h-4 w-4" />
                  Ask Aura
                </Button>
              </form>

              <div className="flex flex-wrap gap-2">
                {connector.sampleQuestions.map((q) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => ask(q.question)}
                    className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-accent hover:text-foreground"
                  >
                    {q.question}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            This is a simulated experience. Connect your {connector.name} data to get answers about your
            actual business.
          </p>
        </div>
      </section>

      {/* Value proposition */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <h2 className="font-display text-3xl font-semibold sm:text-4xl">Stop searching. Start asking.</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: MessageSquare,
                title: "Ask in plain language",
                body: "Ask questions the way you would ask a person.",
              },
              {
                icon: Sparkles,
                title: "Get business answers",
                body: `Turn your ${connector.name} data into understandable answers.`,
              },
              {
                icon: TrendingUp,
                title: "See what matters",
                body: "Find sales, receivables, expenses and other business information quickly.",
              },
              {
                icon: Check,
                title: "No new ERP to learn",
                body: "Keep using the system you already use.",
              },
            ].map((v) => (
              <Card key={v.title} className="border-border/70">
                <CardContent className="p-6">
                  <v.icon className="h-5 w-5 text-accent" />
                  <h3 className="mt-4 font-display text-base font-semibold">{v.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{v.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-12 rounded-2xl border border-border bg-muted/40 p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <Plug className="mt-1 h-5 w-5 shrink-0 text-accent" />
              <div>
                <h3 className="font-display text-lg font-semibold">
                  Your business runs on {connector.systemNoun}.
                </h3>
                <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                  Aura gives you a conversational way to understand that business context. It doesn't replace{" "}
                  {connector.name} — it sits over it, so nothing about how you work today has to change.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-border bg-muted/40 py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-5 sm:px-8">
          <h2 className="text-center font-display text-3xl font-semibold sm:text-4xl">How it works</h2>
          <ol className="mt-10 grid gap-6 sm:grid-cols-3">
            {[`Connect ${connector.name}`, "Ask Aura", "Get answers"].map((step, i) => (
              <li key={step} className="rounded-xl border border-border bg-card p-6 text-center">
                <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-accent font-display text-sm font-semibold text-accent-foreground">
                  {i + 1}
                </span>
                <p className="mt-4 font-display text-base font-semibold">{step}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Pricing / configuration */}
      <section ref={pricingRef} className="scroll-mt-6 py-16 sm:py-24">
        <div className="mx-auto max-w-5xl px-5 sm:px-8">
          <div className="text-center">
            <h2 className="font-display text-3xl font-semibold sm:text-4xl">
              Aura + {connector.name}
            </h2>
            <p className="mt-3 text-muted-foreground">
              One product. One connected business system. Simple pricing.
            </p>
          </div>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Market</span>
              <Select value={market} onValueChange={(v) => setMarket(v as AuraMarketId)}>
                <SelectTrigger className="w-52" aria-label="Select market">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AURA_MARKETS.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Tabs value={cycle} onValueChange={(v) => setCycle(v as AuraBillingCycle)}>
              <TabsList>
                <TabsTrigger value="monthly">Monthly</TabsTrigger>
                <TabsTrigger value="annual">Annual</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Market selector is a temporary development control; production will detect the market
            automatically.
          </p>

          <div className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <Card className="border-border/70">
              <CardContent className="p-6 sm:p-8">
                <Badge variant="secondary">{offer.marketName}</Badge>
                <div className="mt-4 flex flex-wrap items-baseline gap-2">
                  <span className="font-display text-4xl font-semibold">
                    {formatOfferMoney(
                      cycle === "annual" ? Math.round(offer.annualPrice / 12) : offer.monthlyPrice,
                      offer.currency,
                    )}
                  </span>
                  <span className="text-muted-foreground">/ month</span>
                  {cycle === "annual" ? (
                    <span className="text-sm text-muted-foreground line-through">
                      {formatOfferMoney(offer.monthlyPrice, offer.currency)}
                    </span>
                  ) : null}
                </div>
                {cycle === "annual" ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Billed {formatOfferMoney(offer.annualPrice, offer.currency)} annually · Save{" "}
                    {Math.max(0, Math.round((1 - offer.annualPrice / (offer.monthlyPrice * 12)) * 100))}%
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">Billed monthly. Cancel anytime.</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">{offer.taxNote}</p>

                <Separator className="my-6" />

                <h3 className="font-display text-sm font-semibold uppercase tracking-wide">What's included</h3>
                <ul className="mt-4 space-y-2 text-sm">
                  {[
                    `${offer.included.users} users`,
                    `${offer.included.intelligenceCredits.toLocaleString()} Intelligence Capacity credits / month`,
                    `${offer.included.storageGb} GB storage & business context`,
                    `${offer.included.includedConnectors.join(", ")} connector included`,
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                {offer.additionalConnectorMonthly !== null ? (
                  <p className="mt-4 text-xs text-muted-foreground">
                    Additional connected systems from{" "}
                    {formatOfferMoney(offer.additionalConnectorMonthly, offer.currency)} / month.
                  </p>
                ) : null}

                {offer.addOns.length > 0 ? (
                  <>
                    <Separator className="my-6" />
                    <h3 className="font-display text-sm font-semibold uppercase tracking-wide">
                      Optional add-ons
                    </h3>
                    <div className="mt-4 space-y-3">
                      {offer.addOns.map((a) => {
                        const qty = addOnQty[a.id] ?? 0;
                        return (
                          <div
                            key={a.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium">{a.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {a.description} {formatOfferMoney(a.unitAmount, offer.currency)} per{" "}
                                {a.unitSize.toLocaleString()} {a.unit} / month.
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                aria-label={`Decrease ${a.name}`}
                                onClick={() => setQty(a.id, qty - 1, a.maxQuantity)}
                                disabled={qty === 0}
                              >
                                −
                              </Button>
                              <span className="w-16 text-center text-sm tabular">
                                {(qty * a.unitSize).toLocaleString()}
                              </span>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                aria-label={`Increase ${a.name}`}
                                onClick={() => setQty(a.id, qty + 1, a.maxQuantity)}
                                disabled={qty >= a.maxQuantity}
                              >
                                +
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : null}
              </CardContent>
            </Card>

            <Card className="h-fit border-border/70 lg:sticky lg:top-6">
              <CardContent className="p-6 sm:p-8">
                <h3 className="font-display text-base font-semibold">Your configuration</h3>
                <dl className="mt-4 space-y-2 text-sm">
                  {quote.lines.map((l) => (
                    <div key={l.id} className="flex items-start justify-between gap-3">
                      <dt className="text-muted-foreground">{l.label}</dt>
                      <dd className="tabular">{formatOfferMoney(l.amount, quote.currency)}</dd>
                    </div>
                  ))}
                </dl>
                <Separator className="my-4" />
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-medium">
                    {cycle === "annual" ? "Billed annually" : "Billed monthly"}
                  </span>
                  <span className="font-display text-2xl font-semibold tabular">
                    {formatOfferMoney(quote.cycleTotal, quote.currency)}
                  </span>
                </div>
                {cycle === "annual" ? (
                  <p className="mt-1 text-right text-xs text-muted-foreground">
                    {formatOfferMoney(quote.monthlyEquivalent, quote.currency)} / month equivalent · Save{" "}
                    {quote.annualSavingPct}%
                  </p>
                ) : null}

                <Button className="mt-6 w-full bg-accent text-accent-foreground hover:bg-accent/90" size="lg" onClick={purchase}>
                  Get Aura + {connector.name}
                </Button>
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  Simulated checkout — no payment details are collected.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Upgrade path */}
      <section className="border-t border-border bg-muted/30 py-12">
        <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-4 px-5 sm:flex-row sm:items-center sm:px-8">
          <div>
            <h2 className="font-display text-lg font-semibold">Need more than {connector.name}?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Explore Aurumi for internal business operations, Native Apps and additional connected systems.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/pricing">Explore Aurumi</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}

function Pill({ label, accent }: { label: string; accent?: boolean }) {
  return (
    <span
      className={
        accent
          ? "rounded-xl bg-accent px-5 py-3 font-display text-lg font-semibold text-accent-foreground"
          : "rounded-xl border border-sidebar-border bg-sidebar px-5 py-3 font-display text-lg font-semibold text-sidebar-foreground"
      }
    >
      {label}
    </span>
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
