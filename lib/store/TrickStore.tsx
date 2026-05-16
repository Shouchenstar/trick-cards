"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { demoCards, demoCollections, demoPapers } from "@/lib/data";
import {
  loadCardsFromStorage,
  loadCollectionsFromStorage,
  loadCompareFromStorage,
  loadPapersFromStorage,
  loadTrashCardsFromStorage,
  loadTrashPapersFromStorage,
  saveCardsToStorage,
  saveCollectionsToStorage,
  saveCompareToStorage,
  savePapersToStorage,
  saveTrashCardsToStorage,
  saveTrashPapersToStorage
} from "@/lib/storage";
import { Collection, Paper, PaperStatus, TrickCard } from "@/lib/types";

const collectionColorPalette = [
  "#7C3AED",
  "#2563EB",
  "#16A34A",
  "#0891B2",
  "#9333EA",
  "#F97316",
  "#EC4899",
  "#0F766E"
];

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const COMPARE_LIMIT = 6;

type CreateCollectionOptions = Partial<
  Pick<Collection, "color" | "icon" | "description">
>;

type UpdateCollectionPatch = Partial<
  Pick<Collection, "name" | "color" | "icon" | "description">
>;

type DeleteCollectionOptions = {
  reassignTo?: string;
};

type TrickStoreValue = {
  cards: TrickCard[];
  collections: Collection[];
  papers: Paper[];
  trashCards: TrickCard[];
  trashPapers: Paper[];
  storageReady: boolean;

  saveCard: (card: TrickCard) => void;
  deleteCard: (cardId: string) => void;
  restoreCard: (cardId: string) => void;
  permanentDeleteCard: (cardId: string) => void;

  createCollection: (
    name: string,
    options?: CreateCollectionOptions
  ) => Collection;
  updateCollection: (
    collectionId: string,
    patch: UpdateCollectionPatch
  ) => void;
  deleteCollection: (
    collectionId: string,
    options?: DeleteCollectionOptions
  ) => void;

  savePaper: (paper: Paper) => void;
  deletePaper: (paperId: string) => void;
  restorePaper: (paperId: string) => void;
  permanentDeletePaper: (paperId: string) => void;
  setPaperStatus: (paperId: string, status: PaperStatus) => void;
  linkTrickToPaper: (paperId: string, trickId: string) => void;
  unlinkTrickFromPaper: (paperId: string, trickId: string) => void;

  emptyTrashCards: () => void;
  emptyTrashPapers: () => void;

  resetWorkspace: () => void;

  compareIds: string[];
  toggleCompare: (cardId: string) => void;
  removeFromCompare: (cardId: string) => void;
  clearCompare: () => void;
  isInCompare: (cardId: string) => boolean;
};

const TrickStoreContext = createContext<TrickStoreValue | null>(null);

export const COMPARE_CARD_LIMIT = COMPARE_LIMIT;

export function TrickStoreProvider({ children }: { children: ReactNode }) {
  const [cards, setCards] = useState<TrickCard[]>(demoCards);
  const [collections, setCollections] =
    useState<Collection[]>(demoCollections);
  const [papers, setPapers] = useState<Paper[]>(demoPapers);
  const [trashCards, setTrashCards] = useState<TrickCard[]>([]);
  const [trashPapers, setTrashPapers] = useState<Paper[]>([]);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [storageReady, setStorageReady] = useState(false);

  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

  function isTrashExpired(item: { deletedAt?: string }): boolean {
    if (!item.deletedAt) return false;
    return Date.now() - new Date(item.deletedAt).getTime() > THIRTY_DAYS_MS;
  }

  useEffect(() => {
    const storedCollections = loadCollectionsFromStorage(demoCollections);
    const storedCards = loadCardsFromStorage(demoCards);
    const storedCompare = loadCompareFromStorage();
    const storedPapers = loadPapersFromStorage(demoPapers);
    const storedTrashCards = loadTrashCardsFromStorage();
    const storedTrashPapers = loadTrashPapersFromStorage();

    setCollections(storedCollections);
    setCards(storedCards);
    setPapers(storedPapers);

    // 自动清理超过 30 天的垃圾桶项目
    const freshTrashCards = storedTrashCards.filter((c) => !isTrashExpired(c));
    const freshTrashPapers = storedTrashPapers.filter((p) => !isTrashExpired(p));
    setTrashCards(freshTrashCards);
    setTrashPapers(freshTrashPapers);

    const validIds = new Set(storedCards.map((card) => card.id));
    setCompareIds(storedCompare.filter((id) => validIds.has(id)));

    setStorageReady(true);

    // 后台迁移：把卡片里 base64 图片倒入磁盘，释放 localStorage 空间
    const MIGRATION_KEY = "trick-cards.image-disk-migration.v1";
    if (
      typeof window !== "undefined" &&
      window.localStorage.getItem(MIGRATION_KEY) !== "done"
    ) {
      void (async () => {
        try {
          const { migrateCardImagesToDisk } = await import("@/lib/imageStorage");
          const { cards: migratedCards, migrated } =
            await migrateCardImagesToDisk(storedCards);
          if (migrated > 0) {
            setCards(migratedCards);
            console.info(`[image-migration] 已迁移 ${migrated} 张图片到本地磁盘`);
          }
          window.localStorage.setItem(MIGRATION_KEY, "done");
        } catch (err) {
          console.warn("[image-migration] 迁移失败", err);
        }
      })();
    }
  }, []);

  useEffect(() => {
    if (!storageReady) {
      return;
    }

    saveCardsToStorage(cards);
    saveCollectionsToStorage(collections);
    saveCompareToStorage(compareIds);
    savePapersToStorage(papers);
    saveTrashCardsToStorage(trashCards);
    saveTrashPapersToStorage(trashPapers);
  }, [cards, collections, compareIds, papers, trashCards, trashPapers, storageReady]);

  const saveCard = useCallback((nextCard: TrickCard) => {
    setCards((current) => {
      const exists = current.some((card) => card.id === nextCard.id);

      if (exists) {
        return current.map((card) =>
          card.id === nextCard.id ? nextCard : card
        );
      }

      return [nextCard, ...current];
    });
  }, []);

  const deleteCard = useCallback((cardId: string) => {
    let target: TrickCard | undefined;
    setCards((current) => {
      target = current.find((card) => card.id === cardId);
      return current
        .filter((card) => card.id !== cardId)
        .map((card) => ({
          ...card,
          relatedCardIds: card.relatedCardIds.filter((id) => id !== cardId)
        }));
    });
    if (target) {
      const now = new Date().toISOString();
      setTrashCards((prev) => [...prev, { ...target!, deletedAt: now }]);
    }
    setCompareIds((current) => current.filter((id) => id !== cardId));
  }, []);

  const restoreCard = useCallback((cardId: string) => {
    setTrashCards((current) => {
      const target = current.find((card) => card.id === cardId);
      if (target) {
        const { deletedAt, ...restored } = target;
        setCards((prev) => [restored, ...prev]);
      }
      return current.filter((card) => card.id !== cardId);
    });
  }, []);

  const permanentDeleteCard = useCallback((cardId: string) => {
    setTrashCards((current) => current.filter((card) => card.id !== cardId));
    // 同时清理其他卡片中的 relatedCardIds 引用
    setCards((current) =>
      current.map((card) => ({
        ...card,
        relatedCardIds: card.relatedCardIds.filter((id) => id !== cardId)
      }))
    );
  }, []);

  const createCollection = useCallback<TrickStoreValue["createCollection"]>(
    (name, options = {}) => {
      const trimmed = name.trim();
      const existing = collections.find(
        (collection) => collection.name.toLowerCase() === trimmed.toLowerCase()
      );

      if (existing) {
        return existing;
      }

      const now = new Date().toISOString();
      const next: Collection = {
        id: createId("collection"),
        name: trimmed || "未命名专栏",
        description: options.description ?? "自定义专栏",
        icon: options.icon ?? "folder",
        color:
          options.color ??
          collectionColorPalette[
            collections.length % collectionColorPalette.length
          ],
        cardCount: 0,
        createdAt: now,
        updatedAt: now
      };

      setCollections((current) => [...current, next]);
      return next;
    },
    [collections]
  );

  const updateCollection = useCallback<TrickStoreValue["updateCollection"]>(
    (collectionId, patch) => {
      const now = new Date().toISOString();
      setCollections((current) =>
        current.map((collection) =>
          collection.id === collectionId
            ? { ...collection, ...patch, updatedAt: now }
            : collection
        )
      );
    },
    []
  );

  const deleteCollection = useCallback<TrickStoreValue["deleteCollection"]>(
    (collectionId, options = {}) => {
      const reassignTo = options.reassignTo;

      setCards((current) => {
        if (reassignTo) {
          return current.map((card) =>
            card.collectionId === collectionId
              ? { ...card, collectionId: reassignTo }
              : card
          );
        }

        const removedIds = new Set(
          current
            .filter((card) => card.collectionId === collectionId)
            .map((card) => card.id)
        );

        return current
          .filter((card) => card.collectionId !== collectionId)
          .map((card) => ({
            ...card,
            relatedCardIds: card.relatedCardIds.filter(
              (id) => !removedIds.has(id)
            )
          }));
      });

      setCollections((current) =>
        current.filter((collection) => collection.id !== collectionId)
      );

      setCompareIds((current) => {
        const removedIds = new Set(
          cards
            .filter((card) => card.collectionId === collectionId)
            .map((card) => card.id)
        );

        if (!removedIds.size || reassignTo) {
          return current;
        }

        return current.filter((id) => !removedIds.has(id));
      });
    },
    [cards]
  );

  const savePaper = useCallback((nextPaper: Paper) => {
    setPapers((current) => {
      const exists = current.some((paper) => paper.id === nextPaper.id);
      const now = new Date().toISOString();
      const stamped = { ...nextPaper, updatedAt: now };

      if (exists) {
        return current.map((paper) =>
          paper.id === nextPaper.id ? stamped : paper
        );
      }

      return [{ ...stamped, addedAt: stamped.addedAt || now }, ...current];
    });
  }, []);

  const deletePaper = useCallback((paperId: string) => {
    setPapers((current) => {
      const target = current.find((paper) => paper.id === paperId);
      if (target) {
        const now = new Date().toISOString();
        setTrashPapers((prev) => [...prev, { ...target, deletedAt: now }]);
      }
      return current.filter((paper) => paper.id !== paperId);
    });
  }, []);

  const restorePaper = useCallback((paperId: string) => {
    setTrashPapers((current) => {
      const target = current.find((paper) => paper.id === paperId);
      if (target) {
        const { deletedAt, ...restored } = target;
        setPapers((prev) => [restored, ...prev]);
      }
      return current.filter((paper) => paper.id !== paperId);
    });
  }, []);

  const permanentDeletePaper = useCallback((paperId: string) => {
    setTrashPapers((current) => current.filter((paper) => paper.id !== paperId));
  }, []);

  const emptyTrashCards = useCallback(() => {
    setTrashCards([]);
  }, []);

  const emptyTrashPapers = useCallback(() => {
    setTrashPapers([]);
  }, []);

  const setPaperStatus = useCallback(
    (paperId: string, status: PaperStatus) => {
      const now = new Date().toISOString();
      setPapers((current) =>
        current.map((paper) =>
          paper.id === paperId ? { ...paper, status, updatedAt: now } : paper
        )
      );
    },
    []
  );

  const linkTrickToPaper = useCallback(
    (paperId: string, trickId: string) => {
      const now = new Date().toISOString();
      setPapers((current) =>
        current.map((paper) => {
          if (paper.id !== paperId) {
            return paper;
          }
          if (paper.generatedTrickIds.includes(trickId)) {
            return paper;
          }
          return {
            ...paper,
            generatedTrickIds: [...paper.generatedTrickIds, trickId],
            updatedAt: now
          };
        })
      );
    },
    []
  );

  const unlinkTrickFromPaper = useCallback(
    (paperId: string, trickId: string) => {
      const now = new Date().toISOString();
      setPapers((current) =>
        current.map((paper) => {
          if (paper.id !== paperId) return paper;
          if (!paper.generatedTrickIds.includes(trickId)) return paper;
          return {
            ...paper,
            generatedTrickIds: paper.generatedTrickIds.filter((id) => id !== trickId),
            updatedAt: now
          };
        })
      );
    },
    []
  );

  const resetWorkspace = useCallback(() => {
    setCards(demoCards);
    setCollections(demoCollections);
    setPapers(demoPapers);
    setCompareIds([]);
  }, []);

  const toggleCompare = useCallback((cardId: string) => {
    setCompareIds((current) => {
      if (current.includes(cardId)) {
        return current.filter((id) => id !== cardId);
      }

      if (current.length >= COMPARE_LIMIT) {
        if (typeof window !== "undefined") {
          window.alert(
            `一次最多对比 ${COMPARE_LIMIT} 张 trick，请先移除一张再加入。`
          );
        }
        return current;
      }

      return [...current, cardId];
    });
  }, []);

  const removeFromCompare = useCallback((cardId: string) => {
    setCompareIds((current) => current.filter((id) => id !== cardId));
  }, []);

  const clearCompare = useCallback(() => {
    setCompareIds([]);
  }, []);

  const isInCompare = useCallback(
    (cardId: string) => compareIds.includes(cardId),
    [compareIds]
  );

  const value = useMemo<TrickStoreValue>(
    () => ({
      cards,
      collections,
      papers,
      trashCards,
      trashPapers,
      storageReady,
      saveCard,
      deleteCard,
      restoreCard,
      permanentDeleteCard,
      createCollection,
      updateCollection,
      deleteCollection,
      savePaper,
      deletePaper,
      restorePaper,
      permanentDeletePaper,
      setPaperStatus,
      linkTrickToPaper,
      unlinkTrickFromPaper,
      emptyTrashCards,
      emptyTrashPapers,
      resetWorkspace,
      compareIds,
      toggleCompare,
      removeFromCompare,
      clearCompare,
      isInCompare
    }),
    [
      cards,
      collections,
      papers,
      trashCards,
      trashPapers,
      storageReady,
      saveCard,
      deleteCard,
      restoreCard,
      permanentDeleteCard,
      createCollection,
      updateCollection,
      deleteCollection,
      savePaper,
      deletePaper,
      restorePaper,
      permanentDeletePaper,
      setPaperStatus,
      linkTrickToPaper,
      unlinkTrickFromPaper,
      emptyTrashCards,
      emptyTrashPapers,
      resetWorkspace,
      compareIds,
      toggleCompare,
      removeFromCompare,
      clearCompare,
      isInCompare
    ]
  );

  return (
    <TrickStoreContext.Provider value={value}>
      {children}
    </TrickStoreContext.Provider>
  );
}

export function useTrickStore() {
  const context = useContext(TrickStoreContext);

  if (!context) {
    throw new Error("useTrickStore must be used inside <TrickStoreProvider>.");
  }

  return context;
}
