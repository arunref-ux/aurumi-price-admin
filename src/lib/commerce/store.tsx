import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { seedState } from "./seed";
import { validateCatalogue, type Issue } from "./validation";
import type { Catalogue, CommerceState, TenantSubscription } from "./types";

const STORAGE_KEY = "aurumi.commerce.v2";

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
}

const CommerceContext = createContext<CommerceContextValue | null>(null);

export function CommerceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CommerceState>(() => seedState());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setState(JSON.parse(raw) as CommerceState);
    } catch {
      /* ignore corrupt storage */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore quota */
    }
  }, [state]);

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
    }),
    [state, updateDraft, publish, discardDraft, saveSubscription, updateSubscription, catalogueIssues, reset],
  );

  return <CommerceContext.Provider value={value}>{children}</CommerceContext.Provider>;
}

export function useCommerce() {
  const ctx = useContext(CommerceContext);
  if (!ctx) throw new Error("useCommerce must be used within CommerceProvider");
  return ctx;
}
