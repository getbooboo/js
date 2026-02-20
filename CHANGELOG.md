# Changelog

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
