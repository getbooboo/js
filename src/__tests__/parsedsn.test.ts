import { describe, expect, it, vi } from "vitest";

const sendMock = vi.fn();
const drainMock = vi.fn().mockResolvedValue(undefined);
const transportCtor = vi.fn();
vi.mock("../transport", () => ({
  Transport: vi.fn().mockImplementation((endpoint: string, dsn: string) => {
    transportCtor(endpoint, dsn);
    return { send: sendMock, drain: drainMock };
  }),
}));
vi.mock("../source", () => ({
  enrichFrames: vi.fn((frames) => Promise.resolve(frames)),
}));

import { BoobooClient } from "../client";

describe("URL DSN parsing", () => {
  it("URL DSN derives endpoint at host root and strips token", () => {
    transportCtor.mockClear();
    new BoobooClient({ dsn: "https://abc@ingest.booboo.dev/acme/backend", breadcrumbs: false });
    expect(transportCtor).toHaveBeenCalledWith("https://ingest.booboo.dev/", "abc");
  });

  it("URL DSN with port (localhost)", () => {
    transportCtor.mockClear();
    new BoobooClient({ dsn: "http://abc@localhost:8000/x/y", breadcrumbs: false });
    expect(transportCtor).toHaveBeenCalledWith("http://localhost:8000/", "abc");
  });

  it("bare token uses default endpoint", () => {
    transportCtor.mockClear();
    new BoobooClient({ dsn: "plain-token", breadcrumbs: false });
    expect(transportCtor).toHaveBeenCalledWith("https://ingest.booboo.dev/", "plain-token");
  });

  it("explicit endpoint overrides URL-derived", () => {
    transportCtor.mockClear();
    new BoobooClient({
      dsn: "https://abc@ingest.booboo.dev/x/y",
      endpoint: "https://override.example/",
      breadcrumbs: false,
    });
    expect(transportCtor).toHaveBeenCalledWith("https://override.example/", "abc");
  });
});
