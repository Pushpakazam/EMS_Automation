const { expect } = require('@playwright/test');

class AddHubPage {
  constructor(page) {
    this.page = page;
    this.selectedChargerName = null;
    this.selectedChargerNames = [];
    this.lastRemovedChargerName = null;
    this.currentHubName = null;
  }

  getHubDetailSearchBox() {
    return this.page.locator('main').getByPlaceholder('Search by device id').last();
  }

  async ensureActivePage() {
    if (!this.page.isClosed()) {
      return;
    }

    const openPages = this.page.context().pages().filter((currentPage) => !currentPage.isClosed());
    if (!openPages.length) {
      throw new Error('No active page available in browser context');
    }

    this.page = openPages[openPages.length - 1];
  }

  async login(email, password) {
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
    if (await notNowBtn.isVisible().catch(() => false)) {
      await notNowBtn.click();
    }
  }

  async openOrg() {
    const orgCard = this.page.locator('p[title="OEM EMS TEST"]');
    while (!(await orgCard.isVisible().catch(() => false))) {
      await this.page.mouse.wheel(0, 600).catch(() => {});
      await this.page.waitForTimeout(250);
    }
    await orgCard.click();
    await this.page.getByText('Continue to Dashboard', { exact: true }).click();
    const dashboardSearch = this.page.getByPlaceholder('Search hub');

    try {
      await expect(dashboardSearch).toBeVisible({ timeout: 20000 });
    } catch {
      await this.page.waitForLoadState('networkidle').catch(() => {});
      await expect(dashboardSearch).toBeVisible({ timeout: 30000 });
    }
  }

  async openManageHubs() {
    const searchBox = this.page.getByPlaceholder('Search by hub name');
    if (await searchBox.isVisible().catch(() => false)) {
      return;
    }

    const navigateToManageHubs = async () => {
      const plusButton = this.page.locator('button:has(svg.feather-plus)');
      await expect(plusButton).toBeVisible({ timeout: 30000 });
      await plusButton.click();
      const addHubItem = this.page.getByText('Add Hub', { exact: true });
      await expect(addHubItem).toBeVisible({ timeout: 15000 });
      await addHubItem.click();
    };

    await navigateToManageHubs();

    try {
      await expect(searchBox).toBeVisible({ timeout: 15000 });
    } catch {
      await this.page.waitForLoadState('networkidle').catch(() => {});
      if (!(await searchBox.isVisible().catch(() => false))) {
        await navigateToManageHubs();
        await expect(searchBox).toBeVisible({ timeout: 20000 });
      }
    }
  }

  async openAddHubModal() {
    const pageAddHubButton = this.page.getByRole('button', { name: 'Add Hub' });
    await expect(pageAddHubButton).toBeVisible({ timeout: 15000 });
    await pageAddHubButton.click();
    await expect(this.page.getByRole('textbox', { name: 'name' })).toBeVisible({ timeout: 15000 });
  }

  async createHub(hubName, chargerSelectionCount = 1) {
    this.currentHubName = hubName;
    await this.openAddHubModal();
    const addHubDialog = this.page.getByRole('dialog');
    const hubNameInput = this.page.getByRole('textbox', { name: 'name' });
    await hubNameInput.fill(hubName);

    const chargerBox = this.page.getByRole('textbox', { name: 'Select' });
    await chargerBox.click();

    const chargerOptions = this.page.locator('span.cursor-pointer');
    const availableOptions = [];
    const optionCount = await chargerOptions.count();

    for (let i = 0; i < optionCount; i++) {
      const option = chargerOptions.nth(i);
      const optionText = (await option.textContent())?.trim();

      if (
        optionText &&
        optionText !== 'Select' &&
        optionText !== 'Close' &&
        optionText !== 'Add Hub'
      ) {
        availableOptions.push({ index: i, text: optionText });
      }
    }

    const selectedOptions = availableOptions.slice(0, chargerSelectionCount);

    if (selectedOptions.length) {
      this.selectedChargerNames = selectedOptions.map((option) => option.text);
      this.selectedChargerName = this.selectedChargerNames[0];

      for (const option of selectedOptions) {
        await chargerOptions.nth(option.index).click({ force: true });
        await this.page.waitForTimeout(500);
      }
    }

    if (!this.selectedChargerNames.length) {
      throw new Error('No charger option could be selected from Add Hub dropdown');
    }

    for (const chargerName of this.selectedChargerNames) {
      await expect(this.page.getByText(chargerName, { exact: true }).first()).toBeVisible({ timeout: 10000 });
    }

    await this.page.getByPlaceholder('Latitude').fill('12.9352');
    await this.page.getByPlaceholder('Longitude').fill('77.6245');
    await addHubDialog.getByRole('button', { name: 'Add Hub' }).click();

    await expect(addHubDialog).not.toBeVisible({ timeout: 60000 });
    await expect(this.page.getByPlaceholder('Search by hub name')).toBeVisible({ timeout: 15000 });
    await this.searchHubInManageHubList(hubName);
    await expect(this.page.getByText(hubName, { exact: true }).first()).toBeVisible({ timeout: 30000 });
  }

  async searchHubInManageHubList(hubName) {
    await this.page.reload();
    await expect(this.page.getByPlaceholder('Search by hub name')).toBeVisible({ timeout: 15000 });

    const searchBox = this.page.getByPlaceholder('Search by hub name');
    await searchBox.fill(hubName);
    await this.page.waitForTimeout(2000);
  }

  async openManageOrg() {
    await this.ensureActivePage();
    const dashboardSearch = this.page.getByPlaceholder('Search hub');
    if (await dashboardSearch.isVisible().catch(() => false)) {
      return;
    }

    await this.page.getByText('Manage Org', { exact: true }).click();
    await expect(dashboardSearch).toBeVisible({ timeout: 15000 });
  }

  async searchHubInManageOrgDashboard(hubName) {
    const searchBox = this.page.getByPlaceholder('Search hub');
    await searchBox.clear();
    await searchBox.fill(hubName);
    await this.page.waitForTimeout(2000);

    await expect(
      this.page.locator('tbody tr', { hasText: hubName }).first()
    ).toBeVisible({ timeout: 15000 });
  }

  async verifyHubNotPresentInManageOrgDashboard(hubName) {
    await this.ensureActivePage();
    await this.openManageOrg();
    await this.page.reload();
    const searchBox = this.page.getByPlaceholder('Search hub');
    await expect(searchBox).toBeVisible({ timeout: 15000 });
    await searchBox.clear();
    await searchBox.fill(hubName);
    await this.page.waitForTimeout(3000);
    await expect(
      this.page.locator('tbody tr', { hasText: hubName })
    ).toHaveCount(0, { timeout: 30000 });
  }

  async openHubDetails(hubName) {
    this.currentHubName = hubName;
    const hubCard = this.page.getByText(hubName, { exact: true }).first();
    await expect(hubCard).toBeVisible({ timeout: 15000 });
    await hubCard.scrollIntoViewIfNeeded();
    await hubCard.click();
    await expect(this.page.getByText('Hub Detail', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(this.page.getByText(hubName, { exact: true }).first()).toBeVisible({ timeout: 15000 });
  }

  async ensureCurrentHubDetailOpen() {
    if (!this.currentHubName) {
      return;
    }

    const hubNameVisible = await this.page.getByText(this.currentHubName, { exact: true }).first().isVisible().catch(() => false);
    const hubDetailVisible = await this.page.getByText('Hub Detail', { exact: true }).isVisible().catch(() => false);

    if (hubNameVisible && hubDetailVisible) {
      return;
    }

    const backButton = this.page.getByRole('button', { name: 'Back' });
    if (await backButton.isVisible().catch(() => false)) {
      await backButton.click();
    }

    await expect(this.page.getByPlaceholder('Search by hub name')).toBeVisible({ timeout: 15000 });
    await this.searchHubInManageHubList(this.currentHubName);
    await this.openHubDetails(this.currentHubName);
  }

  async addChargerToHub(chargerCount = 1) {
    await this.page.getByRole('button', { name: 'Add Chargers to Hub' }).click();
    await expect(this.page.getByText(/Add Chargers in/i)).toBeVisible({ timeout: 10000 });

    const loading = this.page.getByText('Loading...');
    await loading.waitFor({ state: 'hidden', timeout: 60000 }).catch(() => {});

    const rows = this.page.locator('tbody tr');
    const rowCount = await rows.count();
    const selectedCheckboxes = [];
    const addedChargerNames = [];

    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i);
      const rowText = (await row.textContent())?.trim();
      const checkbox = row.locator('input[type="checkbox"]').first();

      if (
        rowText &&
        rowText !== this.lastRemovedChargerName &&
        await checkbox.isVisible().catch(() => false)
      ) {
        selectedCheckboxes.push(checkbox);
        addedChargerNames.push(rowText.split(/\s+/)[0]);
        if (selectedCheckboxes.length === chargerCount) {
          break;
        }
      }
    }

    if (!selectedCheckboxes.length) {
      await this.page.waitForTimeout(2000);
      const availableCheckbox = this.page.locator('input[type="checkbox"]').filter({ hasNotText: '' }).first();
      if (await availableCheckbox.isVisible().catch(() => false)) {
        selectedCheckboxes.push(availableCheckbox);
      }
    }

    if (!selectedCheckboxes.length) {
      console.log('[WARN] No chargers available to add to hub.');
      return;
    }

    for (const checkbox of selectedCheckboxes) {
      await checkbox.check();
    }

    await this.page.getByRole('button', { name: 'Add', exact: true }).click();

    await this.page.waitForTimeout(3000);
    await expect(this.page.getByText(new RegExp(`Total chargers : ${selectedCheckboxes.length}`))).toBeVisible({ timeout: 20000 });
    if (addedChargerNames.length) {
      this.selectedChargerNames = addedChargerNames;
      this.selectedChargerName = addedChargerNames[0];
      for (const chargerName of addedChargerNames) {
        await expect(this.page.getByText(chargerName, { exact: true })).toBeVisible({ timeout: 20000 });
      }
    }
  }

  async searchChargerInHub() {
    const searchBox = this.getHubDetailSearchBox();
    const chargersToVerify = this.selectedChargerNames.length ? this.selectedChargerNames : [this.selectedChargerName];

    for (const chargerName of chargersToVerify) {
      await searchBox.clear();
      await searchBox.fill(chargerName);
      await this.page.waitForTimeout(2000);
      await expect(this.page.getByText(chargerName, { exact: true })).toBeVisible({ timeout: 15000 });
    }
  }

  async tryDeleteHubWithCharger() {
    await this.clickHubDeleteButton();
    await this.page.getByRole('button', { name: 'Confirm' }).click();
    await this.page.waitForTimeout(3000);

    await this.ensureCurrentHubDetailOpen();

    await expect(this.page.getByText('Hub Detail', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(this.page.getByText(/Total chargers : [1-9]\d*/)).toBeVisible({ timeout: 15000 });
  }

  async removeChargerFromHub() {
    await this.ensureCurrentHubDetailOpen();
    this.lastRemovedChargerName = this.selectedChargerName;
    const searchBox = this.getHubDetailSearchBox();
    const chargersToRemove = this.selectedChargerNames.length
      ? [...this.selectedChargerNames]
      : [this.selectedChargerName].filter(Boolean);

    await searchBox.clear();
    await this.page.waitForTimeout(1500);

    for (const chargerName of chargersToRemove) {
      const row = this.page.locator('tbody tr', { hasText: chargerName }).first();
      await expect(row).toBeVisible({ timeout: 15000 });

      const checkbox = row.locator('input[type="checkbox"]').first();
      await checkbox.check();
    }

    const removeButton = this.page.getByRole('button', { name: 'Remove Chargers' });
    await expect(removeButton).toBeVisible({ timeout: 15000 });
    await removeButton.click();
    await this.page.getByRole('button', { name: 'Confirm' }).click();

    await this.page.waitForLoadState('networkidle').catch(() => {});
    await this.page.waitForTimeout(3000);
    const totalZero = this.page.getByText(/Total chargers\s*:\s*0/i);
    const noData = this.page.getByText('No Data Found!', { exact: true });
    await expect(totalZero).toBeVisible({ timeout: 30000 });
    await expect(noData).toBeVisible({ timeout: 30000 });
    this.selectedChargerNames = [];
    this.selectedChargerName = null;
  }

  async clickHubDeleteButton() {
    const buttons = this.page.locator('main button');
    const count = await buttons.count();

    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i);
      if (!(await button.isVisible().catch(() => false))) continue;

      const label = [
        await button.textContent().catch(() => ''),
        await button.getAttribute('aria-label').catch(() => ''),
        await button.getAttribute('title').catch(() => ''),
      ].join(' ');

      if (/delete/i.test(label)) {
        await button.click();
        return;
      }
    }

    await buttons.nth(3).click();
  }

  async deleteHub() {
    await this.ensureCurrentHubDetailOpen();
    await expect(this.page.getByText(/Total chargers\s*:\s*0/i)).toBeVisible({ timeout: 30000 });
    await this.clickHubDeleteButton();
    const confirmButton = this.page.getByRole('button', { name: 'Confirm' });
    await expect(confirmButton).toBeVisible({ timeout: 10000 });
    await confirmButton.click();
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await this.page.waitForTimeout(5000);
  }


}

module.exports = { AddHubPage };
