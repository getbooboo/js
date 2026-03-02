import { beforeEach, describe, expect, it, vi } from "vitest";
import { Transport } from "../transport";

describe("Transport", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
  });

  it("sends event with correct headers", async () => {
    const transport = new Transport("https://api.example.com/ingest/", "test-dsn");
    const event = { message: "test", level: "error" } as any;

    transport.send(event);
    // Wait for drain
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect(fetchMock).toHaveBeenCalledWith("https://api.example.com/ingest/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Booboo-DSN": "test-dsn",
      },
      body: JSON.stringify(event),
      keepalive: true,
    });
  });

  it("drains queue sequentially", async () => {
    const transport = new Transport("https://api.example.com/ingest/", "test-dsn");

    transport.send({ message: "first" } as any);
    transport.send({ message: "second" } as any);

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const firstBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(firstBody.message).toBe("first");
    expect(secondBody.message).toBe("second");
  });

  it("does not double-drain", async () => {
    // Make fetch slow so we can queue multiple events
    fetchMock.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ ok: true }), 50)),
    );
    const transport = new Transport("https://api.example.com/ingest/", "test-dsn");

    transport.send({ message: "a" } as any);
    transport.send({ message: "b" } as any);
    transport.send({ message: "c" } as any);

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3), { timeout: 1000 });
  });

  it("swallows fetch errors silently", async () => {
    fetchMock.mockRejectedValue(new Error("Network error"));
    const transport = new Transport("https://api.example.com/ingest/", "test-dsn");

    // Should not throw
    transport.send({ message: "test" } as any);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
  });

  it("flush sends synchronously with fetch", () => {
    const transport = new Transport("https://api.example.com/ingest/", "test-dsn");

    // Queue an event without calling drain
    (transport as any).queue.push({ message: "flush-test" });
    transport.flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.message).toBe("flush-test");
  });

  it("drain() is callable and resolves", async () => {
    const transport = new Transport("https://api.example.com/ingest/", "test-dsn");
    await expect(transport.drain()).resolves.toBeUndefined();
  });

  it("drain() resolves after sending queued events", async () => {
    const transport = new Transport("https://api.example.com/ingest/", "test-dsn");
    transport.send({ message: "drain-test" } as any);
    await transport.drain();
    expect(fetchMock).toHaveBeenCalled();
  });
});
