import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BoobooClient } from "../client";
import { Transport } from "../transport";

// Mock enrichFrames to return frames as-is (skip source fetching)
vi.mock("../source", () => ({
  enrichFrames: vi.fn((frames) => Promise.resolve(frames)),
}));

// Mock Transport — capture send calls via a shared array
const sendCalls: any[] = [];
vi.mock("../transport", () => ({
  Transport: vi.fn().mockImplementation(() => ({
    send: vi.fn((event: any) => sendCalls.push(event)),
  })),
}));

describe("BoobooClient", () => {
  let client: BoobooClient;
  let prevOnError: typeof window.onerror;
  let prevOnUnhandledRejection: typeof window.onunhandledrejection;

  beforeEach(() => {
    prevOnError = window.onerror;
    prevOnUnhandledRejection = window.onunhandledrejection;
    sendCalls.length = 0;

    client = new BoobooClient({
      dsn: "test-dsn",
      endpoint: "https://api.example.com/ingest/",
      environment: "test",
      breadcrumbs: false, // Disable to avoid side effects in tests
    });
  });

  afterEach(() => {
    client.destroy();
    window.onerror = prevOnError;
    window.onunhandledrejection = prevOnUnhandledRejection;
  });

  it("installs window.onerror handler", () => {
    expect(window.onerror).not.toBe(prevOnError);
  });

  it("installs window.onunhandledrejection handler", () => {
    expect(window.onunhandledrejection).not.toBe(prevOnUnhandledRejection);
  });

  it("restores handlers on destroy", () => {
    client.destroy();
    expect(window.onerror).toBe(prevOnError);
    expect(window.onunhandledrejection).toBe(prevOnUnhandledRejection);
  });

  it("captureException sends event with correct shape", async () => {
    const error = new Error("test error");
    client.captureException(error);

    // Wait for async enrichFrames
    await vi.waitFor(() => expect(sendCalls.length).toBeGreaterThan(0));

    const event = sendCalls[0];
    expect(event.message).toBe("test error");
    expect(event.exception_type).toBe("Error");
    expect(event.level).toBe("error");
    expect(event.environment).toBe("test");
    expect(event.tags.runtime).toBe("browser");
    expect(event.context.sdk.name).toBe("@booboo.dev/js");
    expect(event.context.browser).toBeDefined();
    expect(event.request.url).toBeDefined();
  });

  it("captureException includes user context via setUser", async () => {
    client.setUser({ id: "42", email: "test@example.com" });
    client.captureException(new Error("test"));

    await vi.waitFor(() => expect(sendCalls.length).toBeGreaterThan(0));

    expect(sendCalls[0].context.user).toEqual({ id: "42", email: "test@example.com" });
  });

  it("setUser(null) clears user context", async () => {
    client.setUser({ id: "42" });
    client.setUser(null);
    client.captureException(new Error("test"));

    await vi.waitFor(() => expect(sendCalls.length).toBeGreaterThan(0));

    expect(sendCalls[0].context.user).toBeUndefined();
  });

  it("captureMessage sends with default error level", () => {
    client.captureMessage("something happened");

    expect(sendCalls).toHaveLength(1);
    expect(sendCalls[0].message).toBe("something happened");
    expect(sendCalls[0].level).toBe("error");
    expect(sendCalls[0].exception_type).toBe("Error");
  });

  it("captureMessage accepts custom level", () => {
    client.captureMessage("info message", "info");
    expect(sendCalls[0].level).toBe("info");
  });

  it("beforeSend can modify event", async () => {
    const clientWithHook = new BoobooClient({
      dsn: "test-dsn",
      endpoint: "https://api.example.com/ingest/",
      breadcrumbs: false,
      beforeSend: (event) => ({ ...event, message: "modified" }),
    });

    clientWithHook.captureException(new Error("original"));
    await vi.waitFor(() => expect(sendCalls.length).toBeGreaterThan(0));

    expect(sendCalls[0].message).toBe("modified");
    clientWithHook.destroy();
  });

  it("beforeSend returning null drops event", async () => {
    sendCalls.length = 0;
    const clientWithHook = new BoobooClient({
      dsn: "test-dsn",
      endpoint: "https://api.example.com/ingest/",
      breadcrumbs: false,
      beforeSend: () => null,
    });

    clientWithHook.captureException(new Error("should be dropped"));
    // Give time for the async path
    await new Promise((r) => setTimeout(r, 50));

    expect(sendCalls).toHaveLength(0);
    clientWithHook.destroy();
  });
});
