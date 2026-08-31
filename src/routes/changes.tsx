import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout, PageHeader } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { toast } from "sonner";

export const Route = createFileRoute("/changes")({
  head: () => ({
    meta: [
      { title: "Review Changes | Aurumi Commercial Admin" },
      {
        name: "description",
        content: "Compare draft commercial configuration against the published catalogue before publishing.",
      },
      { property: "og:title", content: "Review Changes | Aurumi Commercial Admin" },
      { property: "og:description", content: "Draft versus published diff for the Aurumi commercial catalogue." },
    ],
  }),
  component: ChangesPage,
});

function ChangesPage() {
  const { draft, published, state, publish, discardDraft, hasUnpublishedChanges, catalogueIssues, canPublish } =
    useCommerce();

  const priceDiffs = draft.prices
    .map((d) => {
      const p = published.prices.find((x) => x.productId === d.productId && x.market === d.market);
      if (!p) return { ...d, wasMonthly: null as number | null, wasAnnual: null as number | null, isNew: true };
      if (p.monthly === d.monthly && p.annual === d.annual) return null;
      return { ...d, wasMonthly: p.monthly, wasAnnual: p.annual, isNew: false };
    })
    .filter(Boolean) as Array<{
    productId: string;
    market: string;
    currency: string;
    monthly: number | null;
    annual: number | null;
    wasMonthly: number | null;
    wasAnnual: number | null;
    isNew: boolean;
  }>;

  const structuralDiffs: string[] = [];
  const compare = <T extends { id: string; name?: string }>(a: T[], b: T[], label: string) => {
    for (const item of a) {
      const other = b.find((x) => x.id === item.id);
      if (!other) structuralDiffs.push(`${label} added: ${item.name ?? item.id}`);
      else if (JSON.stringify(item) !== JSON.stringify(other))
        structuralDiffs.push(`${label} modified: ${item.name ?? item.id}`);
    }
    for (const item of b) if (!a.find((x) => x.id === item.id)) structuralDiffs.push(`${label} removed: ${item.name ?? item.id}`);
  };
  compare(draft.plans, published.plans, "Plan");
  compare(draft.apps, published.apps, "App");
  compare(draft.connectors, published.connectors, "Connector");
  compare(draft.addOns, published.addOns, "Add-on");
  compare(draft.markets, published.markets, "Market");
  compare(draft.promotions, published.promotions, "Promotion");
  if (JSON.stringify(draft.rules) !== JSON.stringify(published.rules)) structuralDiffs.push("Subscription rules modified");
  if (JSON.stringify(draft.settings) !== JSON.stringify(published.settings)) structuralDiffs.push("Settings modified");

  return (
    <AdminLayout>
      <PageHeader
        title="Review Changes"
        description={`Draft v${draft.version} vs published v${published.version}. The subscription builder and pricing preview keep reading the published catalogue until you publish.`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" disabled={!hasUnpublishedChanges} onClick={() => discardDraft()}>
              Discard draft
            </Button>
            <Button
              disabled={!hasUnpublishedChanges || !canPublish}
              onClick={() => {
                publish();
                toast.success(`Configuration published as catalogue v${draft.version + 1}`);
              }}
            >
              Publish
            </Button>
          </div>
        }
      />

      {catalogueIssues.length ? (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base">Catalogue validation</CardTitle>
            <CardDescription>
              {canPublish
                ? "No blocking problems — review the notes below."
                : "Resolve every blocking problem before this draft can be published."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {catalogueIssues.map((i) => (
              <div
                key={i.id}
                className={`rounded-md border px-3 py-2 ${i.severity === "error" ? "border-destructive/50 bg-destructive/5" : ""}`}
              >
                <div className="flex items-center gap-2">
                  <Badge variant={i.severity === "error" ? "destructive" : "outline"}>
                    {i.severity === "error" ? "Blocking" : "Note"}
                  </Badge>
                  <span className="font-medium">{i.message}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{i.reason}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {!hasUnpublishedChanges ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Draft matches the published catalogue. Nothing to publish.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pricing changes ({priceDiffs.length})</CardTitle>
              <CardDescription>Product × market rows that differ from published.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Market</TableHead>
                    <TableHead>Monthly</TableHead>
                    <TableHead>Annual</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {priceDiffs.map((d) => (
                    <TableRow key={`${d.productId}-${d.market}`}>
                      <TableCell className="font-mono text-xs">{d.productId}</TableCell>
                      <TableCell>{d.market}</TableCell>
                      <TableCell className="tabular">
                        <span className="text-muted-foreground line-through">
                          {formatMoney(d.wasMonthly, d.currency)}
                        </span>{" "}
                        {formatMoney(d.monthly, d.currency)}
                      </TableCell>
                      <TableCell className="tabular">
                        <span className="text-muted-foreground line-through">
                          {formatMoney(d.wasAnnual, d.currency)}
                        </span>{" "}
                        {formatMoney(d.annual, d.currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {priceDiffs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-muted-foreground">
                        No pricing changes.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Catalogue changes ({structuralDiffs.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              {structuralDiffs.length === 0 ? (
                <p className="text-muted-foreground">No catalogue changes.</p>
              ) : (
                structuralDiffs.map((d) => (
                  <div key={d} className="rounded-md border px-3 py-1.5">
                    {d}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Change log</CardTitle>
          <CardDescription>
            {state.lastPublishedAt
              ? `Last published ${new Date(state.lastPublishedAt).toLocaleString()}`
              : "Never published"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm">
          {state.changeLog.length === 0 ? (
            <p className="text-muted-foreground">No activity yet.</p>
          ) : (
            state.changeLog.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-md border px-3 py-1.5">
                <span>{c.summary}</span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">{c.entity}</Badge>
                  {new Date(c.at).toLocaleString()}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
