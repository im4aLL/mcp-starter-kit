import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/main.ts", "src/list-capabilities.ts"],
  format: ["esm"],
  platform: "node",
  target: "node20",
  sourcemap: true,
  clean: true,
});
