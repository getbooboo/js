import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Transport } from "../transport";

describe("Transport.handshake", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({}) });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("posts {handshake:true, sdk} with the DSN header", async () => {
    const t = new Transport("https://ingest.example/", "dsn");
    t.handshake("js/0.9.0");
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://ingest.example/");
    expect(init.headers["X-Booboo-DSN"]).toBe("dsn");
    expect(JSON.parse(init.body)).toEqual({ handshake: true, sdk: "js/0.9.0" });
  });

  it("does nothing without a DSN", () => {
    const t = new Transport("https://ingest.example/", "");
    t.handshake("js/0.9.0");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
