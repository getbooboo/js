import type { BoobooOptions, BoobooEvent, BoobooUser, Breadcrumb } from "./types";
import { BoobooClient } from "./client";

export type { BoobooOptions, BoobooEvent, BoobooUser, StackFrame, Breadcrumb, BreadcrumbOptions } from "./types";
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
