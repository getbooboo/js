import type { StackFrame } from "./types";
import { cleanFilename, isAppFrame } from "./stacktrace";

const CONTEXT_LINES = 5;
const FETCH_TIMEOUT = 2000;

/** In-memory cache: raw URL → lines of source */
const sourceCache = new Map<string, string[]>();

async function fetchSource(url: string): Promise<string[] | null> {
  if (sourceCache.has(url)) return sourceCache.get(url)!;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const text = await res.text();
    const lines = text.split("\n");
    sourceCache.set(url, lines);
    return lines;
  } catch {
    return null;
  }
}

/**
 * Enrich stack frames with source context, clean filenames, and in_app flag.
 * Note: source context shows esbuild-transformed JS (not original TSX/TS).
 * Accurate original source requires source map processing (future feature).
 */
export async function enrichFrames(frames: StackFrame[]): Promise<StackFrame[]> {
  // Collect unique URLs to fetch
  const urls = new Set<string>();
  for (const frame of frames) {
    if (frame.filename && frame.lineno) {
      try {
        new URL(frame.filename);
        urls.add(frame.filename);
      } catch {
        // Not a fetchable URL
      }
    }
  }

  // Fetch all unique source files in parallel
  await Promise.all([...urls].map(fetchSource));

  // Enrich each frame
  return frames.map((frame) => {
    const cleaned = cleanFilename(frame.filename);
    const enriched: StackFrame = {
      ...frame,
      filename: cleaned,
      in_app: isAppFrame(cleaned),
    };

    if (!frame.lineno) return enriched;

    const lines = sourceCache.get(frame.filename);
    if (!lines) return enriched;

    const idx = frame.lineno - 1; // 0-based index
    if (idx < 0 || idx >= lines.length) return enriched;

    enriched.context_line = lines[idx];
    enriched.pre_context = lines.slice(Math.max(0, idx - CONTEXT_LINES), idx);
    enriched.post_context = lines.slice(idx + 1, idx + 1 + CONTEXT_LINES);

    return enriched;
  });
}
