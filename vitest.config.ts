import path from "node:path";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
  resolve: {
    alias: {
      // See test/server-only-stub.ts for why this is needed under Vitest.
      "server-only": path.resolve(__dirname, "test/server-only-stub.ts"),
      // Mirrors tsconfig.json's "@/*" path alias, which Next.js resolves
      // natively but Vitest/Vite does not pick up automatically. Needed as
      // soon as any tested module has a real (non type-only) "@/..." import
      // - context-builder.ts's import of lib/date/timezone.ts is the first.
      "@": path.resolve(__dirname, "."),
    },
  },
});
