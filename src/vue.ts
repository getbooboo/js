import { captureException } from "./index";
import type { App, ComponentPublicInstance } from "vue";

interface BoobooVueOptions {
  dsn?: string;
}

export function BoobooVue(_options?: BoobooVueOptions) {
  return {
    install(app: App): void {
      const prevHandler = app.config.errorHandler;

      app.config.errorHandler = (
        err: unknown,
        instance: ComponentPublicInstance | null,
        info: string,
      ) => {
        const error = err instanceof Error ? err : new Error(String(err));

        const extra: Record<string, unknown> = {
          vueInfo: info,
        };

        if (instance) {
          extra.componentName =
            instance.$options?.name || instance.$options?.__name || "<Anonymous>";
          if (instance.$props && typeof instance.$props === "object") {
            extra.propKeys = Object.keys(instance.$props);
          }
        }

        captureException(error, extra);

        if (typeof prevHandler === "function") {
          prevHandler(err, instance, info);
        }
      };
    },
  };
}
