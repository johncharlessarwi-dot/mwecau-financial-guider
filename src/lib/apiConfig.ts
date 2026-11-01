/**
 * Only a real HTTPS Laravel API origin may handle financial credentials in production.
 * Do not silently fall back to localhost or to a static Worker/Pages frontend.
 */
export const API_UNAVAILABLE_MESSAGE =
  "Sign-in and account creation are temporarily unavailable because the secure finance API is not connected yet.";

export function resolveApiOrigin(configured: string | undefined, production: boolean): string | null {
  const candidate = configured?.trim();
  if (!candidate) return production ? null : "http://localhost:8000";

  try {
    const url = new URL(candidate);
    const secure = url.protocol === "https:";
    const allowedProtocol = secure || (!production && url.protocol === "http:");
    if (!allowedProtocol || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

export const API_ORIGIN = resolveApiOrigin(import.meta.env.VITE_API_URL, import.meta.env.PROD);
export const isApiConfigured = API_ORIGIN !== null;
