import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Transport } from "../transport";

function res(status: number, body?: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => (body === undefined ? Promise.reject(new Error("no body")) : Promise.resolve(body)),
  };
}

describe("Transport diagnostics", () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "debug").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("is silent on 2xx", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res(201, {})));
    const t = new Transport("https://ingest.example/", "dsn");
    t.send({ message: "x" } as any);
    await t.drain();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(warn).not.toHaveBeenCalled();
  });

  it("warns with the server's detail on non-2xx", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res(403, { detail: "Invalid DSN." })));
    const t = new Transport("https://ingest.example/", "dsn");
    t.send({ message: "x" } as any);
    await vi.waitFor(() => expect(warn).toHaveBeenCalled());
    expect(warn.mock.calls[0][0]).toBe(
      "booboo: event rejected by https://ingest.example/: HTTP 403 Invalid DSN.",
    );
  });

  it("warns when the endpoint is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const t = new Transport("https://ingest.example/", "dsn");
    t.send({ message: "x" } as any);
    await vi.waitFor(() => expect(warn).toHaveBeenCalled());
    expect(warn.mock.calls[0][0]).toContain("could not reach https://ingest.example/");
  });

  it("rate-limits warnings per cause", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res(403, { detail: "Invalid DSN." })));
    const t = new Transport("https://ingest.example/", "dsn");
    for (let i = 0; i < 5; i++) t.send({ message: "x" } as any);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(5));
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("warns at construction when the DSN is empty", () => {
    new Transport("https://ingest.example/", "");
    expect(warn).toHaveBeenCalledWith("booboo: no DSN configured — events will not be sent");
  });

  it("debug logs each send", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res(201, {})));
    const t = new Transport("https://ingest.example/", "dsn", { debug: true });
    t.send({ message: "x" } as any);
    await vi.waitFor(() =>
      expect(console.debug).toHaveBeenCalledWith("booboo: event sent (HTTP 201)"),
    );
  });
});
