import { addBreadcrumb, clearBreadcrumbs, getBreadcrumbs, setupBreadcrumbs, setupFetchOnly } from "./breadcrumbs";
import { enrichFrames } from "./source";
import { parseStack } from "./stacktrace";
import { Transport } from "./transport";
import type { BoobooEvent, BoobooOptions, BoobooUser, StackFrame } from "./types";

declare const __SDK_VERSION__: string;

const DEFAULT_ENDPOINT = "https://api.booboo.dev/ingest/";

export class BoobooClient {
  private options: BoobooOptions;
  private transport: Transport;
  private teardownBreadcrumbs?: () => void;
  private teardownFetchOnly?: () => void;
  private prevOnError?: OnErrorEventHandler;
  private prevOnUnhandledRejection?: ((ev: PromiseRejectionEvent) => void) | null;
  private user: BoobooUser | null = null;

  constructor(options: BoobooOptions) {
    this.options = options;
    const endpoint = options.endpoint || DEFAULT_ENDPOINT;
    this.transport = new Transport(endpoint, options.dsn);

    // Install global handlers
    this.prevOnError = window.onerror;
    window.onerror = (message, source, lineno, colno, error) => {
      if (error) {
        this.captureException(error);
      } else {
        this.captureMessage(String(message));
      }
      if (typeof this.prevOnError === "function") {
        this.prevOnError(message, source, lineno, colno, error);
      }
    };

    this.prevOnUnhandledRejection = window.onunhandledrejection;
    window.onunhandledrejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      if (reason instanceof Error) {
        this.captureException(reason);
      } else {
        this.captureMessage(String(reason));
      }
      if (typeof this.prevOnUnhandledRejection === "function") {
        this.prevOnUnhandledRejection(event);
      }
    };

    // Build HTTP error callback
    let httpErrorCallback: ((status: number, method: string, url: string) => void) | undefined;
    if (options.captureHttpErrors) {
      let statuses: number[] | null = null;
      let targets: (string | RegExp)[] | null = null;

      if (Array.isArray(options.captureHttpErrors)) {
        statuses = options.captureHttpErrors;
      } else if (typeof options.captureHttpErrors === "object") {
        statuses = options.captureHttpErrors.statuses ?? null;
        targets = options.captureHttpErrors.targets ?? null;
      }

      httpErrorCallback = (status: number, method: string, url: string) => {
        const statusMatch = statuses
          ? statuses.includes(status)
          : status >= 500 && status <= 599;
        const targetMatch = targets
          ? targets.some(t => typeof t === "string" ? url.includes(t) : t.test(url))
          : true;
        if (statusMatch && targetMatch) {
          const error = new Error(`HTTP ${status}: ${method} ${url}`);
          error.name = "HttpError";
          this.captureException(error, { http: { status, method, url } });
        }
      };
    }

    // Setup breadcrumbs
    if (options.breadcrumbs !== false) {
      this.teardownBreadcrumbs = setupBreadcrumbs(
        options.breadcrumbs ?? true,
        options.maxBreadcrumbs,
        httpErrorCallback,
      );
    } else if (httpErrorCallback) {
      // Breadcrumbs disabled but HTTP capture enabled — install fetch-only instrumentation
      this.teardownFetchOnly = setupFetchOnly(httpErrorCallback);
    }

    // Initial user from options
    if (options.user) {
      this.user = options.user;
    }
  }

  setUser(user: BoobooUser | null): void {
    this.user = user;
  }

  async flush(): Promise<void> {
    await this.transport.drain();
  }

  captureException(error: Error, extra?: Record<string, unknown>): void {
    const frames = parseStack(error);
    // Fire-and-forget: enrich frames with source context, then send
    enrichFrames(frames).then((enriched) => {
      const event = this.buildEvent(
        error.message,
        error.name || error.constructor.name || "Error",
        enriched,
        extra,
      );
      this.sendEvent(event);
    });
  }

  captureMessage(message: string, level: "error" | "warning" | "info" = "error"): void {
    const event = this.buildEvent(message, "Error", [], undefined, level);
    this.sendEvent(event);
  }

  addBreadcrumb(crumb: Parameters<typeof addBreadcrumb>[0]): void {
    addBreadcrumb(crumb);
  }

  destroy(): void {
    window.onerror = this.prevOnError ?? null;
    window.onunhandledrejection = this.prevOnUnhandledRejection ?? null;
    this.teardownBreadcrumbs?.();
    this.teardownFetchOnly?.();
    clearBreadcrumbs();
  }

  private buildEvent(
    message: string,
    exceptionType: string,
    stacktrace: StackFrame[],
    extra?: Record<string, unknown>,
    level: "error" | "warning" | "info" = "error",
  ): BoobooEvent {
    return {
      message,
      level,
      exception_type: exceptionType,
      stacktrace,
      context: {
        ...this.options.context,
        ...extra,
        ...(this.user ? { user: this.user } : {}),
        breadcrumbs: getBreadcrumbs(),
        browser: {
          url: window.location.href,
          userAgent: navigator.userAgent,
          screen: `${screen.width}x${screen.height}`,
          viewport: `${window.innerWidth}x${window.innerHeight}`,
        },
        sdk: { name: "@booboo.dev/js", version: __SDK_VERSION__ },
      },
      request: {
        url: window.location.href,
        headers: {
          "User-Agent": navigator.userAgent,
        },
      },
      tags: { ...this.options.tags, runtime: "browser" },
      environment: this.options.environment || "",
    };
  }

  private sendEvent(event: BoobooEvent): void {
    let eventToSend = event;
    if (this.options.beforeSend) {
      const modified = this.options.beforeSend(event);
      if (modified === null) return;
      eventToSend = modified;
    }
    this.transport.send(eventToSend);
  }
}
