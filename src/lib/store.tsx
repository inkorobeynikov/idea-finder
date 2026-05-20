"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createClient } from "@/utils/supabase/client";
import {
  addPageItems,
  deleteCwsRow,
  deletePageRow,
  fetchAll,
  insertCws,
  insertPage,
  removePageItem,
  ResearchPatch,
  updateCwsRow,
  updateIdeaResearch as updateIdeaResearchRow,
  updatePageRow,
} from "./api";
import { CwsItem, IdeaPage, ParsedIdea, Status } from "./data";

interface Store {
  // auth
  authed: boolean;
  authReady: boolean; // initial auth state resolved
  dataReady: boolean; // initial data load finished (or errored)
  loadError: string | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;

  // data
  ideas: ParsedIdea[];
  ideasById: Record<string, ParsedIdea>;
  pages: IdeaPage[];
  getPage: (id: string) => IdeaPage | undefined;
  updateIdeaResearch: (id: string, patch: ResearchPatch) => void;

  createPage: (ideaIds: string[], title?: string) => Promise<string>;
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

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);

  const [authed, setAuthed] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [dataReady, setDataReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [ideas, setIdeas] = useState<ParsedIdea[]>([]);
  const [pages, setPages] = useState<IdeaPage[]>([]);
  const [cws, setCws] = useState<Record<string, CwsItem[]>>({});

  // Resolve auth state and subscribe to changes.
  useEffect(() => {
    let active = true;
    supabase.auth.getClaims().then(({ data }) => {
      if (!active) return;
      setAuthed(!!data?.claims);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session);
      if (!session) {
        setDataReady(false);
        setIdeas([]);
        setPages([]);
        setCws({});
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  // Load all data once authenticated.
  useEffect(() => {
    if (!authed) return;
    let active = true;
    fetchAll()
      .then((d) => {
        if (!active) return;
        setIdeas(d.ideas);
        setPages(d.pages);
        setCws(d.cws);
        setLoadError(null);
        setDataReady(true);
      })
      .catch((e: unknown) => {
        if (!active) return;
        setLoadError(e instanceof Error ? e.message : "Failed to load data");
        setDataReady(true);
      });
    return () => {
      active = false;
    };
  }, [authed]);

  const ideasById = useMemo(() => {
    const m: Record<string, ParsedIdea> = {};
    ideas.forEach((i) => {
      m[i.id] = i;
    });
    return m;
  }, [ideas]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error ? error.message : null };
    },
    [supabase],
  );
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, [supabase]);

  const getPage = useCallback(
    (id: string) => pages.find((p) => p.id === id),
    [pages],
  );

  // Apply enrichment results optimistically, then write through. The /api/enrich
  // route already persists, but we mirror the find-revenue pattern (route writes +
  // store write-through) so local state and the DB stay in sync without a reload.
  const updateIdeaResearch = useCallback((id: string, patch: ResearchPatch) => {
    setIdeas((arr) =>
      arr.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    );
    updateIdeaResearchRow(id, patch).catch(console.error);
  }, []);

  const createPage = useCallback(async (ideaIds: string[], title = "") => {
    const page = await insertPage(title, ideaIds ?? []);
    setPages((p) => [page, ...p]);
    return page.id;
  }, []);

  const updatePage = useCallback((updated: IdeaPage) => {
    setPages((ps) => ps.map((p) => (p.id === updated.id ? updated : p)));
    updatePageRow(updated.id, {
      title: updated.title,
      status: updated.status,
      notes: updated.notes,
    }).catch(console.error);
  }, []);

  const deletePage = useCallback((id: string) => {
    setPages((ps) => ps.filter((p) => p.id !== id));
    setCws((m) => {
      const n = { ...m };
      delete n[id];
      return n;
    });
    deletePageRow(id).catch(console.error);
  }, []);

  const addIdeasToPage = useCallback((pageId: string, ideaIds: string[]) => {
    setPages((ps) =>
      ps.map((p) =>
        p.id === pageId
          ? { ...p, ideas: [...new Set([...p.ideas, ...ideaIds])] }
          : p,
      ),
    );
    addPageItems(pageId, ideaIds).catch(console.error);
  }, []);

  const removeIdeaFromPage = useCallback((pageId: string, ideaId: string) => {
    setPages((ps) =>
      ps.map((p) =>
        p.id === pageId
          ? { ...p, ideas: p.ideas.filter((x) => x !== ideaId) }
          : p,
      ),
    );
    removePageItem(pageId, ideaId).catch(console.error);
  }, []);

  const getCws = useCallback((pageId: string) => cws[pageId] ?? [], [cws]);
  const cwsCount = useCallback((page: IdeaPage) => cws[page.id]?.length ?? 0, [cws]);

  const addCws = useCallback((pageId: string, item: Omit<CwsItem, "id">) => {
    insertCws(pageId, item)
      .then((row) =>
        setCws((m) => ({ ...m, [pageId]: [row, ...(m[pageId] ?? [])] })),
      )
      .catch(console.error);
  }, []);

  const updateCws = useCallback(
    (pageId: string, cwsId: string, patch: Partial<CwsItem>) => {
      setCws((m) => ({
        ...m,
        [pageId]: (m[pageId] ?? []).map((c) =>
          c.id === cwsId ? { ...c, ...patch } : c,
        ),
      }));
      updateCwsRow(cwsId, patch).catch(console.error);
    },
    [],
  );

  const removeCws = useCallback((pageId: string, cwsId: string) => {
    setCws((m) => ({
      ...m,
      [pageId]: (m[pageId] ?? []).filter((c) => c.id !== cwsId),
    }));
    deleteCwsRow(cwsId).catch(console.error);
  }, []);

  const value: Store = {
    authed,
    authReady,
    dataReady,
    loadError,
    signIn,
    signOut,
    ideas,
    ideasById,
    pages,
    getPage,
    updateIdeaResearch,
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
