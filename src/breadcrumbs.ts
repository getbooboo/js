import type { Breadcrumb, BreadcrumbOptions } from "./types";

const DEFAULT_MAX = 30;

let breadcrumbBuffer: Breadcrumb[] = [];
let maxBreadcrumbs = DEFAULT_MAX;

export function getBreadcrumbs(): Breadcrumb[] {
  return breadcrumbBuffer.slice();
}

export function addBreadcrumb(crumb: Omit<Breadcrumb, "timestamp"> & { timestamp?: number }): void {
  breadcrumbBuffer.push({
    ...crumb,
    timestamp: crumb.timestamp ?? Date.now(),
  });
  if (breadcrumbBuffer.length > maxBreadcrumbs) {
    breadcrumbBuffer = breadcrumbBuffer.slice(-maxBreadcrumbs);
  }
}

export function clearBreadcrumbs(): void {
  breadcrumbBuffer = [];
}

type TeardownFn = () => void;

function instrumentConsole(): TeardownFn {
  const originals = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info,
    debug: console.debug,
  };

  for (const level of Object.keys(originals) as (keyof typeof originals)[]) {
    const original = originals[level];
    console[level] = function (...args: unknown[]) {
      addBreadcrumb({
        type: "console",
        category: level,
        message: args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "),
      });
      return original.apply(console, args);
    };
  }

  return () => {
    for (const level of Object.keys(originals) as (keyof typeof originals)[]) {
      console[level] = originals[level];
    }
  };
}

function instrumentClicks(): TeardownFn {
  const handler = (event: MouseEvent) => {
    const target = event.target as Element | null;
    if (!target) return;

    const tag = target.tagName?.toLowerCase() || "";
    const text = (target as HTMLElement).innerText?.slice(0, 50) || "";
    const id = target.id ? `#${target.id}` : "";
    const cls = target.className && typeof target.className === "string"
      ? `.${target.className.split(" ").slice(0, 2).join(".")}`
      : "";

    addBreadcrumb({
      type: "click",
      category: "ui",
      message: `${tag}${id}${cls}` + (text ? ` "${text}"` : ""),
    });
  };

  document.addEventListener("click", handler, true);
  return () => document.removeEventListener("click", handler, true);
}

function instrumentNavigation(): TeardownFn {
  const origPushState = history.pushState;
  const origReplaceState = history.replaceState;

  const record = (from: string, to: string) => {
    addBreadcrumb({
      type: "navigation",
      category: "navigation",
      message: `${from} -> ${to}`,
      data: { from, to },
    });
  };

  history.pushState = function (...args) {
    const from = location.href;
    origPushState.apply(this, args);
    record(from, location.href);
  };

  history.replaceState = function (...args) {
    const from = location.href;
    origReplaceState.apply(this, args);
    record(from, location.href);
  };

  const popHandler = () => {
    addBreadcrumb({
      type: "navigation",
      category: "navigation",
      message: `popstate -> ${location.href}`,
    });
  };
  window.addEventListener("popstate", popHandler);

  return () => {
    history.pushState = origPushState;
    history.replaceState = origReplaceState;
    window.removeEventListener("popstate", popHandler);
  };
}

function instrumentFetch(): TeardownFn {
  const origFetch = window.fetch;

  window.fetch = async function (input, init) {
    const method = init?.method?.toUpperCase() || "GET";
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const start = Date.now();

    try {
      const response = await origFetch.apply(this, [input, init]);
      addBreadcrumb({
        type: "fetch",
        category: "http",
        message: `${method} ${url} [${response.status}]`,
        data: { method, url, status: response.status, duration: Date.now() - start },
      });
      return response;
    } catch (err) {
      addBreadcrumb({
        type: "fetch",
        category: "http",
        message: `${method} ${url} [failed]`,
        data: { method, url, duration: Date.now() - start },
      });
      throw err;
    }
  };

  return () => {
    window.fetch = origFetch;
  };
}

export function setupBreadcrumbs(
  options: boolean | BreadcrumbOptions,
  max?: number,
): TeardownFn {
  maxBreadcrumbs = max ?? DEFAULT_MAX;
  breadcrumbBuffer = [];

  const teardowns: TeardownFn[] = [];
  const opts: BreadcrumbOptions =
    typeof options === "boolean"
      ? { console: true, clicks: true, navigation: true, fetch: true }
      : options;

  if (opts.console !== false) teardowns.push(instrumentConsole());
  if (opts.clicks !== false) teardowns.push(instrumentClicks());
  if (opts.navigation !== false) teardowns.push(instrumentNavigation());
  if (opts.fetch !== false) teardowns.push(instrumentFetch());

  return () => {
    for (const fn of teardowns) fn();
  };
}
