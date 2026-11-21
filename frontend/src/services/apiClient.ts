import { appConfig } from "../app/config";

const BACKEND_UNREACHABLE_MESSAGE = `The local backend service is not reachable. Please make sure the backend is running at ${appConfig.apiBaseUrl.replace(/\/api\/v\d+\/?$/, "")}.`;
// Long enough for large workbooks and PDF generation, short enough that a hung backend surfaces an error.
const REQUEST_TIMEOUT_MS = 120_000;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface ApiBlobResponse {
  blob: Blob;
  headers: Headers;
}

function backendRootUrl() {
  return appConfig.apiBaseUrl.replace(/\/api\/v\d+\/?$/, "");
}

/** Swaps 127.0.0.1 <-> localhost on the same port, for machines where one of them doesn't resolve. */
function alternateLoopbackUrl(input: string) {
  const url = new URL(input);
  if (url.hostname === "127.0.0.1") url.hostname = "localhost";
  else if (url.hostname === "localhost") url.hostname = "127.0.0.1";
  else return null;
  return url.toString();
}

function unreachableMessage(url: string, fallbackUrl: string | null, cause: unknown) {
  const detail = cause instanceof Error && cause.message ? ` ${cause.message}` : "";
  const tried = fallbackUrl ? ` Tried ${url} and ${fallbackUrl}.` : ` Tried ${url}.`;
  return `${BACKEND_UNREACHABLE_MESSAGE}${tried}${detail}`;
}

function isTimeout(cause: unknown) {
  return cause instanceof DOMException && (cause.name === "TimeoutError" || cause.name === "AbortError");
}

async function fetchLocal(input: string, init?: RequestInit) {
  const method = (init?.method ?? "GET").toUpperCase();
  // Retrying a write on the other loopback name could apply it twice, so only reads fall back.
  const fallbackUrl = method === "GET" || method === "HEAD" ? alternateLoopbackUrl(input) : null;
  const withTimeout = (): RequestInit => ({ ...init, signal: init?.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  let firstCause: unknown;

  try {
    return await fetch(input, withTimeout());
  } catch (cause) {
    if (isTimeout(cause)) throw new ApiError(0, "REQUEST_TIMEOUT", "The local service took too long to respond. Try again.");
    firstCause = cause;
  }

  if (fallbackUrl) {
    try {
      return await fetch(fallbackUrl, withTimeout());
    } catch {
      // Preserve the first failure because it points at the configured API URL.
    }
  }

  throw new ApiError(0, "BACKEND_UNREACHABLE", unreachableMessage(input, fallbackUrl, firstCause));
}

/** FastAPI returns `detail` as a string for HTTPException and as a list of issues for 422 validation errors. */
function errorDetail(detail: unknown): string | null {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => (item && typeof item === "object" && "msg" in item ? String((item as { msg: unknown }).msg) : null))
      .filter(Boolean);
    return messages.length ? messages.join(" ") : null;
  }
  return null;
}

async function toApiError(response: Response, fallbackCode: string, fallbackMessage: string) {
  const body = (await response.json().catch(() => ({}))) as { code?: string; detail?: unknown };
  const message = errorDetail(body.detail) ?? `${fallbackMessage} (HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""})`;
  return new ApiError(response.status, body.code ?? fallbackCode, message);
}

function mergeHeaders(defaults: Record<string, string>, extra?: HeadersInit) {
  const headers = new Headers(defaults);
  new Headers(extra).forEach((value, key) => headers.set(key, value));
  return headers;
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetchLocal(`${appConfig.apiBaseUrl}${path}`, {
    ...init,
    headers: mergeHeaders({ Accept: "application/json" }, init?.headers),
  });
  if (!response.ok) throw await toApiError(response, "API_ERROR", "The local service could not complete the request.");
  if (response.status === 204) return undefined as T;
  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError(response.status, "INVALID_RESPONSE", "The local service returned an unreadable response.");
  }
}

export async function apiBlobWithHeaders(path: string, body: unknown): Promise<ApiBlobResponse> {
  const response = await fetchLocal(`${appConfig.apiBaseUrl}${path}`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/pdf",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw await toApiError(response, "REPORT_ERROR", "The local PDF service could not create the report.");
  return { blob: await response.blob(), headers: response.headers };
}

export async function checkBackendHealth(): Promise<void> {
  const response = await fetchLocal(`${backendRootUrl()}/health`, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new ApiError(response.status, "BACKEND_HEALTH_FAILED", BACKEND_UNREACHABLE_MESSAGE);
  }
}
