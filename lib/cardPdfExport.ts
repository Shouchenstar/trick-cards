import type { Collection, TrickCard } from "@/lib/types";
import { resolveImageSrc } from "@/lib/imageStorage";
import {
  getCardCover,
  getSourceTypeLabel,
  isCardSectionHidden,
  statusMeta
} from "@/lib/utils";

type PdfImage = {
  id: string;
  src: string;
  title?: string;
  caption?: string;
};

const PRINT_IFRAME_ID = "trick-card-pdf-print-frame";

function escapeHtml(value: string | number | undefined | null) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value: string | undefined | null) {
  return escapeHtml(value);
}

function normalizeFileName(value: string) {
  return (
    value
      .trim()
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, " ")
      .slice(0, 80) || "trick-card"
  );
}

function renderInlineMarkdown(text: string) {
  const parts = text.split(
    /(`[^`]+`|\*\*[^*]+\*\*|!\[[^\]]*\]\([^)]+\)|\[[^\]]+\]\([^)]+\))/g
  );

  return parts
    .map((part) => {
      const imageMatch = part.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      if (imageMatch) {
        return `<img class="markdown-image" src="${escapeAttribute(imageMatch[2])}" alt="${escapeAttribute(imageMatch[1])}" />`;
      }

      const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        return `<a href="${escapeAttribute(linkMatch[2])}">${escapeHtml(linkMatch[1])}</a>`;
      }

      if (part.startsWith("**") && part.endsWith("**")) {
        return `<strong>${escapeHtml(part.slice(2, -2))}</strong>`;
      }

      if (part.startsWith("`") && part.endsWith("`")) {
        return `<code>${escapeHtml(part.slice(1, -1))}</code>`;
      }

      return escapeHtml(part);
    })
    .join("");
}

function isTableBlock(lines: string[]) {
  return (
    lines.length >= 2 &&
    lines[0].includes("|") &&
    /^\s*\|?[\s:-]+\|[\s|:-]*$/.test(lines[1])
  );
}

function parseTable(lines: string[]) {
  return lines.map((line) =>
    line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim())
  );
}

function renderMarkdown(content: string) {
  const trimmed = content.trim();
  if (!trimmed) return `<p class="muted">暂无内容。</p>`;

  const lines = trimmed.split(/\r?\n/);
  const blocks: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const tableLines: string[] = [];
    let tableIndex = index;
    while (tableIndex < lines.length && lines[tableIndex].includes("|")) {
      tableLines.push(lines[tableIndex]);
      tableIndex += 1;
    }

    if (isTableBlock(tableLines)) {
      const rows = parseTable(tableLines);
      const header = rows[0] ?? [];
      const bodyRows = rows.slice(2);
      blocks.push(`
        <table>
          <thead>
            <tr>${header.map((cell) => `<th>${renderInlineMarkdown(cell)}</th>`).join("")}</tr>
          </thead>
          <tbody>
            ${bodyRows
              .map(
                (row) =>
                  `<tr>${row
                    .map((cell) => `<td>${renderInlineMarkdown(cell)}</td>`)
                    .join("")}</tr>`
              )
              .join("")}
          </tbody>
        </table>
      `);
      index = tableIndex;
      continue;
    }

    if (line.startsWith("### ")) {
      blocks.push(`<h4>${renderInlineMarkdown(line.slice(4))}</h4>`);
      index += 1;
      continue;
    }

    if (line.startsWith("## ")) {
      blocks.push(`<h3>${renderInlineMarkdown(line.slice(3))}</h3>`);
      index += 1;
      continue;
    }

    if (line.startsWith("# ")) {
      blocks.push(`<h2>${renderInlineMarkdown(line.slice(2))}</h2>`);
      index += 1;
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*[-*]\s+/, ""));
        index += 1;
      }
      blocks.push(
        `<ul>${items.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join("")}</ul>`
      );
      continue;
    }

    const paragraphLines = [line];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !lines[index].includes("|") &&
      !/^#{1,3}\s/.test(lines[index]) &&
      !/^\s*[-*]\s+/.test(lines[index])
    ) {
      paragraphLines.push(lines[index]);
      index += 1;
    }
    blocks.push(`<p>${renderInlineMarkdown(paragraphLines.join(" "))}</p>`);
  }

  return blocks.join("");
}

function renderTagList(items: string[]) {
  if (!items.length) return `<p class="muted">暂无内容。</p>`;
  return `<div class="tags">${items
    .map((item) => `<span>${escapeHtml(item)}</span>`)
    .join("")}</div>`;
}

function renderBulletList(items: string[]) {
  if (!items.length) return `<p class="muted">暂无内容。</p>`;
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function renderSection(title: string, body: string) {
  return `
    <section>
      <h2>${escapeHtml(title)}</h2>
      ${body}
    </section>
  `;
}

async function resolveCardImages(card: TrickCard): Promise<PdfImage[]> {
  const cover = getCardCover(card);
  const orderedImages = [
    ...(cover ? [cover] : []),
    ...card.images.filter((image) => image.id !== cover?.id)
  ];

  return Promise.all(
    orderedImages.map(async (image) => ({
      id: image.id,
      src: await resolveImageSrc(image.url),
      title: image.title,
      caption: image.caption
    }))
  );
}

function buildCardHtml(
  card: TrickCard,
  collection: Collection,
  relatedCards: TrickCard[],
  images: PdfImage[]
) {
  const status = statusMeta[card.status];
  const title = normalizeFileName(card.title);
  const imageHtml = images
    .map(
      (image) => `
        <figure>
          <img src="${escapeAttribute(image.src)}" alt="${escapeAttribute(
            image.title ?? card.title
          )}" />
          ${
            image.caption || image.title
              ? `<figcaption>${escapeHtml(image.caption ?? image.title)}</figcaption>`
              : ""
          }
        </figure>
      `
    )
    .join("");

  const sourceHtml = card.sources.length
    ? card.sources
        .map(
          (source) => `
            <div class="source-item">
              <strong>${escapeHtml(source.title)}</strong>
              <div class="muted">
                ${escapeHtml(getSourceTypeLabel(source.type))}
                ${source.authors?.length ? ` · ${escapeHtml(source.authors.join("、"))}` : ""}
                ${source.year ? ` · ${escapeHtml(source.year)}` : ""}
              </div>
              ${source.url ? `<a href="${escapeAttribute(source.url)}">${escapeHtml(source.url)}</a>` : ""}
              ${source.note ? `<p>${escapeHtml(source.note)}</p>` : ""}
            </div>
          `
        )
        .join("")
    : `<p class="muted">暂无来源。</p>`;

  const notesHtml = card.notes.length
    ? card.notes
        .map((note) => `<div class="note">${renderMarkdown(note.content)}</div>`)
        .join("")
    : `<p class="muted">暂无心得笔记。</p>`;

  const usageHtml = card.usages.length
    ? card.usages
        .map((usage) => `<div class="note">${renderMarkdown(usage.result)}</div>`)
        .join("")
    : `<p class="muted">还没有复现效果。</p>`;

  const relatedHtml = relatedCards.length
    ? relatedCards
        .map(
          (relatedCard) => `
            <div class="related-item">
              <strong>${escapeHtml(relatedCard.title)}</strong>
              <p>${escapeHtml(relatedCard.description)}</p>
            </div>
          `
        )
        .join("")
    : `<p class="muted">暂无关联卡片。</p>`;

  const showBenefits =
    card.benefits.length > 0 && !isCardSectionHidden(card, "benefits");
  const showCosts = card.costs.length > 0 && !isCardSectionHidden(card, "costs");
  const showTradeoffs =
    card.tradeoffs.length > 0 && !isCardSectionHidden(card, "tradeoffs");
  const showApplicableScenarios =
    card.applicableScenarios.length > 0 &&
    !isCardSectionHidden(card, "applicableScenarios");

  const benefitsCostsHtml =
    showBenefits || showCosts
      ? `
        <section>
          <div class="grid">
            ${
              showBenefits
                ? `<div><h2>收益</h2>${renderBulletList(card.benefits)}</div>`
                : ""
            }
            ${
              showCosts
                ? `<div><h2>代价</h2>${renderBulletList(card.costs)}</div>`
                : ""
            }
          </div>
        </section>
      `
      : "";

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      @page {
        margin: 16mm;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        background: #ffffff;
        color: #172033;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
        font-size: 13px;
        line-height: 1.7;
      }

      a {
        color: #2563eb;
        word-break: break-all;
      }

      article {
        max-width: 820px;
        margin: 0 auto;
      }

      header {
        padding-bottom: 18px;
        border-bottom: 1px solid #dbe3ef;
      }

      h1 {
        margin: 14px 0 8px;
        color: #0f172a;
        font-size: 30px;
        line-height: 1.2;
      }

      h2 {
        margin: 0 0 10px;
        color: #0f172a;
        font-size: 16px;
      }

      h3,
      h4 {
        margin: 14px 0 8px;
        color: #0f172a;
      }

      p {
        margin: 0 0 10px;
      }

      section {
        break-inside: avoid;
        padding: 18px 0;
        border-bottom: 1px solid #edf1f7;
      }

      ul {
        margin: 0;
        padding-left: 20px;
      }

      li + li {
        margin-top: 6px;
      }

      code {
        border-radius: 4px;
        background: #f1f5f9;
        padding: 1px 5px;
        font-family: "SFMono-Regular", Consolas, monospace;
        font-size: 12px;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        margin: 8px 0 12px;
        font-size: 12px;
      }

      th,
      td {
        border: 1px solid #dbe3ef;
        padding: 7px 9px;
        vertical-align: top;
      }

      th {
        background: #f8fafc;
        color: #0f172a;
        text-align: left;
      }

      figure {
        break-inside: avoid;
        margin: 18px 0;
        border: 1px solid #dbe3ef;
        border-radius: 10px;
        overflow: hidden;
      }

      figure img,
      .markdown-image {
        display: block;
        max-width: 100%;
        max-height: 620px;
        margin: 0 auto;
        object-fit: contain;
      }

      figcaption {
        border-top: 1px solid #dbe3ef;
        padding: 8px 12px;
        color: #64748b;
        font-size: 12px;
      }

      .subtitle {
        color: #475569;
        font-size: 16px;
      }

      .description {
        color: #334155;
        font-size: 15px;
      }

      .meta,
      .tags {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .meta span,
      .tags span {
        border: 1px solid #dbe3ef;
        border-radius: 999px;
        padding: 2px 9px;
        color: #475569;
        font-size: 12px;
      }

      .collection {
        border-color: ${escapeHtml(collection.color)} !important;
        color: ${escapeHtml(collection.color)} !important;
      }

      .grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 18px;
      }

      .note,
      .source-item,
      .related-item {
        break-inside: avoid;
        margin-bottom: 12px;
        border: 1px solid #dbe3ef;
        border-radius: 10px;
        padding: 12px;
      }

      .related-item p {
        margin-top: 4px;
        color: #64748b;
      }

      .muted {
        color: #64748b;
      }

      @media print {
        body {
          print-color-adjust: exact;
          -webkit-print-color-adjust: exact;
        }
      }
    </style>
  </head>
  <body>
    <article>
      <header>
        <div class="meta">
          <span class="collection">${escapeHtml(collection.name)}</span>
          <span>${escapeHtml(status.label)}</span>
        </div>
        <h1>${escapeHtml(card.title)}</h1>
        ${card.subtitle ? `<p class="subtitle">${escapeHtml(card.subtitle)}</p>` : ""}
        <p class="description">${escapeHtml(card.description)}</p>
        ${renderTagList(card.tags)}
      </header>

      ${imageHtml}

      ${renderSection("问题", `<p>${escapeHtml(card.problem)}</p>`)}
      ${renderSection("解决方案", `<p>${escapeHtml(card.solution)}</p>`)}
      ${benefitsCostsHtml}
      ${showTradeoffs ? renderSection("权衡取舍", renderBulletList(card.tradeoffs)) : ""}
      ${
        showApplicableScenarios
          ? renderSection("适用场景", renderTagList(card.applicableScenarios))
          : ""
      }
      ${renderSection("心得笔记", notesHtml)}
      ${renderSection("来源", sourceHtml)}
      ${renderSection("效果", usageHtml)}
      ${renderSection("关联卡片", relatedHtml)}
    </article>
  </body>
</html>`;
}

async function waitForImages(documentRef: Document) {
  const images = Array.from(documentRef.images);
  await Promise.all(
    images.map((image) => {
      if (image.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        image.onload = () => resolve();
        image.onerror = () => resolve();
      });
    })
  );
}

export async function exportCardToPdf(
  card: TrickCard,
  collection: Collection,
  relatedCards: TrickCard[] = []
) {
  if (typeof window === "undefined") return;

  const previousFrame = document.getElementById(PRINT_IFRAME_ID);
  previousFrame?.remove();

  const frame = document.createElement("iframe");
  frame.id = PRINT_IFRAME_ID;
  frame.title = `导出 ${card.title}`;
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  frame.style.opacity = "0";
  frame.style.pointerEvents = "none";
  document.body.appendChild(frame);

  const images = await resolveCardImages(card);
  const html = buildCardHtml(card, collection, relatedCards, images);
  const frameWindow = frame.contentWindow;
  const frameDocument = frame.contentDocument;

  if (!frameWindow || !frameDocument) {
    frame.remove();
    window.alert("无法创建 PDF 导出窗口，请重试。");
    return;
  }

  frameDocument.open();
  frameDocument.write(html);
  frameDocument.close();

  await new Promise((resolve) => window.setTimeout(resolve, 100));
  await waitForImages(frameDocument);

  const cleanup = () => {
    window.setTimeout(() => frame.remove(), 1000);
    frameWindow.removeEventListener("afterprint", cleanup);
  };

  frameWindow.addEventListener("afterprint", cleanup);
  frameWindow.focus();
  frameWindow.print();
}
