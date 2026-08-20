import type { BoobooEvent } from "./types";

export interface TransportOptions {
  /** Log every send and drop to the console (init({ debug: true })). */
  debug?: boolean;
}

const WARN_INTERVAL_MS = 60_000;

/**
 * Delivers events to the ingest endpoint.
 *
 * Delivery failures are reported with `console.warn` — rate-limited to one per
 * minute per cause — so a wrong DSN (403), an exhausted quota (429) or an
 * unreachable endpoint shows up in the devtools console instead of looking
 * like "no errors yet".
 */
export class Transport {
  private endpoint: string;
  private dsn: string;
  private queue: BoobooEvent[] = [];
  private flushing = false;
  private debug: boolean;
  private lastWarning = new Map<string, number>();

  constructor(endpoint: string, dsn: string, options: TransportOptions = {}) {
    this.endpoint = endpoint;
    this.dsn = dsn;
    this.debug = !!options.debug;

    if (!dsn) this.warn("no-dsn", "booboo: no DSN configured — events will not be sent");
    if (this.debug) console.debug(`booboo: initialised, endpoint=${endpoint}`);

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") this.flush();
      });
    }
    if (typeof window !== "undefined") {
      window.addEventListener("pagehide", () => this.flush());
    }
  }

  send(event: BoobooEvent): void {
    this.queue.push(event);
    this.drain();
  }

  async drain(): Promise<void> {
    if (this.flushing) return;
    this.flushing = true;

    while (this.queue.length > 0) {
      const event = this.queue.shift()!;
      try {
        const res = await this.post(event);
        await this.report(res);
      } catch (err) {
        this.warn("transport", `booboo: could not reach ${this.endpoint}: ${String(err)}`);
      }
    }

    this.flushing = false;
  }

  flush(): void {
    while (this.queue.length > 0) {
      const event = this.queue.shift()!;
      try {
        // Fire-and-forget on page hide: the response may never arrive, but a
        // rejection that does come back is still worth a warning.
        this.post(event)
          .then((res) => this.report(res))
          .catch((err) =>
            this.warn("transport", `booboo: could not reach ${this.endpoint}: ${String(err)}`),
          );
      } catch (err) {
        this.warn("transport", `booboo: could not reach ${this.endpoint}: ${String(err)}`);
      }
    }
  }

  private post(event: BoobooEvent): Promise<Response> {
    return fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Booboo-DSN": this.dsn,
      },
      body: JSON.stringify(event),
      keepalive: true,
    });
  }

  private async report(res: Response | undefined): Promise<void> {
    if (!res || typeof res.status !== "number") return;
    if (res.ok) {
      if (this.debug) console.debug(`booboo: event sent (HTTP ${res.status})`);
      return;
    }
    let detail = "";
    try {
      const body = await res.json();
      detail = (body && (body.detail as string)) || JSON.stringify(body).slice(0, 200);
    } catch {
      /* non-JSON body */
    }
    this.warn(
      `http-${res.status}`,
      `booboo: event rejected by ${this.endpoint}: HTTP ${res.status} ${detail}`.trim(),
    );
  }

  private warn(key: string, message: string): void {
    const now = Date.now();
    const last = this.lastWarning.get(key) ?? Number.NEGATIVE_INFINITY;
    if (this.debug || now - last >= WARN_INTERVAL_MS) {
      this.lastWarning.set(key, now);
      if (typeof console !== "undefined") console.warn(message);
    }
  }
}
