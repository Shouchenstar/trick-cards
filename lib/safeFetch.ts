/**
 * 跨环境 fetch 封装：
 * - Tauri 桌面端：通过 @tauri-apps/plugin-http 由 Rust 发起请求，绕开浏览器 CORS
 * - 普通浏览器：使用原生 fetch
 *
 * 用法与 fetch 完全一致。
 */

type FetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

let cachedFetch: FetchFn | null = null;
let detected = false;

function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  // Tauri v2 注入的全局对象
  return Boolean(
    (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__
  );
}

async function resolveFetch(): Promise<FetchFn> {
  if (cachedFetch) return cachedFetch;
  if (detected) return fetch;
  detected = true;

  if (isTauri()) {
    try {
      const mod = await import("@tauri-apps/plugin-http");
      cachedFetch = mod.fetch as FetchFn;
      return cachedFetch;
    } catch {
      // fallback to native fetch
    }
  }
  return fetch;
}

export async function safeFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const f = await resolveFetch();
  return f(input, init);
}
