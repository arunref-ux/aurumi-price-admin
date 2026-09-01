import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  Blocks,
  Boxes,
  Building2,
  ExternalLink,
  Gauge,
  Globe2,
  LayoutDashboard,
  Layers,
  Megaphone,
  Percent,
  Plug,
  Settings2,
  ShieldCheck,
  Sparkles,
  Tags,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useCommerce } from "@/lib/commerce/store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const CONFIG_NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/plans", label: "Plans", icon: Layers },
  { to: "/apps", label: "Aurumi Apps", icon: Blocks },
  { to: "/connectors", label: "Connectors", icon: Plug },
  { to: "/addons", label: "Capacity & Add-ons", icon: Boxes },
  { to: "/markets", label: "Markets & Pricing", icon: Globe2 },
  { to: "/promotions", label: "Promotions", icon: Percent },
  { to: "/rules", label: "Subscription Rules", icon: ShieldCheck },
  { to: "/entitlements", label: "Entitlements", icon: Gauge },
  { to: "/settings", label: "Settings", icon: Settings2 },
] as const;

const TENANT_NAV = [
  { to: "/tenants", label: "Tenant Subscriptions", icon: Building2 },
  { to: "/subscriptions/new", label: "Subscription Builder", icon: Sparkles },
  { to: "/pricing", label: "Public Pricing Preview", icon: Tags },
] as const;

const DEMO_NAV = [
  { to: "/aura/tally", label: "Aura + Tally (Product Demo)", icon: Megaphone, external: true },
] as const;

export function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const {
    hasUnpublishedChanges,
    publish,
    discardDraft,
    state,
    canPublish,
    catalogueIssues,
    migration,
    migrateLegacyData,
    startFresh,
  } = useCommerce();
  const blocking = catalogueIssues.filter((i) => i.severity === "error").length;

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <div className="border-b border-sidebar-border px-5 py-5">
          <div className="font-display text-sm font-semibold tracking-[0.2em] text-sidebar-primary">
            AURUMI
          </div>
          <div className="mt-1 text-xs text-sidebar-foreground/70">
            Commercial &amp; Subscription Admin
          </div>
        </div>
        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
          <NavGroup title="Commercial configuration" items={CONFIG_NAV} pathname={pathname} />
          <NavGroup title="Tenant subscription" items={TENANT_NAV} pathname={pathname} />
        </nav>
        <div className="border-t border-sidebar-border px-4 py-4 text-xs text-sidebar-foreground/70">
          <div>Published catalogue v{state.published.version}</div>
          <div>
            {state.lastPublishedAt
              ? `Published ${new Date(state.lastPublishedAt).toLocaleString()}`
              : "Never published"}
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b bg-card/90 px-6 py-3 backdrop-blur">
          <div className="flex items-center gap-3">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="lg:hidden" aria-label="Open navigation">
                  <Menu className="size-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 bg-sidebar p-0 text-sidebar-foreground">
                <SheetTitle className="border-b border-sidebar-border px-5 py-4 font-display text-sm tracking-[0.2em] text-sidebar-primary">
                  AURUMI PRICE ADMIN
                </SheetTitle>
                <nav className="space-y-6 overflow-y-auto px-3 py-5">
                  <NavGroup title="Commercial configuration" items={CONFIG_NAV} pathname={pathname} />
                  <NavGroup title="Tenant subscription" items={TENANT_NAV} pathname={pathname} />
                </nav>
              </SheetContent>
            </Sheet>
            <Badge variant={hasUnpublishedChanges ? "default" : "secondary"}>
              {hasUnpublishedChanges ? "Draft — unpublished changes" : "Published"}
            </Badge>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {blocking
                ? `${blocking} catalogue issue(s) block publishing.`
                : "Catalogue changes stay in draft until published."}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={!hasUnpublishedChanges}
              onClick={() => {
                discardDraft();
                toast.success("Draft reverted to published configuration");
              }}
            >
              Discard draft
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/changes">Review changes</Link>
            </Button>
            <Button
              size="sm"
              disabled={!hasUnpublishedChanges || !canPublish}
              title={canPublish ? undefined : "Resolve catalogue issues before publishing"}
              onClick={() => {
                publish();
                toast.success("Configuration published");
              }}
            >
              Publish
            </Button>
          </div>
        </header>
        {migration.kind === "offered" ? (
          <div className="border-b bg-secondary px-6 py-3" role="alert">
            <div className="text-sm font-medium">Existing prototype data found in the previous storage format</div>
            <p className="mt-1 text-xs text-muted-foreground">
              The simulated storage format changed. Your tenants, subscriptions and activity log can be carried over;
              the catalogue is rebuilt from the current model. Nothing is discarded until you choose.
            </p>
            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  migrateLegacyData();
                  toast.success("Existing prototype data migrated");
                }}
              >
                Migrate existing data
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  startFresh();
                  toast.success("Started from a fresh seeded catalogue");
                }}
              >
                Start fresh
              </Button>
            </div>
          </div>
        ) : null}
        <main className="min-w-0 flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}

function NavGroup({
  title,
  items,
  pathname,
}: {
  title: string;
  items: readonly { to: string; label: string; icon: typeof Layers }[];
  pathname: string;
}) {
  return (
    <div>
      <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/50">
        {title}
      </div>
      <ul className="space-y-0.5">
        {items.map((item) => {
          const active = pathname === item.to;
          const Icon = item.icon;
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-semibold">{title}</h1>
        {description ? <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}
