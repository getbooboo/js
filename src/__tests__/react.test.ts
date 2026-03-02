import { afterEach, describe, expect, it, vi } from "vitest";

// Mock react before importing react.ts (optional peer dep, not installed in test env)
vi.mock("react", () => ({
  Component: class Component {
    render() { return null; }
  },
}));

import { getClient, init } from "../index";
import { boobooQueryIntegration } from "../react";

// Mock enrichFrames to skip source fetching
vi.mock("../source", () => ({
  enrichFrames: vi.fn((frames) => Promise.resolve(frames)),
}));

// Mock Transport
vi.mock("../transport", () => ({
  Transport: vi.fn().mockImplementation(() => ({
    send: vi.fn(),
    drain: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe("boobooQueryIntegration", () => {
  afterEach(() => {
    getClient()?.destroy();
  });

  it("returns correct shape with queryCache and mutationCache", () => {
    const integration = boobooQueryIntegration();
    expect(integration).toHaveProperty("queryCache");
    expect(integration).toHaveProperty("mutationCache");
    expect(typeof integration.queryCache.onError).toBe("function");
    expect(typeof integration.mutationCache.onError).toBe("function");
  });

  it("queryCache.onError calls captureException with query context", () => {
    const client = init({ dsn: "test-dsn", breadcrumbs: false });
    const spy = vi.spyOn(client, "captureException");
    const integration = boobooQueryIntegration();

    const error = new Error("query failed");
    const query = { queryHash: '["users"]', queryKey: ["users"] };
    integration.queryCache.onError(error, query);
    expect(spy).toHaveBeenCalledWith(error, {
      tanstackQuery: {
        queryHash: '["users"]',
        queryKey: ["users"],
      },
    });
  });

  it("mutationCache.onError calls captureException with mutation context", () => {
    const client = init({ dsn: "test-dsn", breadcrumbs: false });
    const spy = vi.spyOn(client, "captureException");
    const integration = boobooQueryIntegration();

    const error = new Error("mutation failed");
    const mutation = { mutationId: 1, options: { mutationKey: ["updateUser"] } };
    integration.mutationCache.onError(error, {}, undefined, mutation);
    expect(spy).toHaveBeenCalledWith(error, {
      tanstackQuery: {
        mutationId: 1,
        mutationKey: ["updateUser"],
      },
    });
  });

  it("wraps non-Error values in Error", () => {
    const client = init({ dsn: "test-dsn", breadcrumbs: false });
    const spy = vi.spyOn(client, "captureException");
    const integration = boobooQueryIntegration();

    const query = { queryHash: '["data"]', queryKey: ["data"] };
    integration.queryCache.onError("string error", query);
    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(spy.mock.calls[0][0].message).toBe("string error");
  });
});
