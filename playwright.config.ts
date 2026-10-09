import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  // Lab 2 suite tests the removed localStorage requester selector and can
  // never pass against the authenticated app (see README "End-to-end
  // tests"), so it stays out of the default run.
  testIgnore: "**/lab-02/**",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://localhost:5174",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "npm run dev",
      cwd: "./server",
      url: "http://localhost:3000/api/health",
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: "npm run dev -- --port 5174 --strictPort",
      cwd: "./client",
      url: "http://localhost:5174",
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
});