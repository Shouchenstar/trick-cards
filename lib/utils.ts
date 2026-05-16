import { type ClassValue, clsx } from "clsx";
import { Collection, TrickCard, CardStatus, SourceType } from "@/lib/types";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric"
  }).format(new Date(date));
}

export function getCollectionMap(collections: Collection[]) {
  return new Map(collections.map((collection) => [collection.id, collection]));
}

export function getCardCover(card: TrickCard) {
  if (!card.images.length) {
    return null;
  }

  return (
    card.images.find((image) => image.id === card.coverImageId) ??
    card.images.find((image) => image.type === "cover") ??
    card.images[0]
  );
}

export const statusMeta: Record<
  CardStatus,
  { label: string; tone: string; dot: string }
> = {
  todo: {
    label: "待复现",
    tone: "bg-amber-100 text-amber-700",
    dot: "bg-amber-500"
  },
  verified: {
    label: "已复现",
    tone: "bg-emerald-100 text-emerald-700",
    dot: "bg-emerald-500"
  }
};

export const sourceTypeLabels: Record<SourceType, string> = {
  paper: "论文",
  blog: "博客",
  repo: "代码仓库",
  doc: "文档",
  course: "课程",
  manual: "手动总结",
  meeting: "会议记录",
  project: "项目经验",
  product: "产品灵感",
  life: "生活灵感",
  experiment: "实验记录",
  other: "其他"
};

export function getSourceTypeLabel(type: SourceType) {
  return sourceTypeLabels[type] ?? "其他";
}
