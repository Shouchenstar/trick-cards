/**
 * 在默认浏览器中打开外部 URL。
 * Tauri 环境使用 opener plugin，普通浏览器使用 window.open。
 */
export async function openExternal(url: string) {
  try {
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(url);
      return;
    }
  } catch {
    // fallback
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
