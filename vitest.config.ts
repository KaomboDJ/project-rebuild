import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      // See test/server-only-stub.ts for why this is needed under Vitest.
      "server-only": path.resolve(__dirname, "test/server-only-stub.ts"),
    },
  },
});
