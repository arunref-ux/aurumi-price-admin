import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AdminLayout, PageHeader } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
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
import type { AppCategory, AurumiApp, MarketId } from "@/lib/commerce/types";

export const Route = createFileRoute("/apps")({
  head: () => ({
    meta: [
      { title: "Aurumi Apps | Commercial Admin" },
      {
        name: "description",
        content:
          "App catalogue with Standard and Premium classification, categories, eligibility and add-on pricing per market.",
      },
      { property: "og:title", content: "Aurumi Apps | Commercial Admin" },
      { property: "og:description", content: "Standard and Premium Aurumi app catalogue configuration." },
    ],
  }),
  component: AppsPage,
});

const CATEGORIES: AppCategory[] = [
  "Core",
  "Sales",
  "Finance",
  "Stores",
  "Security",
  "IT",
  "Aurumi Internal",
];

function AppsPage() {
  const { draft, updateDraft } = useCommerce();
  const [category, setCategory] = useState<string>("all");
  const [classification, setClassification] = useState<string>("all");
  const [market, setMarket] = useState<MarketId>("US");
  const [query, setQuery] = useState("");

  const apps = draft.apps.filter(
    (a) =>
      (category === "all" || a.category === category) &&
      (classification === "all" || a.classification === classification) &&
      a.name.toLowerCase().includes(query.toLowerCase()),
  );

  const patch = (id: string, p: Partial<AurumiApp>, summary: string) =>
    updateDraft((d) => ({ ...d, apps: d.apps.map((a) => (a.id === id ? { ...a, ...p } : a)) }), summary, "Apps");

  return (
    <AdminLayout>
      <PageHeader
        title="Aurumi Apps"
        description="Standard apps are included with every paid workspace plan. Premium apps are purchasable add-ons that generate an additional entitlement. The public website reads this catalogue rather than a hard-coded app list."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          placeholder="Search apps…"
          className="max-w-56"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={classification} onValueChange={setClassification}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Standard &amp; Premium</SelectItem>
            <SelectItem value="Standard">Standard</SelectItem>
            <SelectItem value="Premium">Premium</SelectItem>
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
          <CardTitle className="text-base">App catalogue ({apps.length})</CardTitle>
          <CardDescription>
            {draft.apps.filter((a) => a.classification === "Standard").length} Standard ·{" "}
            {draft.apps.filter((a) => a.classification === "Premium").length} Premium
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>App</TableHead>
                <TableHead>App ID</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Monthly</TableHead>
                <TableHead>Annual</TableHead>
                <TableHead>Eligible plans</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Public</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apps.map((a) => {
                const rule = draft.prices.find((r) => r.productId === a.id && r.market === market);
                return (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="font-medium">{a.name}</div>
                      <div className="max-w-72 text-xs text-muted-foreground">{a.description}</div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{a.id}</TableCell>
                    <TableCell>{a.category}</TableCell>
                    <TableCell>
                      <Badge variant={a.classification === "Premium" ? "default" : "secondary"}>
                        {a.classification}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular">
                      {a.classification === "Premium" ? formatMoney(rule?.monthly ?? null, rule?.currency ?? "USD") : "Included"}
                    </TableCell>
                    <TableCell className="tabular">
                      {a.classification === "Premium" ? formatMoney(rule?.annual ?? null, rule?.currency ?? "USD") : "Included"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {a.eligiblePlans.length === draft.plans.length
                        ? "All plans"
                        : a.eligiblePlans
                            .map((id) => draft.plans.find((p) => p.id === id)?.name ?? id)
                            .join(", ")}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={a.active}
                        onCheckedChange={(v) => patch(a.id, { active: v }, `${a.name} active = ${v}`)}
                      />
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={a.publicVisible}
                        onCheckedChange={(v) => patch(a.id, { publicVisible: v }, `${a.name} public = ${v}`)}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="mt-4 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <Button key={c} variant="outline" size="sm" onClick={() => setCategory(c)}>
            {c} ({draft.apps.filter((a) => a.category === c).length})
          </Button>
        ))}
      </div>
    </AdminLayout>
  );
}
