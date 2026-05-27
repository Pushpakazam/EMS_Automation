const {test,expect} = require('@playwright/test');

test('Verify Sessions Report',async({page})=>{

    await page.goto('https://novo.kazam.in/');
    const emailInput = page.locator('input[name="email"]');
    const passwordInput = page.locator('input[name="password"]');
    const loginButton = page.getByRole('button', { name: /login/i });

    await expect(emailInput).toBeVisible({ timeout: 20000 });
    await emailInput.fill(email);
    await expect(passwordInput).toBeVisible({ timeout: 20000 });
    await passwordInput.fill(password);
    await loginButton.click();

    const notNowBtn = page.locator('button:has-text("Not now")');
    if (await notNowBtn.isVisible().catch(() => false)) {
      await notNowBtn.click();
    }

    await page.locator('p[title="PMI Electro Mobility"]').click();
    await page.getByText('Continue to Dashboard', { exact: true }).click();
    await page.getByText('Energy Management', { exact: true }).click();

})

