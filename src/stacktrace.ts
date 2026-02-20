import type { StackFrame } from "./types";

/**
 * Strip origin (protocol + host + port) and query/hash from a URL.
 * "http://localhost:5173/src/App.tsx?t=123" → "src/App.tsx"
 * Non-URL filenames are returned as-is.
 */
export function cleanFilename(raw: string): string {
  try {
    const url = new URL(raw);
    // Remove leading slash to get relative path
    return url.pathname.replace(/^\//, "");
  } catch {
    // Not a valid URL — return as-is
    return raw;
  }
}

/**
 * Returns false if the cleaned filename looks like a library/vendor frame.
 */
export function isAppFrame(cleanedFilename: string): boolean {
  return !cleanedFilename.includes("node_modules/");
}

// Chrome/Edge: "    at funcName (file:line:col)" or "    at file:line:col"
const CHROME_RE = /^\s*at\s+(?:(new\s+)?(.+?)\s+\((.+?):(\d+):(\d+)\)|(.+?):(\d+):(\d+))\s*$/;

// Firefox/Safari: "funcName@file:line:col"
const FIREFOX_RE = /^\s*(.+?)@(.+?):(\d+):(\d+)\s*$/;

export function parseStack(error: Error): StackFrame[] {
  const stack = error.stack;
  if (!stack) return [];

  const lines = stack.split("\n");
  const frames: StackFrame[] = [];

  for (const line of lines) {
    let match = CHROME_RE.exec(line);
    if (match) {
      if (match[3]) {
        // "at funcName (file:line:col)"
        frames.push({
          filename: match[3],
          function: match[2] || "<anonymous>",
          lineno: parseInt(match[4], 10),
          colno: parseInt(match[5], 10),
        });
      } else {
        // "at file:line:col"
        frames.push({
          filename: match[6],
          function: "<anonymous>",
          lineno: parseInt(match[7], 10),
          colno: parseInt(match[8], 10),
        });
      }
      continue;
    }

    match = FIREFOX_RE.exec(line);
    if (match) {
      frames.push({
        filename: match[2],
        function: match[1] || "<anonymous>",
        lineno: parseInt(match[3], 10),
        colno: parseInt(match[4], 10),
      });
    }
  }

  // Reverse to entry-first order (matches Python SDK convention)
  return frames.reverse();
}
