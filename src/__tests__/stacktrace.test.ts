import { describe, expect, it } from "vitest";
import { cleanFilename, isAppFrame, parseStack } from "../stacktrace";

// --- cleanFilename ---

describe("cleanFilename", () => {
  it("strips protocol, host, and port from URL", () => {
    expect(cleanFilename("http://localhost:5173/src/App.tsx")).toBe("src/App.tsx");
  });

  it("strips query string and hash", () => {
    expect(cleanFilename("http://localhost:5173/src/App.tsx?t=123#foo")).toBe("src/App.tsx");
  });

  it("returns non-URL filenames as-is", () => {
    expect(cleanFilename("src/App.tsx")).toBe("src/App.tsx");
  });

  it("handles https URLs", () => {
    expect(cleanFilename("https://example.com/assets/main.js")).toBe("assets/main.js");
  });
});

// --- isAppFrame ---

describe("isAppFrame", () => {
  it("returns false for node_modules paths", () => {
    expect(isAppFrame("node_modules/react/index.js")).toBe(false);
  });

  it("returns true for app paths", () => {
    expect(isAppFrame("src/components/App.tsx")).toBe(true);
  });

  it("returns false for nested node_modules", () => {
    expect(isAppFrame("src/node_modules/lib/index.js")).toBe(false);
  });
});

// --- parseStack ---

describe("parseStack", () => {
  it("parses Chrome-style named frames", () => {
    const err = new Error("test");
    err.stack = `Error: test
    at functionName (http://localhost:5173/src/App.tsx:10:5)
    at anotherFunc (http://localhost:5173/src/main.ts:20:10)`;

    const frames = parseStack(err);
    // Reversed: entry-first
    expect(frames).toHaveLength(2);
    expect(frames[0].function).toBe("anotherFunc");
    expect(frames[0].filename).toBe("http://localhost:5173/src/main.ts");
    expect(frames[0].lineno).toBe(20);
    expect(frames[0].colno).toBe(10);
    expect(frames[1].function).toBe("functionName");
    expect(frames[1].lineno).toBe(10);
  });

  it("parses Chrome-style anonymous frames", () => {
    const err = new Error("test");
    err.stack = `Error: test
    at http://localhost:5173/src/App.tsx:10:5`;

    const frames = parseStack(err);
    expect(frames).toHaveLength(1);
    expect(frames[0].function).toBe("<anonymous>");
    expect(frames[0].lineno).toBe(10);
  });

  it("parses Firefox-style frames", () => {
    const err = new Error("test");
    err.stack = `myFunc@http://localhost:5173/src/App.tsx:10:5
otherFunc@http://localhost:5173/src/main.ts:20:10`;

    const frames = parseStack(err);
    expect(frames).toHaveLength(2);
    expect(frames[0].function).toBe("otherFunc");
    expect(frames[1].function).toBe("myFunc");
  });

  it("parses constructor frames (new keyword)", () => {
    const err = new Error("test");
    err.stack = `Error: test
    at new MyClass (http://localhost:5173/src/App.tsx:10:5)`;

    const frames = parseStack(err);
    expect(frames).toHaveLength(1);
    expect(frames[0].function).toBe("MyClass");
  });

  it("returns empty array when no stack", () => {
    const err = new Error("test");
    err.stack = undefined;
    expect(parseStack(err)).toEqual([]);
  });

  it("returns empty array for unparseable stack", () => {
    const err = new Error("test");
    err.stack = "Some random text\nwithout any frames";
    expect(parseStack(err)).toEqual([]);
  });
});
