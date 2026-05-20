"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  CWS_BY_IDEA,
  CwsItem,
  IdeaPage,
  MY_IDEAS,
  PARSED_IDEAS,
  ParsedIdea,
  Status,
} from "./data";

interface Store {
  // auth
  authed: boolean;
  signIn: () => void;
  signOut: () => void;

  // data
  ideas: ParsedIdea[];
  ideasById: Record<string, ParsedIdea>;
  pages: IdeaPage[];
  getPage: (id: string) => IdeaPage | undefined;

  createPage: (ideaIds: string[], title?: string) => string;
  updatePage: (page: IdeaPage) => void;
  deletePage: (id: string) => void;
  addIdeasToPage: (pageId: string, ideaIds: string[]) => void;
  removeIdeaFromPage: (pageId: string, ideaId: string) => void;

  // chrome web store items, keyed by page id
  getCws: (pageId: string) => CwsItem[];
  cwsCount: (page: IdeaPage) => number;
  addCws: (pageId: string, item: Omit<CwsItem, "id">) => void;
  updateCws: (pageId: string, cwsId: string, patch: Partial<CwsItem>) => void;
  removeCws: (pageId: string, cwsId: string) => void;
}

const StoreContext = createContext<Store | null>(null);

function clonedCws(): Record<string, CwsItem[]> {
  // deep-ish clone so in-session edits never mutate the source data module
  const out: Record<string, CwsItem[]> = {};
  for (const [k, v] of Object.entries(CWS_BY_IDEA)) {
    out[k] = v.map((c) => ({ ...c, sources: [...c.sources] }));
  }
  return out;
}

const AUTH_KEY = "if_authed";

// Auth is backed by sessionStorage and exposed through useSyncExternalStore so
// it reads correctly on the server (false) and on the client without an effect.
const authStore = {
  listeners: new Set<() => void>(),
  subscribe(cb: () => void) {
    authStore.listeners.add(cb);
    return () => authStore.listeners.delete(cb);
  },
  getSnapshot() {
    return typeof window !== "undefined" && sessionStorage.getItem(AUTH_KEY) === "1";
  },
  getServerSnapshot() {
    return false;
  },
  set(v: boolean) {
    if (v) sessionStorage.setItem(AUTH_KEY, "1");
    else sessionStorage.removeItem(AUTH_KEY);
    authStore.listeners.forEach((l) => l());
  },
};

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const authed = useSyncExternalStore(
    authStore.subscribe,
    authStore.getSnapshot,
    authStore.getServerSnapshot,
  );

  const [ideas] = useState<ParsedIdea[]>(PARSED_IDEAS);
  const [pages, setPages] = useState<IdeaPage[]>(MY_IDEAS);
  const [cws, setCws] = useState<Record<string, CwsItem[]>>(clonedCws);

  const ideasById = useMemo(() => {
    const m: Record<string, ParsedIdea> = {};
    ideas.forEach((i) => {
      m[i.id] = i;
    });
    return m;
  }, [ideas]);

  const signIn = useCallback(() => authStore.set(true), []);
  const signOut = useCallback(() => authStore.set(false), []);

  const getPage = useCallback(
    (id: string) => pages.find((p) => p.id === id),
    [pages],
  );

  const createPage = useCallback((ideaIds: string[], title = "") => {
    const id = "i_" + Math.random().toString(36).slice(2, 6);
    const newPage: IdeaPage = {
      id,
      title,
      status: "new",
      createdAt: new Date().toISOString().slice(0, 10),
      notes: "",
      ideas: ideaIds ?? [],
      cwsCount: 0,
    };
    setPages((p) => [newPage, ...p]);
    return id;
  }, []);

  const updatePage = useCallback((updated: IdeaPage) => {
    setPages((ps) => ps.map((p) => (p.id === updated.id ? updated : p)));
  }, []);

  const deletePage = useCallback((id: string) => {
    setPages((ps) => ps.filter((p) => p.id !== id));
  }, []);

  const addIdeasToPage = useCallback((pageId: string, ideaIds: string[]) => {
    setPages((ps) =>
      ps.map((p) =>
        p.id === pageId
          ? { ...p, ideas: [...new Set([...p.ideas, ...ideaIds])] }
          : p,
      ),
    );
  }, []);

  const removeIdeaFromPage = useCallback((pageId: string, ideaId: string) => {
    setPages((ps) =>
      ps.map((p) =>
        p.id === pageId
          ? { ...p, ideas: p.ideas.filter((x) => x !== ideaId) }
          : p,
      ),
    );
  }, []);

  const getCws = useCallback(
    (pageId: string) => cws[pageId] ?? [],
    [cws],
  );

  const cwsCount = useCallback(
    (page: IdeaPage) => cws[page.id]?.length ?? page.cwsCount,
    [cws],
  );

  const addCws = useCallback((pageId: string, item: Omit<CwsItem, "id">) => {
    const id = "c_" + Math.random().toString(36).slice(2, 8);
    setCws((m) => ({ ...m, [pageId]: [{ ...item, id }, ...(m[pageId] ?? [])] }));
  }, []);

  const updateCws = useCallback(
    (pageId: string, cwsId: string, patch: Partial<CwsItem>) => {
      setCws((m) => ({
        ...m,
        [pageId]: (m[pageId] ?? []).map((c) =>
          c.id === cwsId ? { ...c, ...patch } : c,
        ),
      }));
    },
    [],
  );

  const removeCws = useCallback((pageId: string, cwsId: string) => {
    setCws((m) => ({
      ...m,
      [pageId]: (m[pageId] ?? []).filter((c) => c.id !== cwsId),
    }));
  }, []);

  const value: Store = {
    authed,
    signIn,
    signOut,
    ideas,
    ideasById,
    pages,
    getPage,
    createPage,
    updatePage,
    deletePage,
    addIdeasToPage,
    removeIdeaFromPage,
    getCws,
    cwsCount,
    addCws,
    updateCws,
    removeCws,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

export type { Status };
