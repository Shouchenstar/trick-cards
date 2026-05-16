/**
 * 图片存储抽象层：
 * - Tauri 桌面端：把图片字节写入 app data 目录的 images/，localStorage 只存绝对路径标记
 * - 普通浏览器：保留原 data: URL 行为
 *
 * 存储格式约定（写入卡片的 image.url 字段）：
 *   - "tauri-img:{absolute_path}"  → 实体在磁盘
 *   - "data:image/...;base64,..."   → 旧格式，仍兼容
 *   - "https://..." / "http://..."  → 外链
 */

const DISK_PREFIX = "tauri-img:";

function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__
  );
}

/**
 * 把 data URL 解析为字节 + 扩展名。
 */
function parseDataUrl(dataUrl: string): { bytes: Uint8Array; ext: string } | null {
  const match = dataUrl.match(/^data:image\/([a-zA-Z0-9+.\-]+);base64,(.+)$/);
  if (!match) return null;
  let ext = match[1].toLowerCase();
  if (ext === "jpeg") ext = "jpg";
  if (ext === "svg+xml") ext = "svg";
  try {
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return { bytes, ext };
  } catch {
    return null;
  }
}

/**
 * 把 data URL 落盘，返回新的 url 标记。
 * 非 Tauri 环境直接返回原 data URL。
 */
export async function persistImage(dataUrl: string): Promise<string> {
  if (!isTauri()) return dataUrl;
  if (!dataUrl.startsWith("data:image/")) return dataUrl; // 外链或已是磁盘路径
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return dataUrl;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const path = await invoke<string>("save_image", {
      bytes: Array.from(parsed.bytes),
      ext: parsed.ext
    });
    return `${DISK_PREFIX}${path}`;
  } catch (err) {
    console.warn("[imageStorage] persistImage 失败，回退 data URL", err);
    return dataUrl;
  }
}

/**
 * 把卡片里 image.url 字段渲染为 <img src> 可识别的字符串。
 *  - 磁盘路径 → 异步调用 convertFileSrc 转 asset 协议 URL
 *  - 其它（data: / http(s):）→ 原样返回
 */
let cachedConvertFileSrc: ((filePath: string, protocol?: string) => string) | null | undefined;

async function getConvertFileSrc() {
  if (cachedConvertFileSrc !== undefined) return cachedConvertFileSrc;
  try {
    const mod = await import("@tauri-apps/api/core");
    cachedConvertFileSrc = mod.convertFileSrc;
  } catch {
    cachedConvertFileSrc = null;
  }
  return cachedConvertFileSrc;
}

export async function resolveImageSrc(url: string | undefined | null): Promise<string> {
  if (!url) return "";
  if (!url.startsWith(DISK_PREFIX)) return url;
  const path = url.slice(DISK_PREFIX.length);
  if (!isTauri()) return path;
  const convertFileSrc = await getConvertFileSrc();
  if (convertFileSrc) {
    return convertFileSrc(path);
  }
  const normalized = path.replace(/\\/g, "/");
  return `https://asset.localhost/${encodeURI(normalized)}`;
}

/**
 * 同步版本的 resolveImageSrc，仅用于非磁盘路径（data: URL、外链）的快速返回。
 * 如果遇到磁盘路径，返回空字符串——调用方应使用异步版 resolveImageSrc。
 */
export function resolveImageSrcSync(url: string | undefined | null): string {
  if (!url) return "";
  if (!url.startsWith(DISK_PREFIX)) return url;
  return ""; // 磁盘路径必须走异步版
}

export function isDiskImage(url: string | undefined | null): boolean {
  return Boolean(url && url.startsWith(DISK_PREFIX));
}

/**
 * 把一组卡片里所有 data: URL 图片迁移到磁盘。返回 [迁移后的卡片数组, 迁移图片张数]。
 * 非 Tauri 环境直接原样返回。
 */
export async function migrateCardImagesToDisk<T extends { images?: Array<{ url: string }> }>(
  cards: T[]
): Promise<{ cards: T[]; migrated: number }> {
  if (!isTauri()) return { cards, migrated: 0 };
  let migrated = 0;
  const next = await Promise.all(
    cards.map(async (card) => {
      if (!card.images?.length) return card;
      let changed = false;
      const newImages = await Promise.all(
        card.images.map(async (img) => {
          if (!img.url?.startsWith("data:image/")) return img;
          const persisted = await persistImage(img.url);
          if (persisted !== img.url) {
            migrated++;
            changed = true;
            return { ...img, url: persisted };
          }
          return img;
        })
      );
      return changed ? { ...card, images: newImages } : card;
    })
  );
  return { cards: next, migrated };
}

export async function deleteImage(url: string): Promise<void> {
  if (!isTauri() || !url.startsWith(DISK_PREFIX)) return;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("delete_image", { path: url.slice(DISK_PREFIX.length) });
  } catch {
    /* ignore */
  }
}
