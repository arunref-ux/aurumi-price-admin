import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AdminLayout, PageHeader } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import type { Connector, MarketId } from "@/lib/commerce/types";

export const Route = createFileRoute("/connectors")({
  head: () => ({
    meta: [
      { title: "Connectors | Aurumi Commercial Admin" },
      {
        name: "description",
        content:
          "Standard, Additional and Custom connector catalogue with recurring, one-time and quoted pricing plus capacity impact.",
      },
      { property: "og:title", content: "Connectors | Aurumi Commercial Admin" },
      { property: "og:description", content: "Connector catalogue and connector economics configuration." },
    ],
  }),
  component: ConnectorsPage,
});

function ConnectorsPage() {
  const { draft, updateDraft } = useCommerce();
  const [market, setMarket] = useState<MarketId>("US");
  const [classification, setClassification] = useState("all");

  const rows = draft.connectors.filter(
    (c) => classification === "all" || c.classification === classification,
  );

  const patch = (id: string, p: Partial<Connector>, summary: string) =>
    updateDraft(
      (d) => ({ ...d, connectors: d.connectors.map((c) => (c.id === id ? { ...c, ...p } : c)) }),
      summary,
      "Connectors",
    );

  return (
    <AdminLayout>
      <PageHeader
        title="Connectors"
        description="Standard Connectors are included within plan limits. Additional and Custom Connectors may carry a recurring fee, a one-time implementation fee, both, or a bespoke quote — connector economics are not assumed to be identical."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Select value={classification} onValueChange={setClassification}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All connectors</SelectItem>
            <SelectItem value="Standard">Standard Connectors</SelectItem>
            <SelectItem value="Additional">Additional Connectors</SelectItem>
            <SelectItem value="Custom">Custom Connectors</SelectItem>
          </SelectContent>
        </Select>
        <Select value={market} onValueChange={(v) => setMarket(v as MarketId)}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {draft.markets.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                Prices in {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connector catalogue ({rows.length})</CardTitle>
          <CardDescription>
            Recurring charges renew with the subscription; implementation fees are one-time.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Connector</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Recurring</TableHead>
                <TableHead>One-time setup</TableHead>
                <TableHead>Setup</TableHead>
                <TableHead>Impact (S / T / AI)</TableHead>
                <TableHead>Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => {
                const rec = draft.prices.find((r) => r.productId === c.id && r.market === market);
                const setup = draft.prices.find((r) => r.productId === `${c.id}:setup` && r.market === market);
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="font-medium">{c.name}</div>
                      <div className="max-w-72 text-xs text-muted-foreground">{c.description}</div>
                    </TableCell>
                    <TableCell>{c.category}</TableCell>
                    <TableCell>
                      <Badge variant={c.classification === "Standard" ? "secondary" : "default"}>
                        {c.classification}
                      </Badge>
                    </TableCell>
                    <TableCell>{c.status}</TableCell>
                    <TableCell className="tabular">
                      {c.quoteOnly
                        ? "Quoted"
                        : c.hasRecurringPrice
                          ? `${formatMoney(rec?.monthly ?? null, rec?.currency ?? "USD")}/mo`
                          : "Included in plan"}
                    </TableCell>
                    <TableCell className="tabular">
                      {c.quoteOnly
                        ? "Quoted"
                        : c.hasOneTimePrice
                          ? formatMoney(setup?.monthly ?? null, setup?.currency ?? "USD")
                          : "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {c.setupMode}
                      {c.professionalServicesRequired ? (
                        <div className="text-muted-foreground">Professional services required</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.storageImpact} / {c.transferImpact} / {c.intelligenceImpact}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={c.active}
                        onCheckedChange={(v) => patch(c.id, { active: v }, `${c.name} active = ${v}`)}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
