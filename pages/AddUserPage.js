const { expect } = require('@playwright/test');

class AddUserPage {
  constructor(page) {
    this.page = page;
  }

  // STEP 1: Login and open dashboard.
  async loginAndOpenDashboard(email, password) {
    await this.page.goto(
      'https://novo.kazam.in/auth/login'
    );

    const emailInput = this.page.locator('input[name="email"]');
    const passwordInput = this.page.locator('input[name="password"]');
    const loginButton = this.page.getByRole('button', { name: /login/i });

    await expect(emailInput).toBeVisible({ timeout: 20000 });
    await emailInput.fill(email);
    await expect(passwordInput).toBeVisible({ timeout: 20000 });
    await passwordInput.fill(password);
    await loginButton.click();

    const notNowBtn = this.page.locator('button:has-text("Not now")');
    if (await notNowBtn.isVisible()) {
      await notNowBtn.click();
    }

    const orgCard = this.page.locator('p[title="OEM EMS TEST"]');
    while (!(await orgCard.isVisible().catch(() => false))) {
      await this.page.mouse.wheel(0, 600).catch(() => {});
      await this.page.waitForTimeout(250);
    }
    await orgCard.click();
    const continueBtn = this.page.getByText('Continue to Dashboard', { exact: true });
    await expect(continueBtn).toBeVisible({ timeout: 60000 });
    await continueBtn.click();
    const plusButton = this.page.locator('button:has(svg.feather-plus)');
    await expect(plusButton).toBeVisible({ timeout: 30000 });
  }

  // STEP 2: Open Add User flow from dashboard.
  async openAddUserFlow() {
    const plusButton = this.page.locator('button:has(svg.feather-plus)');
    await expect(plusButton).toBeVisible({ timeout: 30000 });
    await plusButton.click();
    await this.page.getByText('Add User', { exact: true }).click();
    await expect(this.page.getByPlaceholder('Enter email', { exact: true })).toBeVisible();
  }

  // STEP 3: Fill user details and move to hub assignment.
  async fillUserDetails({ email, role, designation }) {
    const emailInput = this.page.getByPlaceholder('Enter email', { exact: true });
    await emailInput.fill(email);
    await expect(emailInput).toHaveValue(email);

    await this.page.getByPlaceholder('Select', { exact: true }).click();
    await this.page.getByText(role, { exact: true }).click();

    const designationInput = this.page.getByPlaceholder('Enter Designation', { exact: true });
    await designationInput.fill(designation);
    await expect(designationInput).toHaveValue(designation);

    await this.page.getByRole('button', { name: 'Next' }).click();
  }

  // STEP 4: Assign hubs and proceed.
  async selectHubs(hubNames) {
    const tableRows = this.page.locator('tbody tr');
    await expect(tableRows.first()).toBeVisible({ timeout: 30000 });

    const selectedRows = [];

    for (const hub of hubNames) {
      const row = this.page.locator('tr', { hasText: hub }).first();
      if (await row.isVisible().catch(() => false)) {
        selectedRows.push(row);
        continue;
      }
    }

    if (selectedRows.length !== hubNames.length) {
      const rows = this.page.locator('tr');
      const rowCount = await rows.count();

      for (let i = 0; i < rowCount && selectedRows.length < hubNames.length; i++) {
        const row = rows.nth(i);
        const checkbox = row.locator('input[type="checkbox"]').first();
        const rowText = (await row.textContent())?.trim();

        if (
          rowText &&
          await row.isVisible().catch(() => false) &&
          await checkbox.isVisible().catch(() => false) &&
          !selectedRows.some((selectedRow) => selectedRow === row)
        ) {
          selectedRows.push(row);
        }
      }
    }

    if (!selectedRows.length) {
      throw new Error(`No hub rows available to select for: ${hubNames.join(', ')}`);
    }

    for (const row of selectedRows) {
      await expect(row).toBeVisible({ timeout: 15000 });

      const checkbox = row.locator('input[type="checkbox"]');
      await checkbox.check();
      await expect(checkbox).toBeChecked();
    }

    await this.page.getByRole('button', { name: 'Next' }).click();
  }

  // STEP 5 (optional): Send invite.
  async sendInviteAndWaitForCompletion() {
    const sendInviteBtn = this.page.getByRole('button', { name: 'Send Invite' });
    await expect(sendInviteBtn).toBeVisible({ timeout: 10000 });
    await sendInviteBtn.click();

    const successToast = this.page.getByText(/Invite sent|User created|successfully/i).first();
    await expect(successToast).toBeVisible({ timeout: 25000 });
  }
}

module.exports = { AddUserPage };
