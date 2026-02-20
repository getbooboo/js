import type { BoobooOptions, BoobooEvent, BoobooUser, StackFrame } from "./types";
import { parseStack } from "./stacktrace";
import { enrichFrames } from "./source";
import { setupBreadcrumbs, getBreadcrumbs, addBreadcrumb, clearBreadcrumbs } from "./breadcrumbs";
import { Transport } from "./transport";

const DEFAULT_ENDPOINT = "https://api.booboo.dev/ingest/";

export class BoobooClient {
  private options: BoobooOptions;
  private transport: Transport;
  private teardownBreadcrumbs?: () => void;
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

    // Setup breadcrumbs
    if (options.breadcrumbs !== false) {
      this.teardownBreadcrumbs = setupBreadcrumbs(
        options.breadcrumbs ?? true,
        options.maxBreadcrumbs,
      );
    }

    // Initial user from options
    if (options.user) {
      this.user = options.user;
    }
  }

  setUser(user: BoobooUser | null): void {
    this.user = user;
  }

  captureException(error: Error, extra?: Record<string, unknown>): void {
    const frames = parseStack(error);
    // Fire-and-forget: enrich frames with source context, then send
    enrichFrames(frames).then((enriched) => {
      const event = this.buildEvent(
        error.message,
        error.constructor.name || "Error",
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
        sdk: { name: "@booboo.dev/js", version: "0.3.0" },
      },
      request: {
        url: window.location.href,
        headers: {
          "User-Agent": navigator.userAgent,
        },
      },
      tags: { ...this.options.tags, runtime: "browser" },
    };
  }

  private sendEvent(event: BoobooEvent): void {
    if (this.options.beforeSend) {
      const modified = this.options.beforeSend(event);
      if (modified === null) return;
      event = modified;
    }
    this.transport.send(event);
  }
}
