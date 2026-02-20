# @booboo.dev/js

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
import { captureException, captureMessage } from "@booboo.dev/js";

try {
  riskyOperation();
} catch (error) {
  captureException(error);
}

captureMessage("Something noteworthy happened", "warning");
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
  breadcrumbs: true, // or { console: true, clicks: true, navigation: true, fetch: true }
  maxBreadcrumbs: 30,
  tags: { environment: "production" },
  context: { version: "1.2.3" },
  user: { id: "123" },
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
| `breadcrumbs` | `true` | Enable/disable automatic breadcrumb capture |
| `maxBreadcrumbs` | `30` | Maximum breadcrumbs to keep in buffer |
| `tags` | `{}` | Custom tags attached to every event |
| `context` | `{}` | Custom context attached to every event |
| `user` | `null` | Initial user context |
| `beforeSend` | `null` | Hook to modify or drop events before sending |

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
- Stack trace parsing for Chrome, Firefox, and Safari
- Source context enrichment
- Automatic breadcrumbs (console, clicks, navigation, fetch)
- React `ErrorBoundary` component
- Vue 3 plugin
- `beforeSend` hook for event filtering
- Custom tags, context, and user data
- Non-blocking event delivery with page visibility flush
- Zero runtime dependencies
- ESM and CJS dual output
- Full TypeScript support

## License

MIT
