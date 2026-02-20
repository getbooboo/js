import type { BoobooEvent } from "./types";

export class Transport {
  private endpoint: string;
  private dsn: string;
  private queue: BoobooEvent[] = [];
  private flushing = false;

  constructor(endpoint: string, dsn: string) {
    this.endpoint = endpoint;
    this.dsn = dsn;

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

  private async drain(): Promise<void> {
    if (this.flushing) return;
    this.flushing = true;

    while (this.queue.length > 0) {
      const event = this.queue.shift()!;
      try {
        await fetch(this.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Booboo-DSN": this.dsn,
          },
          body: JSON.stringify(event),
          keepalive: true,
        });
      } catch {
        // Silent failure — no retry for MVP
      }
    }

    this.flushing = false;
  }

  flush(): void {
    while (this.queue.length > 0) {
      const event = this.queue.shift()!;
      try {
        fetch(this.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Booboo-DSN": this.dsn,
          },
          body: JSON.stringify(event),
          keepalive: true,
        });
      } catch {
        // Silent failure
      }
    }
  }
}
