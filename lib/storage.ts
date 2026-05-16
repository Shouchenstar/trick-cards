import { Collection, Paper, TrickCard } from "@/lib/types";

const CARDS_STORAGE_KEY = "trick-cards.cards.v1";
const COLLECTIONS_STORAGE_KEY = "trick-cards.collections.v1";
const COMPARE_STORAGE_KEY = "trick-cards.compare.v1";
const PAPERS_STORAGE_KEY = "trick-cards.papers.v1";
const TRASH_CARDS_KEY = "trick-cards.trash.cards.v1";
const TRASH_PAPERS_KEY = "trick-cards.trash.papers.v1";

function normalizeCardStatus(card: TrickCard) {
  const legacyStatus = String(card.status);

  return {
    ...card,
    status:
      legacyStatus === "verified" || legacyStatus === "used"
        ? "verified"
        : "todo"
  } satisfies TrickCard;
}

export function loadCardsFromStorage(fallback: TrickCard[]) {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const rawCards = window.localStorage.getItem(CARDS_STORAGE_KEY);

    if (!rawCards) {
      return fallback;
    }

    const cards = JSON.parse(rawCards);
    return Array.isArray(cards)
      ? (cards as TrickCard[]).map(normalizeCardStatus)
      : fallback;
  } catch {
    return fallback;
  }
}

export function saveCardsToStorage(cards: TrickCard[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(CARDS_STORAGE_KEY, JSON.stringify(cards));
}

export function loadCollectionsFromStorage(fallback: Collection[]) {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const rawCollections = window.localStorage.getItem(COLLECTIONS_STORAGE_KEY);

    if (!rawCollections) {
      return fallback;
    }

    const collections = JSON.parse(rawCollections);
    return Array.isArray(collections)
      ? (collections as Collection[])
      : fallback;
  } catch {
    return fallback;
  }
}

export function saveCollectionsToStorage(collections: Collection[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    COLLECTIONS_STORAGE_KEY,
    JSON.stringify(collections)
  );
}

export function loadCompareFromStorage(): string[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(COMPARE_STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

export function saveCompareToStorage(compareIds: string[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(compareIds));
}

export function loadPapersFromStorage(fallback: Paper[]) {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(PAPERS_STORAGE_KEY);

    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Paper[]) : fallback;
  } catch {
    return fallback;
  }
}

export function savePapersToStorage(papers: Paper[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(PAPERS_STORAGE_KEY, JSON.stringify(papers));
}

export function resetCardsInStorage() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(CARDS_STORAGE_KEY);
  window.localStorage.removeItem(COLLECTIONS_STORAGE_KEY);
  window.localStorage.removeItem(COMPARE_STORAGE_KEY);
  window.localStorage.removeItem(PAPERS_STORAGE_KEY);
  window.localStorage.removeItem(TRASH_CARDS_KEY);
  window.localStorage.removeItem(TRASH_PAPERS_KEY);
}

// ========== 垃圾桶存储 ==========

export function loadTrashCardsFromStorage(): TrickCard[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(TRASH_CARDS_KEY);
    return raw ? (JSON.parse(raw) as TrickCard[]) : [];
  } catch {
    return [];
  }
}

export function saveTrashCardsToStorage(cards: TrickCard[]) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(TRASH_CARDS_KEY, JSON.stringify(cards));
  } catch {
    /* quota exceeded */
  }
}

export function loadTrashPapersFromStorage(): Paper[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(TRASH_PAPERS_KEY);
    return raw ? (JSON.parse(raw) as Paper[]) : [];
  } catch {
    return [];
  }
}

export function saveTrashPapersToStorage(papers: Paper[]) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(TRASH_PAPERS_KEY, JSON.stringify(papers));
  } catch {
    /* quota exceeded */
  }
}
