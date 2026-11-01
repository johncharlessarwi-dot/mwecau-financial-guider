import { API_ORIGIN, API_UNAVAILABLE_MESSAGE } from "./apiConfig";

export class ApiRequestError extends Error {
  constructor(message: string, public readonly status: number | null) {
    super(message);
    this.name = "ApiRequestError";
  }
}

function readXsrfToken(): string {
  const item = document.cookie.split("; ").find(part => part.startsWith("XSRF-TOKEN="));
  return item ? decodeURIComponent(item.slice("XSRF-TOKEN=".length)) : "";
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!API_ORIGIN) throw new ApiRequestError(API_UNAVAILABLE_MESSAGE, null);
  const method = (options.method || "GET").toUpperCase();
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    let csrf: Response;
    try {
      csrf = await fetch(`${API_ORIGIN}/sanctum/csrf-cookie`, { credentials: "include", headers: { Accept: "application/json" } });
    } catch {
      throw new ApiRequestError("Unable to establish a secure API session. Check the API URL and connection.", null);
    }
    if (!csrf.ok) throw new ApiRequestError("Unable to establish a secure API session. Check the API URL and CORS settings.", csrf.status);
  }

  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body) headers.set("Content-Type", "application/json");
  const token = readXsrfToken();
  if (token) headers.set("X-XSRF-TOKEN", token);

  let response: Response;
  try {
    response = await fetch(`${API_ORIGIN}/api/v1${path}`, { ...options, method, credentials: "include", headers });
  } catch {
    throw new ApiRequestError("The finance API could not be reached. Check your connection and try again.", null);
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 422 && body.errors) {
      const first = Object.values(body.errors).flat()[0];
      throw new ApiRequestError(typeof first === "string" ? first : "Please check the information you entered.", 422);
    }
    if (response.status === 401) throw new ApiRequestError("Your session has expired. Please sign in again.", 401);
    if (response.status === 403) throw new ApiRequestError("Your account is no longer authorized to access this resource. Please sign in again.", 403);
    throw new ApiRequestError(body.message || "The request could not be completed.", response.status);
  }
  return body as T;
}
