import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout, PageHeader } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCommerce } from "@/lib/commerce/store";
import { ENTITLEMENT_LABELS, planEntitlements } from "@/lib/commerce/entitlements";


export const Route = createFileRoute("/entitlements")({
  head: () => ({
    meta: [
      { title: "Entitlements | Aurumi Commercial Admin" },
      {
        name: "description",
        content:
          "The entitlement model: what each plan, add-on, premium app and connector allows a tenant to use, separate from what they pay.",
      },
      { property: "og:title", content: "Entitlements | Aurumi Commercial Admin" },
      { property: "og:description", content: "Plan and add-on entitlement mapping for Aurumi tenants." },
    ],
  }),
  component: EntitlementsPage,
});

function EntitlementsPage() {
  const { draft } = useCommerce();

  return (
    <AdminLayout>
      <PageHeader
        title="Entitlements"
        description="A price tells us what a tenant pays. An entitlement tells Aurumi what a tenant is allowed to use. Tenant entitlements are never the same as user access — a tenant admin still decides which users see which apps."
      />

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Model</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-md bg-secondary p-4 text-xs leading-relaxed">
{`COMMERCIAL CATALOGUE
   ↓
PRICING RULES
   ↓
TENANT SUBSCRIPTION
   ↓
TENANT ENTITLEMENTS
   ↓
USER / APP / ROLE ACCESS   (handled by Tenant Administration)`}
          </pre>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Plan → Entitlements</CardTitle>
          <CardDescription>Generated when a tenant subscribes to a plan.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entitlement</TableHead>
                {draft.plans.map((p) => (
                  <TableHead key={p.id}>{p.name}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.keys(ENTITLEMENT_LABELS).map((key) => (
                <TableRow key={key}>
                  <TableCell className="font-medium">{ENTITLEMENT_LABELS[key]}</TableCell>
                  {draft.plans.map((p) => {
                    const e = planEntitlements(p).find((x) => x.key === key);
                    return (
                      <TableCell key={p.id} className="tabular text-sm">
                        {!e ? (
                          <span className="text-muted-foreground">—</span>
                        ) : e.value !== undefined ? (
                          `${e.value.toLocaleString()} ${e.unit ?? ""}`
                        ) : (
                          e.label
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add-on → Additional entitlements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {draft.addOns.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                <span>{a.name}</span>
                <span className="tabular text-muted-foreground">
                  +{a.unitSize.toLocaleString()} {a.entitlement.unit} per unit (increments of {a.quantityStep})
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Premium App → Additional entitlement</CardTitle>
            <CardDescription>Each purchase grants access to that app at tenant level.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {draft.apps
              .filter((a) => a.classification === "Premium")
              .map((a) => (
                <Badge key={a.id} variant="outline">
                  {a.name}
                </Badge>
              ))}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
