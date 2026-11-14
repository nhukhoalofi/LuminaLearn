import { defineConfig, devices } from '@playwright/test';

const e2ePort = process.env.LUMINA_E2E_PORT ?? '3000';
const e2eBaseUrl = `http://127.0.0.1:${e2ePort}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [['list']],
  use: {
    baseURL: e2eBaseUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  webServer: {
    command: `pnpm exec next dev -H 127.0.0.1 -p ${e2ePort}`,
    url: e2eBaseUrl,
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      ...process.env,
      LUMINA_LOCAL_DEMO: 'true',
      LUMINA_PUBLIC_DEPLOYMENT: 'false'
    }
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
});
