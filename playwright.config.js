// @ts-check
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',

  timeout: 120 * 1000,
  expect: { timeout: 120 * 1000 },

  fullyParallel: false,
  workers: 1,

  reporter: [
    ['list'],
    ['ortoni-report', {
      folderPath: 'ortoni-report',
      filename: 'index.html',
      title: 'Kazam EMS Automation Report',
      projectName: 'EMS',
      testType: 'E2E',
      authorName: 'Pushpa',
      meta: {
        Environment: 'SIT',
        Team: 'QA',
        Module: 'EMS'
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

