import { defineConfig } from "tsup";
import pkg from "./package.json";

export default defineConfig({
  entry: ["src/index.ts", "src/react.ts", "src/vue.ts"],
  format: ["esm", "cjs"],
  dts: true,
  splitting: true,
  clean: true,
  external: ["react", "vue"],
  define: {
    __SDK_VERSION__: JSON.stringify(pkg.version),
  },
});
