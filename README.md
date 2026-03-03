# @booboo.dev/js

[![CI](https://github.com/getbooboo/js/actions/workflows/ci.yml/badge.svg)](https://github.com/getbooboo/js/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@booboo.dev/js.svg)](https://www.npmjs.com/package/@booboo.dev/js)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Official JavaScript SDK for [booboo.dev](https://booboo.dev) error tracking. Zero runtime dependencies.

## Installation

```bash
npm install @booboo.dev/js
```

## Quick Start

```javascript
import { init } from "@booboo.dev/js";

init({ dsn: "your-dsn-here" });
```

That's it. Unhandled errors and promise rejections are automatically captured.

## Manual Capture

```javascript
import { captureException, captureMessage, flush } from "@booboo.dev/js";

try {
  riskyOperation();
} catch (error) {
  captureException(error);
}

captureMessage("Something noteworthy happened", "warning");

// Drain pending events (e.g. before shutdown)
await flush();
```

## User Context

```javascript
import { setUser } from "@booboo.dev/js";

setUser({
  id: "123",
  email: "user@example.com",
  username: "alice",
});
```

## Breadcrumbs

Breadcrumbs are captured automatically (console, clicks, navigation, fetch). You can also add custom ones:

```javascript
import { addBreadcrumb } from "@booboo.dev/js";

addBreadcrumb({
  type: "custom",
  category: "auth",
  message: "User logged in",
});
```

## Configuration

```javascript
import { init } from "@booboo.dev/js";

init({
  dsn: "your-dsn-here",
  endpoint: "https://api.booboo.dev/ingest/", // default
  environment: "production",
  breadcrumbs: true, // or { console: true, clicks: true, navigation: true, fetch: true }
  maxBreadcrumbs: 30,
  tags: { version: "1.2.3" },
  context: { version: "1.2.3" },
  user: { id: "123" },
  ignoreErrors: [
    "ResizeObserver",           // exact match on error.name
    /network/i,                  // regex on name or message
    /Loading chunk \d+ failed/,  // ignore lazy-load failures
  ],
  captureHttpErrors: {
    targets: [/api\.myapp\.com/],
  },
  beforeSend: (event) => {
    // Return null to drop the event, or modify and return it
    return event;
  },
});
```

| Option | Default | Description |
|--------|---------|-------------|
| `dsn` | (required) | Your project's DSN from booboo.dev |
| `endpoint` | `https://api.booboo.dev/ingest/` | Ingestion endpoint URL |
| `environment` | `""` | Environment name (e.g. `"production"`, `"staging"`). Attached to every event. |
| `breadcrumbs` | `true` | Enable/disable automatic breadcrumb capture |
| `maxBreadcrumbs` | `30` | Maximum breadcrumbs to keep in buffer |
| `tags` | `{}` | Custom tags attached to every event |
| `context` | `{}` | Custom context attached to every event |
| `user` | `null` | Initial user context |
| `ignoreErrors` | `[]` | Errors to suppress. Strings match `error.name` exactly; RegExps test against both `error.name` and `error.message`. |
| `captureHttpErrors` | `false` | Auto-capture HTTP errors from fetch. `true` = 5xx, `[429, 500]` = specific codes, or object with `statuses` and `targets` |
| `beforeSend` | `null` | Hook to modify or drop events before sending |

## HTTP Error Capture

Automatically capture HTTP errors from `fetch()` requests:

```javascript
import { init } from "@booboo.dev/js";

// Capture all 5xx responses
init({ dsn: "your-dsn-here", captureHttpErrors: true });

// Or specify exact status codes
init({ dsn: "your-dsn-here", captureHttpErrors: [429, 500, 502, 503] });

// Filter by URL to avoid capturing errors from third-party services
init({
  dsn: "your-dsn-here",
  captureHttpErrors: {
    targets: ["api.myapp.com", /^https:\/\/internal\./],
  },
});

// Combine specific statuses with URL filtering
init({
  dsn: "your-dsn-here",
  captureHttpErrors: {
    statuses: [429, 500, 502, 503],
    targets: ["api.myapp.com"],
  },
});
```

### Axios

For Axios, use the `axiosErrorInterceptor` helper:

```javascript
import axios from "axios";
import { axiosErrorInterceptor } from "@booboo.dev/js";

const api = axios.create({ baseURL: "/api" });
api.interceptors.response.use(null, axiosErrorInterceptor());

// Custom status codes
api.interceptors.response.use(null, axiosErrorInterceptor({ statuses: [429, 500] }));
```

## React

```jsx
import { ErrorBoundary } from "@booboo.dev/js/react";

function App() {
  return (
    <ErrorBoundary fallback={<div>Something went wrong</div>}>
      <MyApp />
    </ErrorBoundary>
  );
}
```

The `fallback` prop also accepts a render function:

```jsx
<ErrorBoundary fallback={(error, reset) => (
  <div>
    <p>Error: {error.message}</p>
    <button onClick={reset}>Try again</button>
  </div>
)}>
  <MyApp />
</ErrorBoundary>
```

### React Query

Automatically capture errors from TanStack Query / React Query. Query keys, hashes, and mutation IDs are included as context for easier debugging:

```javascript
import { QueryClient, QueryCache, MutationCache } from "@tanstack/react-query";
import { boobooQueryIntegration } from "@booboo.dev/js/react";

const b = boobooQueryIntegration();
const queryClient = new QueryClient({
  queryCache: new QueryCache(b.queryCache),
  mutationCache: new MutationCache(b.mutationCache),
});
```

## Vue

```javascript
import { createApp } from "vue";
import { init } from "@booboo.dev/js";
import { BoobooVue } from "@booboo.dev/js/vue";

init({ dsn: "your-dsn-here" });

const app = createApp(App);
app.use(BoobooVue());
app.mount("#app");
```

## Features

- Automatic capture of unhandled errors and promise rejections
- Automatic HTTP error capture from `fetch()` with `captureHttpErrors`
- Stack trace parsing for Chrome, Firefox, and Safari
- Source context enrichment
- Automatic breadcrumbs (console, clicks, navigation, fetch)
- React `ErrorBoundary` component
- React Query / TanStack Query integration
- Axios error interceptor
- Vue 3 plugin
- `flush()` to drain pending events before shutdown
- `beforeSend` hook for event filtering
- Custom tags, context, and user data
- Non-blocking event delivery with page visibility flush
- Zero runtime dependencies
- ESM and CJS dual output
- Full TypeScript support

## License

MIT
