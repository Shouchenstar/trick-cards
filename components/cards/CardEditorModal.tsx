"use client";

import {
  ChangeEvent,
  PointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  Camera,
  ClipboardPaste,
  FolderPlus,
  ImagePlus,
  Loader2,
  Save,
  Sparkles,
  Star,
  Table2,
  Trash2,
  Upload,
  X
} from "lucide-react";
import {
  CardImage,
  CardStatus,
  Collection,
  SourceType,
  TrickCard
} from "@/lib/types";
import { cn, getCardCover, sourceTypeLabels, statusMeta } from "@/lib/utils";
import { callCompleteCard } from "@/lib/ai/client-bridge";
import { persistImage } from "@/lib/imageStorage";
import { AsyncImage } from "@/components/AsyncImage";

type CardEditorModalProps = {
  open: boolean;
  card: TrickCard | null;
  collections: Collection[];
  onClose: () => void;
  onSave: (card: TrickCard) => void;
  onCreateCollection: (name: string) => Collection;
};

type CardFormState = {
  title: string;
  subtitle: string;
  description: string;
  collectionId: string;
  tags: string;
  domain: string;
  status: CardStatus;
  problem: string;
  solution: string;
  benefits: string;
  costs: string;
  tradeoffs: string;
  applicableScenarios: string;
  note: string;
  sourceTitle: string;
  sourceType: SourceType;
  sourceUrl: string;
  sourceAuthors: string;
  sourceYear: string;
  usageResult: string;
  images: CardImage[];
  coverImageId?: string;
};

type CropSelection = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
};

const sourceTypeOptions: SourceType[] = [
  "manual",
  "paper",
  "blog",
  "repo",
  "doc",
  "course",
  "meeting",
  "project",
  "product",
  "life",
  "experiment",
  "other"
];

const CREATE_COLLECTION_VALUE = "__create_collection__";

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function splitLines(value: string) {
  return value
    .split(/\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitTags(value: string) {
  return value
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function mergeTagStrings(existing: string, extra: string[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of [...splitTags(existing), ...extra]) {
    const key = tag.trim();
    if (!key) continue;
    const lower = key.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    out.push(key);
  }
  return out.join(", ");
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function createImageFromDataUrl(
  dataUrl: string,
  title: string,
  cardId: string
): Promise<CardImage> {
  // Tauri 桌面端：把图片字节落盘，url 存为 "tauri-img:{绝对路径}"
  // 浏览器：保留原 dataUrl
  const persisted = await persistImage(dataUrl);
  return {
    id: createId("img"),
    cardId,
    url: persisted,
    type: "gallery",
    imageKind: "screenshot",
    title,
    caption: "",
    tags: [],
    createdAt: new Date().toISOString()
  };
}

function normalizeSelection(selection: CropSelection) {
  const x = Math.min(selection.startX, selection.endX);
  const y = Math.min(selection.startY, selection.endY);
  const width = Math.abs(selection.endX - selection.startX);
  const height = Math.abs(selection.endY - selection.startY);

  return { x, y, width, height };
}

function stateFromCard(card: TrickCard | null, collections: Collection[]): CardFormState {
  return {
    title: card?.title ?? "",
    subtitle: card?.subtitle ?? "",
    description: card?.description ?? "",
    collectionId: card?.collectionId ?? collections[0]?.id ?? "",
    tags: card?.tags.join(", ") ?? "",
    domain: card?.domain ?? "",
    status: card?.status ?? "todo",
    problem: card?.problem ?? "",
    solution: card?.solution ?? "",
    benefits: card?.benefits.join("\n") ?? "",
    costs: card?.costs.join("\n") ?? "",
    tradeoffs: card?.tradeoffs.join("\n") ?? "",
    applicableScenarios: card?.applicableScenarios.join("\n") ?? "",
    note: card?.notes[0]?.content ?? "",
    sourceTitle: card?.sources[0]?.title ?? "",
    sourceType: card?.sources[0]?.type ?? "manual",
    sourceUrl: card?.sources[0]?.url ?? "",
    sourceAuthors: card?.sources[0]?.authors?.join("、") ?? "",
    sourceYear: card?.sources[0]?.year ? String(card.sources[0].year) : "",
    usageResult: card?.usages[0]?.result ?? "",
    images: card?.images ?? [],
    coverImageId: card?.coverImageId
  };
}

function Field({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

const inputClass =
  "h-11 w-full rounded-xl border border-border bg-white px-3 text-sm text-text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";

const textareaClass =
  "min-h-24 w-full resize-y rounded-xl border border-border bg-white px-3 py-3 text-sm leading-6 text-text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";

export function CardEditorModal({
  open,
  card,
  collections,
  onClose,
  onSave,
  onCreateCollection
}: CardEditorModalProps) {
  const [form, setForm] = useState<CardFormState>(() =>
    stateFromCard(card, collections)
  );
  const [newCollectionName, setNewCollectionName] = useState("");
  const [showNewCollectionInput, setShowNewCollectionInput] = useState(false);
  const [cropImageUrl, setCropImageUrl] = useState<string | null>(null);
  const [cropSelection, setCropSelection] = useState<CropSelection | null>(null);
  const [isSelectingCrop, setIsSelectingCrop] = useState(false);
  const cropImageRef = useRef<HTMLImageElement | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiToast, setAiToast] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isTextDragging, setIsTextDragging] = useState(false);
  const lastCreatedCollectionId = useRef<string | null>(null);

  const isEditing = Boolean(card);
  const coverImage = useMemo(
    () => getCardCover({ ...(card ?? ({} as TrickCard)), images: form.images, coverImageId: form.coverImageId }),
    [card, form.coverImageId, form.images]
  );

  useEffect(() => {
    if (open) {
      const effectiveCollections = lastCreatedCollectionId.current
        ? [...collections]
        : collections;
      setForm(stateFromCard(card, effectiveCollections));
      if (lastCreatedCollectionId.current) {
        setForm((prev) => ({ ...prev, collectionId: lastCreatedCollectionId.current! }));
        lastCreatedCollectionId.current = null;
      }
      setNewCollectionName("");
      setShowNewCollectionInput(false);
      setCropImageUrl(null);
      setCropSelection(null);
      setIsSelectingCrop(false);
      setAiLoading(false);
      setAiError(null);
      setAiToast(null);
    }
  }, [card, open, collections]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!aiToast) return;
    const handle = window.setTimeout(() => setAiToast(null), 2400);
    return () => window.clearTimeout(handle);
  }, [aiToast]);

  async function handleAICompletion() {
    if (!form.title.trim()) {
      setAiError("请先在标题里写明这个 trick 的名字");
      return;
    }
    setAiLoading(true);
    setAiError(null);
    try {
      const collectionName = collections.find(
        (item) => item.id === form.collectionId
      )?.name;
      const completion = await callCompleteCard({
        title: form.title.trim(),
        description: form.description?.trim() || undefined,
        domain: form.domain?.trim() || undefined,
        collection: collectionName,
        tags: splitTags(form.tags),
        source: form.sourceTitle
          ? {
              title: form.sourceTitle.trim(),
              url: form.sourceUrl.trim() || undefined
            }
          : undefined
      });
      setForm((current) => ({
        ...current,
        problem: current.problem.trim() ? current.problem : completion.problem,
        solution: current.solution.trim()
          ? current.solution
          : completion.solution,
        benefits: current.benefits.trim()
          ? current.benefits
          : completion.benefits.join("\n"),
        costs: current.costs.trim()
          ? current.costs
          : completion.costs.join("\n"),
        tradeoffs: current.tradeoffs.trim()
          ? current.tradeoffs
          : completion.tradeoffs.join("\n"),
        applicableScenarios: current.applicableScenarios.trim()
          ? current.applicableScenarios
          : completion.applicableScenarios.join("\n"),
        tags: mergeTagStrings(current.tags, completion.tags)
      }));
      setAiToast("AI 补全已写入空字段（已填的字段未覆盖）");
    } catch (err) {
      setAiError((err as Error).message);
    } finally {
      setAiLoading(false);
    }
  }

  if (!open) {
    return null;
  }

  function updateForm<Value extends keyof CardFormState>(
    key: Value,
    value: CardFormState[Value]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) {
      return;
    }

    const uploadedImages = await Promise.all(
      files.map(async (file) => {
        const url = await fileToDataUrl(file);
        return createImageFromDataUrl(url, file.name, card?.id ?? "draft");
      })
    );

    addImages(uploadedImages);

    event.target.value = "";
  }

  function addImages(images: CardImage[]) {
    if (!images.length) {
      return;
    }

    setForm((current) => {
      const nextImages = [...current.images, ...images];
      const firstImageId = images[0]?.id;

      return {
        ...current,
        images: nextImages,
        coverImageId: current.coverImageId ?? firstImageId
      };
    });
  }

  async function handlePasteScreenshot() {
    // Tauri 桌面端：优先用 clipboard-manager 插件读取图片
    try {
      const { readImage } = await import("@tauri-apps/plugin-clipboard-manager");
      const image = await readImage();
      const [rgba, { width, height }] = await Promise.all([image.rgba(), image.size()]);
      // RGBA raw pixels → canvas → PNG data URL
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      const imgData = new ImageData(new Uint8ClampedArray(rgba), width, height);
      ctx.putImageData(imgData, 0, 0);
      const dataUrl = canvas.toDataURL("image/png");
      const img = await createImageFromDataUrl(dataUrl, "粘贴截图", card?.id ?? "draft");
      addImages([img]);
      return;
    } catch {
      // 非 Tauri 环境或插件不可用，走浏览器 fallback
    }

    if (!navigator.clipboard?.read) {
      window.alert("当前浏览器不支持直接读取剪贴板图片，可以使用 Ctrl+V 粘贴。");
      return;
    }

    try {
      const clipboardItems = await navigator.clipboard.read();
      const pastedImages: CardImage[] = [];

      for (const item of clipboardItems) {
        const imageType = item.types.find((type) => type.startsWith("image/"));

        if (!imageType) {
          continue;
        }

        const blob = await item.getType(imageType);
        const file = new File([blob], `clipboard-${Date.now()}.png`, {
          type: imageType
        });
        const dataUrl = await fileToDataUrl(file);
        pastedImages.push(
          await createImageFromDataUrl(dataUrl, "剪贴板截图", card?.id ?? "draft")
        );
      }

      if (!pastedImages.length) {
        window.alert("剪贴板里没有图片。");
        return;
      }

      addImages(pastedImages);
    } catch {
      window.alert("无法读取剪贴板图片。可以先截图后使用 Ctrl+V 粘贴。");
    }
  }

  async function handleCaptureScreenshot() {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      window.alert("当前浏览器不支持屏幕截图。");
      return;
    }

    let stream: MediaStream | null = null;

    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      });

      const video = document.createElement("video");
      video.srcObject = stream;
      video.muted = true;
      await video.play();

      await new Promise<void>((resolve) => {
        if (video.readyState >= 2) {
          resolve();
          return;
        }

        video.onloadeddata = () => resolve();
      });

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Canvas context unavailable");
      }

      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/png");
      setCropImageUrl(dataUrl);
      setCropSelection(null);
      setIsSelectingCrop(false);
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        return;
      }

      window.alert("截图失败，请重新选择窗口或改用上传图片。");
    } finally {
      stream?.getTracks().forEach((track) => track.stop());
    }
  }

  function getCropPoint(event: PointerEvent) {
    const image = cropImageRef.current;

    if (!image) {
      return null;
    }

    const rect = image.getBoundingClientRect();

    return {
      x: Math.min(rect.width, Math.max(0, event.clientX - rect.left)),
      y: Math.min(rect.height, Math.max(0, event.clientY - rect.top))
    };
  }

  function handleCropPointerDown(event: PointerEvent<HTMLDivElement>) {
    const point = getCropPoint(event);

    if (!point) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    setIsSelectingCrop(true);
    setCropSelection({
      startX: point.x,
      startY: point.y,
      endX: point.x,
      endY: point.y
    });
  }

  function handleCropPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!isSelectingCrop) {
      return;
    }

    const point = getCropPoint(event);

    if (!point) {
      return;
    }

    setCropSelection((current) =>
      current
        ? {
            ...current,
            endX: point.x,
            endY: point.y
          }
        : null
    );
  }

  function handleCropPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    setIsSelectingCrop(false);
  }

  async function handleSaveCrop() {
    const image = cropImageRef.current;

    if (!image || !cropImageUrl || !cropSelection) {
      window.alert("请先拖拽选择需要保存的区域。");
      return;
    }

    const selection = normalizeSelection(cropSelection);

    if (selection.width < 8 || selection.height < 8) {
      window.alert("选择区域太小，请重新框选。");
      return;
    }

    const scaleX = image.naturalWidth / image.clientWidth;
    const scaleY = image.naturalHeight / image.clientHeight;
    const sourceX = Math.round(selection.x * scaleX);
    const sourceY = Math.round(selection.y * scaleY);
    const sourceWidth = Math.round(selection.width * scaleX);
    const sourceHeight = Math.round(selection.height * scaleY);
    const canvas = document.createElement("canvas");
    canvas.width = sourceWidth;
    canvas.height = sourceHeight;
    const context = canvas.getContext("2d");

    if (!context) {
      window.alert("截图保存失败，请重新截图。");
      return;
    }

    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      sourceWidth,
      sourceHeight
    );

    const cropped = await createImageFromDataUrl(
      canvas.toDataURL("image/png"),
      "区域截图",
      card?.id ?? "draft"
    );
    addImages([cropped]);
    setCropImageUrl(null);
    setCropSelection(null);
    setIsSelectingCrop(false);
  }

  function insertUsageTable() {
    const tableTemplate = [
      "",
      "| 指标 | 复现前 | 复现后 | 备注 |",
      "| --- | --- | --- | --- |",
      "| 示例指标 |  |  |  |",
      ""
    ].join("\n");

    updateForm("usageResult", `${form.usageResult}${tableTemplate}`);
  }

  async function handleUsageImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    if (!files.length) {
      return;
    }

    const markdownImages = await Promise.all(
      files.map(async (file) => {
        const dataUrl = await fileToDataUrl(file);
        return `![${file.name}](${dataUrl})`;
      })
    );

    updateForm(
      "usageResult",
      [form.usageResult, ...markdownImages].filter(Boolean).join("\n\n")
    );
    event.target.value = "";
  }

  function handleSetCover(imageId: string) {
    setForm((current) => ({
      ...current,
      coverImageId: imageId,
      images: current.images.map((image) => ({
        ...image,
        type: image.id === imageId ? "cover" : image.type === "cover" ? "gallery" : image.type
      }))
    }));
  }

  function handleImageCaptionChange(imageId: string, caption: string) {
    setForm((current) => ({
      ...current,
      images: current.images.map((image) =>
        image.id === imageId ? { ...image, caption } : image
      )
    }));
  }

  function handleDeleteImage(imageId: string) {
    setForm((current) => {
      const nextImages = current.images.filter((image) => image.id !== imageId);
      const nextCoverImageId =
        current.coverImageId === imageId ? nextImages[0]?.id : current.coverImageId;

      return {
        ...current,
        images: nextImages,
        coverImageId: nextCoverImageId
      };
    });
  }

  function handleCreateCollection() {
    const collectionName = newCollectionName.trim();

    if (!collectionName) {
      return;
    }

    const collection = onCreateCollection(collectionName);
    lastCreatedCollectionId.current = collection.id;
    updateForm("collectionId", collection.id);
    setNewCollectionName("");
    setShowNewCollectionInput(false);
  }

  function handleSubmit() {
    const now = new Date().toISOString();
    const cardId = card?.id ?? createId("card");
    const title = form.title.trim() || "未命名 Trick";
    const images = form.images.map((image) => ({
      ...image,
      cardId,
      type: image.id === form.coverImageId ? "cover" : image.type
    }));

    const nextCard: TrickCard = {
      id: cardId,
      title,
      subtitle: form.subtitle.trim() || undefined,
      description: form.description.trim() || "暂未补充描述。",
      collectionId: form.collectionId,
      tags: splitTags(form.tags),
      domain: form.domain.trim() || undefined,
      difficulty: card?.difficulty,
      status: form.status,
      problem: form.problem.trim() || "暂未补充 problem。",
      solution: form.solution.trim() || "暂未补充 solution。",
      benefits: splitLines(form.benefits),
      costs: splitLines(form.costs),
      tradeoffs: splitLines(form.tradeoffs),
      applicableScenarios: splitLines(form.applicableScenarios),
      unsuitableScenarios: card?.unsuitableScenarios ?? [],
      notes: form.note.trim()
        ? [
            {
              id: card?.notes[0]?.id ?? createId("note"),
              content: form.note.trim(),
              createdAt: card?.notes[0]?.createdAt ?? now
            }
          ]
        : [],
      sources: form.sourceTitle.trim()
        ? [
            {
              id: card?.sources[0]?.id ?? createId("source"),
              title: form.sourceTitle.trim(),
              type: form.sourceType,
              url: form.sourceUrl.trim() || undefined,
              authors: form.sourceAuthors.trim()
                ? form.sourceAuthors.split(/[、,，]/).map((a) => a.trim()).filter(Boolean)
                : undefined,
              year: form.sourceYear ? Number(form.sourceYear) : undefined
            }
          ]
        : [],
      usages: form.usageResult.trim()
        ? [
            {
              id: card?.usages[0]?.id ?? createId("usage"),
              projectName: "复现效果",
              scenario: "",
              result: form.usageResult.trim(),
              success: card?.usages[0]?.success ?? true,
              createdAt: card?.usages[0]?.createdAt ?? now
            }
          ]
        : [],
      relatedCardIds: card?.relatedCardIds ?? [],
      coverImageId: form.coverImageId,
      images,
      createdAt: card?.createdAt ?? now,
      updatedAt: now
    };

    onSave(nextCard);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6 animate-modal-backdrop"
      onMouseDown={() => setIsTextDragging(false)}
      onMouseMove={(e) => {
        if (e.buttons === 1) setIsTextDragging(true);
      }}
      onClick={(event) => {
        if (!isTextDragging && event.target === event.currentTarget) onClose();
      }}
      onPaste={async (event) => {
        const files = Array.from(event.clipboardData.files).filter((file) =>
          file.type.startsWith("image/")
        );

        // Tauri webview: clipboardData.files 通常为空，需从 items 手动提取
        if (!files.length) {
          const items = event.clipboardData.items;
          for (let i = 0; i < items.length; i++) {
            if (items[i].type.startsWith("image/")) {
              const blob = items[i].getAsFile();
              if (blob) files.push(blob);
            }
          }
        }

        if (!files.length) {
          // Tauri fallback: 用 clipboard-manager 插件读取
          try {
            const { readImage } = await import("@tauri-apps/plugin-clipboard-manager");
            const image = await readImage();
            const [rgba, { width, height }] = await Promise.all([image.rgba(), image.size()]);
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d")!;
            const imgData = new ImageData(new Uint8ClampedArray(rgba), width, height);
            ctx.putImageData(imgData, 0, 0);
            const dataUrl = canvas.toDataURL("image/png");
            const img = await createImageFromDataUrl(
              dataUrl,
              "粘贴截图",
              card?.id ?? "draft"
            );
            addImages([img]);
          } catch {
            /* 非 Tauri 环境或剪贴板无图片，静默忽略 */
          }
          return;
        }

        event.preventDefault();
        const pastedImages = await Promise.all(
          files.map(async (file) => {
            const dataUrl = await fileToDataUrl(file);
            return createImageFromDataUrl(
              dataUrl,
              "粘贴截图",
              card?.id ?? "draft"
            );
          })
        );
        addImages(pastedImages);
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-surface shadow-panel animate-modal-panel">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold tracking-[0.18em] text-slate-500">
              {isEditing ? "编辑卡片" : "新建卡片"}
            </div>
            <h2 className="mt-1 text-xl font-semibold text-text-main">
              {isEditing ? "编辑结构化卡片" : "快速创建卡片"}
            </h2>
            {aiError ? (
              <div className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] text-rose-700">
                {aiError}
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAICompletion}
              disabled={aiLoading || !form.title.trim()}
              title="基于标题/描述/来源，让 LLM 自动填充 problem/solution/benefits/costs/..."
              className="flex h-10 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-medium text-white shadow-soft disabled:cursor-not-allowed disabled:opacity-60"
            >
              {aiLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {aiLoading ? "AI 思考中…" : "AI 补全"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-border text-slate-500"
              aria-label="关闭"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {aiToast ? (
            <div className="basis-full rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] text-emerald-700">
              {aiToast}
            </div>
          ) : null}
        </div>

        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6 p-6">
            <section className="grid gap-4 md:grid-cols-2">
              <Field label="标题">
                <input
                  className={inputClass}
                  value={form.title}
                  onChange={(event) => updateForm("title", event.target.value)}
                  placeholder="例如：OCR-aware Parsing Pipeline"
                />
              </Field>
              <Field label="副标题">
                <input
                  className={inputClass}
                  value={form.subtitle}
                  onChange={(event) => updateForm("subtitle", event.target.value)}
                  placeholder="一句话补充定位"
                />
              </Field>
              <Field label="专栏">
                <div className="space-y-3">
                  <select
                    className={inputClass}
                    value={
                      showNewCollectionInput
                        ? CREATE_COLLECTION_VALUE
                        : form.collectionId
                    }
                    onChange={(event) => {
                      if (event.target.value === CREATE_COLLECTION_VALUE) {
                        setShowNewCollectionInput(true);
                        return;
                      }

                      setShowNewCollectionInput(false);
                      updateForm("collectionId", event.target.value);
                    }}
                  >
                    {collections.map((collection) => (
                      <option key={collection.id} value={collection.id}>
                        {collection.name}
                      </option>
                    ))}
                    <option value={CREATE_COLLECTION_VALUE}>+ 新建专栏</option>
                  </select>
                  {showNewCollectionInput ? (
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                      <input
                        className={inputClass}
                        value={newCollectionName}
                        onChange={(event) =>
                          setNewCollectionName(event.target.value)
                        }
                        placeholder="输入新专栏名，例如：产品灵感"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleCreateCollection}
                        disabled={!newCollectionName.trim()}
                        className="flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-white px-3 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        <FolderPlus className="h-4 w-4" />
                        创建
                      </button>
                    </div>
                  ) : null}
                </div>
              </Field>
              <Field label="状态">
                <select
                  className={inputClass}
                  value={form.status}
                  onChange={(event) =>
                    updateForm("status", event.target.value as CardStatus)
                  }
                >
                  {Object.entries(statusMeta).map(([status, meta]) => (
                    <option key={status} value={status}>
                      {meta.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="标签">
                <input
                  className={inputClass}
                  value={form.tags}
                  onChange={(event) => updateForm("tags", event.target.value)}
                  placeholder="VLM, RAG, OCR"
                />
              </Field>
            </section>

            <Field label="一句话描述">
              <textarea
                className={textareaClass}
                value={form.description}
                onChange={(event) => updateForm("description", event.target.value)}
                placeholder="这个 trick 解决什么、为什么值得复用。"
              />
            </Field>

            <section className="grid gap-4 md:grid-cols-2">
              <Field label="问题">
                <textarea
                  className={textareaClass}
                  value={form.problem}
                  onChange={(event) => updateForm("problem", event.target.value)}
                  placeholder="这个 trick 解决什么问题？"
                />
              </Field>
              <Field label="解决方案">
                <textarea
                  className={textareaClass}
                  value={form.solution}
                  onChange={(event) => updateForm("solution", event.target.value)}
                  placeholder="核心做法是什么？"
                />
              </Field>
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <Field label="收益">
                <textarea
                  className={textareaClass}
                  value={form.benefits}
                  onChange={(event) => updateForm("benefits", event.target.value)}
                  placeholder={"每行一个收益\n例如：降低推理成本"}
                />
              </Field>
              <Field label="代价">
                <textarea
                  className={textareaClass}
                  value={form.costs}
                  onChange={(event) => updateForm("costs", event.target.value)}
                  placeholder={"每行一个代价\n例如：前处理链路变复杂"}
                />
              </Field>
              <Field label="权衡取舍">
                <textarea
                  className={textareaClass}
                  value={form.tradeoffs}
                  onChange={(event) => updateForm("tradeoffs", event.target.value)}
                  placeholder="每行一个取舍"
                />
              </Field>
              <Field label="适用场景">
                <textarea
                  className={textareaClass}
                  value={form.applicableScenarios}
                  onChange={(event) =>
                    updateForm("applicableScenarios", event.target.value)
                  }
                  placeholder="每行一个适用场景"
                />
              </Field>
            </section>

            <section>
              <Field label="心得笔记">
                <textarea
                  className={textareaClass}
                  value={form.note}
                  onChange={(event) => updateForm("note", event.target.value)}
                  placeholder="自己的理解或项目经验"
                />
              </Field>
            </section>

            <section>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  效果
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={insertUsageTable}
                    className="flex h-9 items-center gap-2 rounded-xl border border-border bg-white px-3 text-sm font-medium text-slate-700"
                  >
                    <Table2 className="h-4 w-4" />
                    表格
                  </button>
                  <label className="flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-border bg-white px-3 text-sm font-medium text-slate-700">
                    <ImagePlus className="h-4 w-4" />
                    图片
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleUsageImageUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
              <textarea
                className={`${textareaClass} mt-2 min-h-44 font-mono`}
                value={form.usageResult}
                onChange={(event) =>
                  updateForm("usageResult", event.target.value)
                }
                placeholder={
                  "支持 Markdown、图片和表格。\n\n例如：\n- 复现结论：成功\n- 关键参数：...\n\n| 指标 | 结果 |\n| --- | --- |\n| 准确率 | 95% |"
                }
              />
            </section>

            <section className="space-y-3">
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px_120px]">
                <Field label="来源名称">
                  <input
                    className={inputClass}
                    value={form.sourceTitle}
                    onChange={(event) =>
                      updateForm("sourceTitle", event.target.value)
                    }
                    placeholder={
                      form.sourceType === "paper"
                        ? "例：Attention Is All You Need"
                        : form.sourceType === "blog"
                          ? "例：How We Scaled RAG to 10M Docs"
                          : form.sourceType === "repo"
                            ? "例：langchain-ai/langchain"
                            : form.sourceType === "course"
                              ? "例：Stanford CS25 · Transformers"
                              : "来源标题"
                    }
                  />
                </Field>
                <Field label="来源类型">
                  <select
                    className={inputClass}
                    value={form.sourceType}
                    onChange={(event) =>
                      updateForm("sourceType", event.target.value as SourceType)
                    }
                  >
                    {sourceTypeOptions.map((type) => (
                      <option key={type} value={type}>
                        {sourceTypeLabels[type]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="年份">
                  <input
                    className={inputClass}
                    value={form.sourceYear}
                    onChange={(event) =>
                      updateForm("sourceYear", event.target.value)
                    }
                    inputMode="numeric"
                    placeholder="2026"
                  />
                </Field>
              </div>
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <Field label="链接">
                  <input
                    className={inputClass}
                    value={form.sourceUrl}
                    onChange={(event) =>
                      updateForm("sourceUrl", event.target.value)
                    }
                    placeholder={
                      form.sourceType === "paper"
                        ? "https://arxiv.org/abs/... 或 DOI 链接"
                        : form.sourceType === "repo"
                          ? "https://github.com/..."
                          : "https://..."
                    }
                  />
                </Field>
                <Field label="作者 / 出处（用、分隔）">
                  <input
                    className={inputClass}
                    value={form.sourceAuthors}
                    onChange={(event) =>
                      updateForm("sourceAuthors", event.target.value)
                    }
                    placeholder={
                      form.sourceType === "paper"
                        ? "例：Vaswani、Shazeer、Parmar"
                        : form.sourceType === "blog"
                          ? "例：OpenAI Engineering Blog"
                          : "作者或出处"
                    }
                  />
                </Field>
              </div>
            </section>
          </div>

          <aside
            className={cn(
              "border-t border-border bg-slate-50 p-6 lg:border-l lg:border-t-0 transition-colors",
              isDraggingOver && "bg-primary-soft/40 ring-2 ring-inset ring-primary/30"
            )}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDraggingOver(true);
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDraggingOver(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (e.currentTarget.contains(e.relatedTarget as Node)) return;
              setIsDraggingOver(false);
            }}
            onDrop={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDraggingOver(false);
              const files = Array.from(e.dataTransfer.files).filter((f) =>
                f.type.startsWith("image/")
              );
              if (!files.length) return;
              const droppedImages = await Promise.all(
                files.map(async (file) => {
                  const url = await fileToDataUrl(file);
                  return createImageFromDataUrl(url, file.name, card?.id ?? "draft");
                })
              );
              addImages(droppedImages);
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-text-main">图片</div>
                <div className="mt-1 text-sm text-text-secondary">
                  {form.images.length} 张，封面可单独指定
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={handleCaptureScreenshot}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-white text-slate-700"
                  aria-label="截图"
                  title="截图"
                >
                  <Camera className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handlePasteScreenshot}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-white text-slate-700"
                  aria-label="粘贴截图"
                  title="粘贴截图"
                >
                  <ClipboardPaste className="h-4 w-4" />
                </button>
                <label
                  className="flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-primary px-3 text-sm font-medium text-white"
                  title="上传图片"
                >
                  <Upload className="h-4 w-4" />
                  上传
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {coverImage ? (
              <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-white">
                <div className="aspect-[16/9]">
                  <AsyncImage
                    src={coverImage.url}
                    alt={coverImage.title ?? "cover image"}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="border-t border-border px-4 py-3 text-sm text-slate-500">
                  当前封面
                </div>
              </div>
            ) : (
              <div className="mt-5 flex aspect-[16/9] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-white text-sm text-slate-500">
                <ImagePlus className="mb-2 h-5 w-5" />
                {isDraggingOver ? "松开即可上传" : "拖拽图片到此处，或使用上方按钮"}
              </div>
            )}

            <div className="mt-5 space-y-3">
              {form.images.map((image) => (
                <div
                  key={image.id}
                  className={cn(
                    "rounded-2xl border bg-white p-3",
                    image.id === form.coverImageId
                      ? "border-primary"
                      : "border-border"
                  )}
                >
                  <div className="flex gap-3">
                    <div className="h-16 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                      <AsyncImage
                        src={image.url}
                        alt={image.title ?? "card image"}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-text-main">
                        {image.title ?? "Untitled image"}
                      </div>
                      <input
                        value={image.caption ?? ""}
                        onChange={(event) =>
                          handleImageCaptionChange(image.id, event.target.value)
                        }
                        placeholder="caption"
                        className="mt-2 h-9 w-full rounded-lg border border-border px-2 text-sm outline-none focus:border-primary"
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => handleSetCover(image.id)}
                      className="flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm text-slate-700"
                    >
                      <Star className="h-4 w-4" />
                      设为封面
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteImage(image.id)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-danger"
                      aria-label="删除图片"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-xl border border-border px-4 text-sm font-medium text-slate-700"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-white"
          >
            <Save className="h-4 w-4" />
            保存卡片
          </button>
        </div>
      </div>

      {cropImageUrl ? (
        <div className="fixed inset-0 z-[60] flex flex-col bg-slate-950/90">
          <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4 text-white">
            <div>
              <div className="text-sm font-semibold">框选截图区域</div>
              <div className="mt-1 text-sm text-slate-300">
                拖拽选择需要保存的部分，松开后点击保存。
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setCropImageUrl(null);
                  setCropSelection(null);
                  setIsSelectingCrop(false);
                }}
                className="h-10 rounded-xl border border-white/15 px-4 text-sm font-medium text-slate-100"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveCrop}
                className="h-10 rounded-xl bg-primary px-4 text-sm font-medium text-white"
              >
                保存选区
              </button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-6">
            <div
              className="relative inline-block cursor-crosshair select-none"
              onPointerDown={handleCropPointerDown}
              onPointerMove={handleCropPointerMove}
              onPointerUp={handleCropPointerUp}
              onPointerCancel={handleCropPointerUp}
            >
              <img
                ref={cropImageRef}
                src={cropImageUrl}
                alt="待裁剪截图"
                className="block max-h-[78vh] max-w-full rounded-xl border border-white/20 object-contain"
                draggable={false}
              />
              {cropSelection ? (
                <div
                  className="pointer-events-none absolute border-2 border-blue-400 bg-blue-500/15 shadow-[0_0_0_9999px_rgba(2,6,23,0.45)]"
                  style={{
                    left: normalizeSelection(cropSelection).x,
                    top: normalizeSelection(cropSelection).y,
                    width: normalizeSelection(cropSelection).width,
                    height: normalizeSelection(cropSelection).height
                  }}
                />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
