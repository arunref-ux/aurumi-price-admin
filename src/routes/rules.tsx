import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout, PageHeader } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCommerce } from "@/lib/commerce/store";
import type { SubscriptionRules } from "@/lib/commerce/types";

export const Route = createFileRoute("/rules")({
  head: () => ({
    meta: [
      { title: "Subscription Rules | Aurumi Commercial Admin" },
      {
        name: "description",
        content:
          "Rules for upgrades, downgrades, proration, effective dates, cancellation and reactivation of tenant subscriptions.",
      },
      { property: "og:title", content: "Subscription Rules | Aurumi Commercial Admin" },
      { property: "og:description", content: "Change-management rules for Aurumi tenant subscriptions." },
    ],
  }),
  component: RulesPage,
});

const CHANGE_TYPES = [
  "Upgrade plan",
  "Downgrade plan",
  "Add users",
  "Remove users",
  "Add Premium App",
  "Remove Premium App",
  "Add Connector",
  "Remove Connector",
  "Add storage",
  "Add Intelligence Capacity",
  "Add data transfer",
  "Cancel subscription",
  "Reactivate subscription",
];

function RulesPage() {
  const { draft, updateDraft } = useCommerce();
  const r = draft.rules;
  const patch = (p: Partial<SubscriptionRules>, summary: string) =>
    updateDraft((d) => ({ ...d, rules: { ...d.rules, ...p } }), summary, "Subscription rules");

  return (
    <AdminLayout>
      <PageHeader
        title="Subscription Rules"
        description="Billing mechanics stay deliberately simple in this version, but every subscription change records timing, proration and effective date so richer billing can be layered on later."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Change management</CardTitle>
            <CardDescription>Applies to all tenant subscription changes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Toggle
              label="Allow upgrades"
              checked={r.allowUpgrade}
              onChange={(v) => patch({ allowUpgrade: v }, "Upgrades allowed")}
            />
            <Toggle
              label="Allow downgrades"
              checked={r.allowDowngrade}
              onChange={(v) => patch({ allowDowngrade: v }, "Downgrades allowed")}
            />
            <Timing
              label="Upgrade effective"
              value={r.upgradeTiming}
              onChange={(v) => patch({ upgradeTiming: v }, "Upgrade timing")}
            />
            <Timing
              label="Downgrade effective"
              value={r.downgradeTiming}
              onChange={(v) => patch({ downgradeTiming: v }, "Downgrade timing")}
            />
            <Toggle
              label="Prorate upgrades"
              checked={r.prorateUpgrades}
              onChange={(v) => patch({ prorateUpgrades: v }, "Prorate upgrades")}
            />
            <Toggle
              label="Prorate downgrades"
              checked={r.prorateDowngrades}
              onChange={(v) => patch({ prorateDowngrades: v }, "Prorate downgrades")}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lifecycle</CardTitle>
            <CardDescription>Cancellation, reactivation and trial handling.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Cancellation takes effect</Label>
              <Select
                value={r.cancellationTiming}
                onValueChange={(v) =>
                  patch({ cancellationTiming: v as SubscriptionRules["cancellationTiming"] }, "Cancellation timing")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="immediate">Immediately</SelectItem>
                  <SelectItem value="end_of_term">At end of current term</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Toggle
              label="Allow reactivation"
              checked={r.allowReactivation}
              onChange={(v) => patch({ allowReactivation: v }, "Reactivation allowed")}
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Trial days</Label>
                <Input
                  type="number"
                  className="tabular"
                  value={r.trialDays}
                  onChange={(e) => patch({ trialDays: Number(e.target.value) }, "Trial days")}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Grace period days</Label>
                <Input
                  type="number"
                  className="tabular"
                  value={r.gracePeriodDays}
                  onChange={(e) => patch({ gracePeriodDays: Number(e.target.value) }, "Grace period")}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Supported subscription changes</CardTitle>
            <CardDescription>
              Each recorded change carries: timing (immediate / next billing cycle), proration flag and effective date.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {CHANGE_TYPES.map((c) => (
              <span key={c} className="rounded-md border px-3 py-1.5 text-sm">
                {c}
              </span>
            ))}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border px-3 py-2">
      <Label className="text-sm">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function Timing({
  label,
  value,
  onChange,
}: {
  label: string;
  value: "immediate" | "next_cycle";
  onChange: (v: "immediate" | "next_cycle") => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={(v) => onChange(v as "immediate" | "next_cycle")}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="immediate">Immediately</SelectItem>
          <SelectItem value="next_cycle">Next billing cycle</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
