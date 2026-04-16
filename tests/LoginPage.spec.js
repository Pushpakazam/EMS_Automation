const { test, expect } = require('@playwright/test');
const { getCSVDataSync } = require('../utils/csvProvider');

const loginData = getCSVDataSync('./test-data/loginData.csv');

test.describe('Login Data Driven Tests (CSV)', () => {

  for (const data of loginData) {

    test(`${data.id} - Login with ${data.username}`, async ({ page }) => {

      await page.goto('https://novo.kazam.in/auth/login');

      const emailInput = page.locator('input[name="email"]');
      const passwordInput = page.locator('input[name="password"]');
      const loginButton = page.getByRole('button', { name: /login/i });

      await expect(emailInput).toBeVisible({ timeout: 20000 });
      await emailInput.fill('pushpa@kazam.in');
      await expect(passwordInput).toBeVisible({ timeout: 20000 });
      await passwordInput.fill('Shivanna@123');
      await loginButton.click();

     

    });

  }

});

