# Changelog

## 0.6.0 (2026-03-03)

### Features

- **`ignoreErrors`**: New `ignoreErrors` option on `init()` to suppress noisy or expected errors from being reported. Accepts an array of strings and/or RegExps — strings match `error.name` exactly, RegExps test against both `error.name` and `error.message`. Filtering runs before stack parsing for zero overhead on ignored errors.

## 0.5.0 (2026-03-02)

### Features

- **`flush()`** — drain pending events before shutdown (e.g. `await booboo.flush()` in `beforeunload`)
- **`captureHttpErrors`** — auto-capture HTTP 5xx (or custom status codes) from `fetch()` requests. Supports object form with `targets` for URL filtering (string or RegExp) to scope which domains are monitored.
- **`boobooQueryIntegration()`** — React Query / TanStack Query helper for automatic error capture from queries and mutations. Includes query keys, hashes, and mutation IDs as context for easier debugging.
- **`axiosErrorInterceptor()`** — Axios response error interceptor for automatic HTTP error capture

## 0.4.1 (2026-02-25)

### Fixes

- Fix SDK version in event payloads — was hardcoded to `0.3.0` instead of using the actual package version

## 0.4.0 (2026-02-23)

### Features

- **Environment support**: `init()` now accepts an `environment` option (e.g. `"production"`, `"staging"`). The value is attached to every event and can be used to filter issues in the dashboard.

## 0.3.0 (2026-02-20)

### Features

- Global `window.onerror` and `onunhandledrejection` handlers
- Manual capture with `captureException()` and `captureMessage()`
- User context with `setUser()`
- Stack trace parsing for Chrome, Firefox, and Safari
- Source context enrichment (fetches original source for context lines)
- Automatic breadcrumbs: console, clicks, navigation, fetch
- `beforeSend` hook for event filtering/modification
- Custom tags and context
- Non-blocking event delivery with page visibility flush
- Framework integrations:
  - **React**: `ErrorBoundary` component (`@booboo.dev/js/react`)
  - **Vue**: plugin with `app.config.errorHandler` (`@booboo.dev/js/vue`)
- Zero runtime dependencies
- ESM and CJS dual output
