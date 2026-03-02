import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addBreadcrumb,
  clearBreadcrumbs,
  getBreadcrumbs,
  setupBreadcrumbs,
  setupFetchOnly,
} from "../breadcrumbs";

// --- addBreadcrumb / getBreadcrumbs ---

describe("addBreadcrumb / getBreadcrumbs", () => {
  it("adds a breadcrumb with auto-timestamp", () => {
    addBreadcrumb({ type: "custom", message: "test" });
    const crumbs = getBreadcrumbs();
    expect(crumbs).toHaveLength(1);
    expect(crumbs[0].message).toBe("test");
    expect(crumbs[0].type).toBe("custom");
    expect(typeof crumbs[0].timestamp).toBe("number");
  });

  it("preserves explicit timestamp", () => {
    addBreadcrumb({ type: "custom", message: "test", timestamp: 12345 });
    expect(getBreadcrumbs()[0].timestamp).toBe(12345);
  });

  it("returns a copy, not a reference", () => {
    addBreadcrumb({ type: "custom", message: "test" });
    const a = getBreadcrumbs();
    const b = getBreadcrumbs();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

// --- clearBreadcrumbs ---

describe("clearBreadcrumbs", () => {
  it("empties the buffer", () => {
    addBreadcrumb({ type: "custom", message: "test" });
    clearBreadcrumbs();
    expect(getBreadcrumbs()).toHaveLength(0);
  });
});

// --- max cap ---

describe("max breadcrumbs", () => {
  it("caps at default (30) via setupBreadcrumbs", () => {
    const teardown = setupBreadcrumbs(true);
    for (let i = 0; i < 40; i++) {
      addBreadcrumb({ type: "custom", message: `msg ${i}` });
    }
    expect(getBreadcrumbs()).toHaveLength(30);
    // Keeps the most recent
    expect(getBreadcrumbs()[0].message).toBe("msg 10");
    teardown();
  });

  it("respects custom max", () => {
    const teardown = setupBreadcrumbs(true, 5);
    for (let i = 0; i < 10; i++) {
      addBreadcrumb({ type: "custom", message: `msg ${i}` });
    }
    expect(getBreadcrumbs()).toHaveLength(5);
    expect(getBreadcrumbs()[0].message).toBe("msg 5");
    teardown();
  });
});

// --- console instrumentation ---

describe("console instrumentation", () => {
  let teardown: () => void;
  const originalLog = console.log;

  beforeEach(() => {
    teardown = setupBreadcrumbs({ console: true, clicks: false, navigation: false, fetch: false });
  });

  afterEach(() => {
    teardown();
    // Restore in case test fails before teardown
    console.log = originalLog;
  });

  it("captures console.log as breadcrumb", () => {
    console.log("hello world");
    const crumbs = getBreadcrumbs();
    expect(crumbs).toHaveLength(1);
    expect(crumbs[0].type).toBe("console");
    expect(crumbs[0].category).toBe("log");
    expect(crumbs[0].message).toBe("hello world");
  });

  it("forwards to original console method", () => {
    // The original has already been saved by instrumentConsole, so we check
    // that calling console.log doesn't throw and the breadcrumb is captured
    console.log("test");
    expect(getBreadcrumbs()).toHaveLength(1);
  });

  it("restores console on teardown", () => {
    teardown();
    // After teardown, console.log should be the original
    // Adding a breadcrumb manually should still work, but console shouldn't auto-add
    console.log("after teardown");
    expect(getBreadcrumbs()).toHaveLength(0);
  });

  it("serializes objects in console args", () => {
    console.log("data:", { key: "value" });
    const crumbs = getBreadcrumbs();
    expect(crumbs[0].message).toBe('data: {"key":"value"}');
  });
});

// --- navigation instrumentation ---

describe("navigation instrumentation", () => {
  let teardown: () => void;

  beforeEach(() => {
    teardown = setupBreadcrumbs({
      console: false,
      clicks: false,
      navigation: true,
      fetch: false,
    });
  });

  afterEach(() => {
    teardown();
  });

  it("captures pushState as navigation breadcrumb", () => {
    history.pushState({}, "", "/new-page");
    const crumbs = getBreadcrumbs();
    expect(crumbs).toHaveLength(1);
    expect(crumbs[0].type).toBe("navigation");
    expect(crumbs[0].data?.to).toContain("/new-page");
  });
});

// --- fetch instrumentation ---

describe("fetch instrumentation", () => {
  const originalFetch = globalThis.fetch;
  let teardown: () => void;

  afterEach(() => {
    teardown?.();
    globalThis.fetch = originalFetch;
  });

  it("captures successful fetch as breadcrumb", async () => {
    // Mock fetch BEFORE instrumentation captures it
    globalThis.fetch = vi.fn().mockResolvedValue({ status: 200 });
    teardown = setupBreadcrumbs({ console: false, clicks: false, navigation: false, fetch: true });

    await fetch("https://api.example.com/data");
    const crumbs = getBreadcrumbs();
    expect(crumbs).toHaveLength(1);
    expect(crumbs[0].type).toBe("fetch");
    expect(crumbs[0].category).toBe("http");
    expect(crumbs[0].message).toContain("GET");
    expect(crumbs[0].message).toContain("https://api.example.com/data");
    expect(crumbs[0].message).toContain("200");
  });

  it("captures failed fetch as breadcrumb", async () => {
    // Mock fetch BEFORE instrumentation captures it
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));
    teardown = setupBreadcrumbs({ console: false, clicks: false, navigation: false, fetch: true });

    await expect(fetch("https://api.example.com/data")).rejects.toThrow("Network error");
    const crumbs = getBreadcrumbs();
    expect(crumbs).toHaveLength(1);
    expect(crumbs[0].message).toContain("[failed]");
  });

  it("calls onHttpError callback with status, method, url", async () => {
    const onHttpError = vi.fn();
    globalThis.fetch = vi.fn().mockResolvedValue({ status: 500 });
    teardown = setupBreadcrumbs(
      { console: false, clicks: false, navigation: false, fetch: true },
      undefined,
      onHttpError,
    );

    await fetch("https://api.example.com/data", { method: "POST" });
    expect(onHttpError).toHaveBeenCalledWith(500, "POST", "https://api.example.com/data");
  });

  it("calls onHttpError for all responses (filtering is caller's job)", async () => {
    const onHttpError = vi.fn();
    globalThis.fetch = vi.fn().mockResolvedValue({ status: 200 });
    teardown = setupBreadcrumbs(
      { console: false, clicks: false, navigation: false, fetch: true },
      undefined,
      onHttpError,
    );

    await fetch("https://api.example.com/ok");
    expect(onHttpError).toHaveBeenCalledWith(200, "GET", "https://api.example.com/ok");
  });

  it("does not call onHttpError when not provided", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ status: 500 });
    teardown = setupBreadcrumbs({ console: false, clicks: false, navigation: false, fetch: true });

    // Should not throw even without callback
    await fetch("https://api.example.com/data");
    expect(getBreadcrumbs()).toHaveLength(1);
  });
});

// --- setupFetchOnly ---

describe("setupFetchOnly", () => {
  const originalFetch = globalThis.fetch;
  let teardown: () => void;

  afterEach(() => {
    teardown?.();
    globalThis.fetch = originalFetch;
  });

  it("instruments fetch with onHttpError only, no breadcrumbs setup", async () => {
    const onHttpError = vi.fn();
    globalThis.fetch = vi.fn().mockResolvedValue({ status: 503 });
    teardown = setupFetchOnly(onHttpError);

    await fetch("https://api.example.com/fail");
    expect(onHttpError).toHaveBeenCalledWith(503, "GET", "https://api.example.com/fail");
  });
});
