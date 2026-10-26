import { defineConfig, devices } from '@playwright/test';

// E2E contra el Worker real (wrangler dev + D1 local). Chromium con viewport/UA de iPhone 13 y escritorio 1440 px.
export default defineConfig({
  testDir: 'e2e',
  timeout: 180_000,
  expect: { timeout: 15_000 },
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: { baseURL: 'http://127.0.0.1:8788', trace: 'retain-on-failure', screenshot: 'only-on-failure', acceptDownloads: true, locale: 'es-ES', timezoneId: 'Europe/Madrid' },
  projects: [
    { name: 'iphone', use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: devices['iPhone 13'].userAgent } },
    { name: 'desktop', use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } } },
  ],
  webServer: { command: 'bash scripts/e2e-server.sh 8788', url: 'http://127.0.0.1:8788/api/health', reuseExistingServer: false, timeout: 180_000, stdout: 'ignore', stderr: 'pipe' },
});
