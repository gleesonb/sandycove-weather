import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        isolatedStorage: true,
        wrangler: {
          configPath: "./wrangler.deploy.toml",
        },
      },
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "dist/",
        "*.config.ts",
        "src/pages/api/**",  // API routes tested separately
      ],
    },
  },
});
