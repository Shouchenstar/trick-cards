export type CardStatus = "todo" | "verified";

export type CardDifficulty = "easy" | "medium" | "hard";

export type SourceType =
  | "paper"
  | "blog"
  | "repo"
  | "doc"
  | "course"
  | "manual"
  | "meeting"
  | "project"
  | "product"
  | "life"
  | "experiment"
  | "other";

export type Note = {
  id: string;
  content: string;
  createdAt: string;
};

export type Source = {
  id: string;
  title: string;
  type: SourceType;
  url?: string;
  authors?: string[];
  venue?: string;
  year?: number;
  note?: string;
};

export type UsageRecord = {
  id: string;
  projectName?: string;
  scenario?: string;
  result: string;
  success: boolean;
  createdAt: string;
};

export type CardImage = {
  id: string;
  cardId: string;
  url: string;
  type: "cover" | "main_figure" | "inline" | "gallery" | "attachment";
  imageKind?:
    | "circuit"
    | "architecture"
    | "pipeline"
    | "chart"
    | "table"
    | "formula"
    | "screenshot"
    | "paper_figure"
    | "other";
  title?: string;
  caption?: string;
  sourceId?: string;
  tags: string[];
  createdAt: string;
};

export type Collection = {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color: string;
  cardCount: number;
  createdAt: string;
  updatedAt: string;
};

export type TrickCard = {
  id: string;
  title: string;
  subtitle?: string;
  description: string;
  collectionId: string;
  tags: string[];
  domain?: string;
  difficulty?: CardDifficulty;
  status: CardStatus;
  problem: string;
  solution: string;
  benefits: string[];
  costs: string[];
  tradeoffs: string[];
  applicableScenarios: string[];
  unsuitableScenarios?: string[];
  notes: Note[];
  sources: Source[];
  usages: UsageRecord[];
  relatedCardIds: string[];
  coverImageId?: string;
  images: CardImage[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
};

export type PaperStatus = "todo" | "reading" | "read" | "shelved";

export type Paper = {
  id: string;
  title: string;
  authors: string[];
  venue?: string;
  year?: number;
  abstract?: string;
  url?: string;
  pdfUrl?: string;
  tags: string[];
  status: PaperStatus;
  rating?: number;
  notes: string;
  generatedTrickIds: string[];
  collectionId?: string;
  addedAt: string;
  updatedAt: string;
  deletedAt?: string;
};
