import { Layers3, Network, NotebookText, Shapes } from "lucide-react";
import { Collection, TrickCard } from "@/lib/types";

type CollectionSummaryProps = {
  collections: Collection[];
  cards: TrickCard[];
};

const statItems = [
  {
    label: "专栏数",
    icon: Layers3,
    key: "collections"
  },
  {
    label: "卡片数",
    icon: NotebookText,
    key: "cards"
  },
  {
    label: "已复现",
    icon: Shapes,
    key: "verified"
  },
  {
    label: "可复用场景",
    icon: Network,
    key: "scenarios"
  }
] as const;

export function CollectionSummary({
  collections,
  cards
}: CollectionSummaryProps) {
  const values = {
    collections: collections.length,
    cards: cards.length,
    verified: cards.filter((card) => card.status === "verified").length,
    scenarios: new Set(cards.flatMap((card) => card.applicableScenarios)).size
  };

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border/60 bg-surface px-4 py-2 shadow-sm">
      {statItems.map((item) => {
        const Icon = item.icon;

        return (
          <div key={item.key} className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary-soft text-primary">
              <Icon className="h-3.5 w-3.5" />
            </span>
            <span className="text-xs text-text-secondary">{item.label}</span>
            <span className="text-sm font-semibold text-text-main">
              {values[item.key]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
