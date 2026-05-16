import type { ReactNode } from "react";

type MarkdownPreviewProps = {
  content: string;
  compact?: boolean;
};

function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|!\[[^\]]*\]\([^)]+\)|\[[^\]]+\]\([^)]+\))/g);

  return parts.map((part, index) => {
    const key = `${part}-${index}`;
    const imageMatch = part.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);

    if (imageMatch) {
      return (
        <img
          key={key}
          src={imageMatch[2]}
          alt={imageMatch[1] || "markdown image"}
          className="my-3 max-h-80 w-full rounded-xl border border-border object-contain"
        />
      );
    }

    if (linkMatch) {
      return (
        <a
          key={key}
          href={linkMatch[2]}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-primary underline underline-offset-4"
        >
          {linkMatch[1]}
        </a>
      );
    }

    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={key} className="font-semibold text-text-main">
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={key} className="rounded bg-slate-100 px-1.5 py-0.5 text-sm">
          {part.slice(1, -1)}
        </code>
      );
    }

    return part;
  });
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

export function MarkdownPreview({ content, compact = false }: MarkdownPreviewProps) {
  const trimmedContent = content.trim();

  if (!trimmedContent) {
    return <div className="text-slate-500">暂未补充。</div>;
  }

  const lines = trimmedContent.split(/\r?\n/);
  const blocks: ReactNode[] = [];
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
      const header = rows[0];
      const bodyRows = rows.slice(2);

      blocks.push(
        <div key={`table-${index}`} className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr>
                {header.map((cell) => (
                  <th
                    key={cell}
                    className="border border-border bg-slate-50 px-3 py-2 font-semibold text-text-main"
                  >
                    {renderInline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row, rowIndex) => (
                <tr key={`${row.join("-")}-${rowIndex}`}>
                  {row.map((cell, cellIndex) => (
                    <td
                      key={`${cell}-${cellIndex}`}
                      className="border border-border px-3 py-2 text-slate-700"
                    >
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      index = tableIndex;
      continue;
    }

    if (line.startsWith("### ")) {
      blocks.push(
        <h4 key={index} className="text-base font-semibold text-text-main">
          {renderInline(line.slice(4))}
        </h4>
      );
      index += 1;
      continue;
    }

    if (line.startsWith("## ")) {
      blocks.push(
        <h3 key={index} className="text-lg font-semibold text-text-main">
          {renderInline(line.slice(3))}
        </h3>
      );
      index += 1;
      continue;
    }

    if (line.startsWith("# ")) {
      blocks.push(
        <h2 key={index} className="text-xl font-semibold text-text-main">
          {renderInline(line.slice(2))}
        </h2>
      );
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
        <ul key={`ul-${index}`} className="list-disc space-y-1 pl-5">
          {items.map((item) => (
            <li key={item}>{renderInline(item)}</li>
          ))}
        </ul>
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

    blocks.push(
      <p key={`p-${index}`} className={compact ? "leading-6" : "leading-8"}>
        {renderInline(paragraphLines.join(" "))}
      </p>
    );
  }

  return <div className="space-y-4">{blocks}</div>;
}
