import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  AURA_OFFERS,
  BUNDLES,
  CONNECTORS as SEED_CONNECTORS,
  PRICES as SEED_PRICES,
  seedState,
} from "./seed";
import { auraOfferComponents } from "./aura";
import { bundleComponents } from "./bundles";
import { validateCatalogue, type Issue } from "./validation";
import type { Catalogue, CommerceState, TenantSubscription } from "./types";

const STORAGE_KEY = "aurumi.commerce.v2";
const LEGACY_STORAGE_KEY = "aurumi.commerce.v1";

export type MigrationState =
  | { kind: "none" }
  | { kind: "offered" }
  | { kind: "migrated" }
  | { kind: "dismissed" };

/**
 * Prototype-only migration: v1 state predates catalogue versioning, derived
 * entitlements and the extended add-on fields. We keep whatever is structurally
 * compatible (tenants, subscriptions, change log) and rebuild the catalogue
 * from the current seed so the data model stays coherent.
 */
function migrateV1(raw: string, base: CommerceState): CommerceState | null {
  try {
    const old = JSON.parse(raw) as Partial<CommerceState>;
    if (!old || typeof old !== "object") return null;
    return {
      ...base,
      tenants: Array.isArray(old.tenants) && old.tenants.length ? old.tenants : base.tenants,
      subscriptions: Array.isArray(old.subscriptions) ? old.subscriptions : [],
      changeLog: Array.isArray(old.changeLog) ? old.changeLog : [],
      lastPublishedAt: old.lastPublishedAt ?? null,
    };
  } catch {
    return null;
  }
}


/**
 * Forward-compatibility for prototype storage written before standalone Aura
 * offers existed: fill in the new commercial fields without discarding data.
 */
function normaliseCatalogue(c: Catalogue, scope: "draft" | "published"): Catalogue {
  const offers = Array.isArray(c.auraOffers) ? c.auraOffers : AURA_OFFERS;
  // Seeded bundles may only enter the DRAFT catalogue. Normalisation must never
  // make a new commercial product customer-facing without an explicit publish.
  const storedBundles = Array.isArray(c.bundles) ? c.bundles : [];
  const bundles =
    storedBundles.length || scope === "published" ? storedBundles : BUNDLES;
  const connectors = Array.isArray(c.connectors) ? c.connectors : [];
  // Connectors and prices a bundle references must exist, even in catalogues
  // stored before bundles were introduced.
  const missingConnectors = SEED_CONNECTORS.filter(
    (sc) => !connectors.some((cc) => cc.id === sc.id),
  );
  const prices = Array.isArray(c.prices) ? c.prices : [];
  const missingPrices = SEED_PRICES.filter(
    (sp) =>
      !prices.some((p) => p.productId === sp.productId && p.market === sp.market) &&
      ((scope === "draft" && sp.productId.startsWith("bundle.")) ||
        missingConnectors.some((mc) => sp.productId.startsWith(mc.id))),
  );
  return {
    ...c,
    // Offers stored before explicit commercial components get the implicit
    // single Aura recurring charge, so nothing loses its commercial meaning.
    auraOffers: offers.map((o) => ({ ...o, components: auraOfferComponents(o) })),
    bundles: bundles.map((b) => ({ ...b, components: bundleComponents(b) })),
    connectors: [...connectors, ...missingConnectors].map((conn) => ({
      ...conn,
      standaloneAuraOffering: Boolean(conn.standaloneAuraOffering),
    })),
    prices: [...prices, ...missingPrices],
  };
}


function normaliseState(s: CommerceState): CommerceState {
  return { ...s, draft: normaliseCatalogue(s.draft), published: normaliseCatalogue(s.published) };
}

interface CommerceContextValue {
  state: CommerceState;
  /** Working (draft) catalogue — what administrators edit. */
  draft: Catalogue;
  /** Published catalogue — what the public pricing page consumes. */
  published: Catalogue;
  updateDraft: (fn: (draft: Catalogue) => Catalogue, summary: string, entity: string) => void;
  publish: () => void;
  discardDraft: () => void;
  hasUnpublishedChanges: boolean;
  saveSubscription: (sub: TenantSubscription) => void;
  updateSubscription: (id: string, fn: (sub: TenantSubscription) => TenantSubscription) => void;
  /** Catalogue consistency problems in the draft. Errors block publishing. */
  catalogueIssues: Issue[];
  canPublish: boolean;
  reset: () => void;
  /** Prototype storage migration (v1 → v2). */
  migration: MigrationState;
  migrateLegacyData: () => void;
  startFresh: () => void;
}

const CommerceContext = createContext<CommerceContextValue | null>(null);

export function CommerceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CommerceState>(() => seedState());
  const [hydrated, setHydrated] = useState(false);
  const [migration, setMigration] = useState<MigrationState>({ kind: "none" });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setState(normaliseState(JSON.parse(raw) as CommerceState));
        setHydrated(true);
        return;
      }
      if (localStorage.getItem(LEGACY_STORAGE_KEY)) {
        // Do not persist v2 yet — the user must choose migrate or start fresh.
        setMigration({ kind: "offered" });
        return;
      }
    } catch {
      /* ignore corrupt storage */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore quota */
    }
  }, [state, hydrated]);

  const migrateLegacyData = useCallback(() => {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    const migrated = raw ? migrateV1(raw, seedState()) : null;
    if (migrated) {
      setState({
        ...migrated,
        changeLog: [
          {
            id: crypto.randomUUID(),
            at: new Date().toISOString(),
            entity: "Configuration",
            summary: "Prototype data migrated from storage format v1 to v2",
          },
          ...migrated.changeLog,
        ].slice(0, 50),
      });
      setMigration({ kind: "migrated" });
    } else {
      setMigration({ kind: "dismissed" });
    }
    setHydrated(true);
  }, []);

  const startFresh = useCallback(() => {
    setState(seedState());
    setMigration({ kind: "dismissed" });
    setHydrated(true);
  }, []);



  const updateDraft = useCallback(
    (fn: (draft: Catalogue) => Catalogue, summary: string, entity: string) => {
      setState((s) => ({
        ...s,
        draft: fn(s.draft),
        changeLog: [
          { id: crypto.randomUUID(), at: new Date().toISOString(), entity, summary },
          ...s.changeLog,
        ].slice(0, 50),
      }));
    },
    [],
  );

  const publish = useCallback(() => {
    setState((s) => ({
      ...s,
      draft: { ...s.draft, version: s.draft.version + 1 },
      published: { ...(JSON.parse(JSON.stringify(s.draft)) as Catalogue), version: s.draft.version + 1 },
      lastPublishedAt: new Date().toISOString(),
      changeLog: [
        {
          id: crypto.randomUUID(),
          at: new Date().toISOString(),
          entity: "Configuration",
          summary: `Draft published as catalogue version ${s.draft.version + 1}`,
        },
        ...s.changeLog,
      ].slice(0, 50),
    }));
  }, []);

  const discardDraft = useCallback(() => {
    setState((s) => ({ ...s, draft: JSON.parse(JSON.stringify(s.published)) as Catalogue }));
  }, []);

  const saveSubscription = useCallback((sub: TenantSubscription) => {
    setState((s) => ({
      ...s,
      subscriptions: [sub, ...s.subscriptions.filter((x) => x.id !== sub.id)],
    }));
  }, []);

  const updateSubscription = useCallback(
    (id: string, fn: (sub: TenantSubscription) => TenantSubscription) => {
      setState((s) => ({
        ...s,
        subscriptions: s.subscriptions.map((x) => (x.id === id ? fn(x) : x)),
      }));
    },
    [],
  );

  const reset = useCallback(() => setState(seedState()), []);

  const catalogueIssues = useMemo(() => validateCatalogue(state.draft), [state.draft]);

  const value = useMemo<CommerceContextValue>(
    () => ({
      state,
      draft: state.draft,
      published: state.published,
      updateDraft,
      publish,
      discardDraft,
      hasUnpublishedChanges: JSON.stringify(state.draft) !== JSON.stringify(state.published),
      saveSubscription,
      updateSubscription,
      catalogueIssues,
      canPublish: !catalogueIssues.some((i) => i.severity === "error"),
      reset,
      migration,
      migrateLegacyData,
      startFresh,
    }),
    [
      state,
      updateDraft,
      publish,
      discardDraft,
      saveSubscription,
      updateSubscription,
      catalogueIssues,
      reset,
      migration,
      migrateLegacyData,
      startFresh,
    ],
  );


  return <CommerceContext.Provider value={value}>{children}</CommerceContext.Provider>;
}

export function useCommerce() {
  const ctx = useContext(CommerceContext);
  if (!ctx) throw new Error("useCommerce must be used within CommerceProvider");
  return ctx;
}
