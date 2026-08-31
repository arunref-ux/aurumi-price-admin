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
import type { Catalogue, CommerceState, TenantSubscription } from "./types";

const STORAGE_KEY = "aurumi.commerce.v1";

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
      published: JSON.parse(JSON.stringify(s.draft)) as Catalogue,
      lastPublishedAt: new Date().toISOString(),
      changeLog: [
        {
          id: crypto.randomUUID(),
          at: new Date().toISOString(),
          entity: "Configuration",
          summary: "Draft published to public catalogue",
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

  const reset = useCallback(() => setState(seedState()), []);

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
      reset,
    }),
    [state, updateDraft, publish, discardDraft, saveSubscription, reset],
  );

  return <CommerceContext.Provider value={value}>{children}</CommerceContext.Provider>;
}

export function useCommerce() {
  const ctx = useContext(CommerceContext);
  if (!ctx) throw new Error("useCommerce must be used within CommerceProvider");
  return ctx;
}
