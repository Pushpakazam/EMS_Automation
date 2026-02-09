// @ts-check
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',

  timeout: 120 * 1000,
  expect: { timeout: 120 * 1000 },

  fullyParallel: false,
  workers: 1,

  reporter: [
    // Playwright HTML (NON-blocking)
    ['html', {
      outputFolder: 'playwright-report',
      open: 'never'
    }],

    // Monocart Reporter (stable, OneDrive-safe)
    ['monocart-reporter', {
      name: 'EMS Automation Report',
      outputDir: './monocart-output',
      outputFile: 'monocart-report.html',
      clean: false,

      attachments: {
        ignoreMissing: true
      },

      visitor: (/** @type {any} */ data) => {
        if (data.type === 'suite') data.collapsed = false;
        if (data.type === 'test') data.hidden = false;
        return data;
      }
    }]
  ],

  use: {
    browserName: 'chromium',
    headless: false,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    launchOptions: {
      //slowMo: 500
    }
  }
});

