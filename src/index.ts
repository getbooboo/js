import { BoobooClient } from "./client";
import type { BoobooEvent, BoobooOptions, BoobooUser, Breadcrumb } from "./types";

export type {
  BoobooOptions,
  BoobooEvent,
  BoobooUser,
  StackFrame,
  Breadcrumb,
  BreadcrumbOptions,
} from "./types";
export { parseStack } from "./stacktrace";

let client: BoobooClient | null = null;

export function init(options: BoobooOptions): BoobooClient {
  if (client) {
    client.destroy();
  }
  client = new BoobooClient(options);
  return client;
}

export function captureException(error: Error, extra?: Record<string, unknown>): void {
  client?.captureException(error, extra);
}

export function captureMessage(message: string, level?: "error" | "warning" | "info"): void {
  client?.captureMessage(message, level);
}

export function addBreadcrumb(crumb: Omit<Breadcrumb, "timestamp"> & { timestamp?: number }): void {
  client?.addBreadcrumb(crumb);
}

export function setUser(user: BoobooUser | null): void {
  client?.setUser(user);
}

export function getClient(): BoobooClient | null {
  return client;
}

export async function flush(): Promise<void> {
  await client?.flush();
}

export function axiosErrorInterceptor(options?: { statuses?: number[] }) {
  const statuses = options?.statuses ?? [500, 501, 502, 503, 504];
  return (error: unknown): Promise<never> => {
    const ax = error as {
      response?: { status?: number };
      config?: { method?: string; url?: string };
    };
    if (ax?.response?.status && statuses.includes(ax.response.status)) {
      const err =
        error instanceof Error
          ? error
          : new Error(
              `HTTP ${ax.response.status}: ${(ax.config?.method || "GET").toUpperCase()} ${ax.config?.url || "unknown"}`,
            );
      err.name = "HttpError";
      captureException(err);
    }
    return Promise.reject(error);
  };
}
