const { expect } = require('@playwright/test');

class AddChargerPage {
  constructor(page) {
    this.page = page;
    this.initLocators(page);
  }

  initLocators(page) {
    this.chargerNameInput = page.getByPlaceholder('Charger name');
    this.hostNumberInput = page.getByPlaceholder('Host phone number');
    this.totalCapacityInput = page.locator("input[placeholder='eg: 3.3, 7.4. 22']");
    this.segmentField = page.locator('div.flex-col').filter({ hasText: /^Segment \*/ }).locator('input');
    this.subsegmentField = page.locator('div.flex-col').filter({ hasText: /^Subsegment \*/ }).locator('input');
    this.parkingField = page.locator('div.flex-col').filter({ hasText: /^Parking Type \*/ }).locator('input');

    this.connectorTypeField = page.locator('div.flex-col').filter({ hasText: /^Connector Type \*/ }).locator('input');
    this.connectorCapacityInput = page.locator('div.flex-col').filter({ hasText: /^Total Capacity \(kWh\) \*/ }).locator('input');

    this.latitudeInput = page.locator("input[placeholder='Latitude']");
    this.longitudeInput = page.locator("input[placeholder='Longitude']");
    this.getAddressBtn = page.getByRole('button', { name: 'Get Address' });
    this.nextBtn = page.getByRole('button', { name: 'Next' });

    this.privateChargerField = page.locator('div').filter({ hasText: /^Private Charger \*/ }).getByPlaceholder('Select').first();
    this.open247Field = page.locator('div').filter({ hasText: /^Open 24\/7 \*/ }).getByPlaceholder('Select').first();
    this.imageUploadInput = page.locator('main input[type="file"]').first();
    this.addChargerBtn = page.getByRole('button', { name: 'Add Charger' });
  }

  async ensureActivePage() {
    if (!this.page.isClosed()) return;
    const openPages = this.page.context().pages().filter((currentPage) => !currentPage.isClosed());
    if (!openPages.length) {
      throw new Error('No active page available in browser context');
    }
    this.page = openPages[openPages.length - 1];
    this.initLocators(this.page);
  }

  static generateChargerName() {
    return `AUTO_CHARGER_${Date.now()}`;
  }

  static getOperatingSlot(dayIndex, slotIndex) {
    const slots = [
      { start: '06:00', end: '14:00' },
      { start: '07:30', end: '15:30' },
      { start: '08:00', end: '16:00' },
      { start: '09:30', end: '17:30' },
      { start: '10:00', end: '18:00' },
      { start: '11:30', end: '19:30' }
    ];

    return slots[(dayIndex + slotIndex) % slots.length];
  }

  static getDayLabel(dayPosition) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[dayPosition];
  }

  static formatParkingSelection(parking) {
    return Array.isArray(parking) ? parking.join(',') : parking;
  }

  async selectDropdownOption(optionName) {
    if (!optionName) throw new Error('Dropdown option undefined');

    const option = this.page.getByText(optionName, { exact: true }).first();
    await expect(option).toBeVisible({ timeout: 5000 });
    await option.click();
  }

  async clickNext() {
    const nextVisible = await this.nextBtn.isVisible().catch(() => false);
    if (!nextVisible) {
      await this.page.keyboard.press('Escape').catch(() => {});
      await this.page.mouse.click(20, 20).catch(() => {});
    }

    await this.nextBtn.waitFor({ state: 'visible', timeout: 10000 });
    await expect(this.nextBtn).toBeEnabled({ timeout: 10000 });
    await this.nextBtn.scrollIntoViewIfNeeded();
    await this.page.waitForTimeout(300);

    try {
      await this.nextBtn.click();
    } catch (e) {
      await this.nextBtn.click({ force: true });
    }
  }

  async login(email, password) {
    await this.page.goto(
      'https://kazam-olectra.vercel.app/org'
    );

    const emailInput = this.page.locator('input[name="email"]');
    const passwordInput = this.page.locator('input[name="password"]');
    const loginButton = this.page.getByRole('button', { name: /login/i });

    await expect(emailInput).toBeVisible({ timeout: 20000 });
    await emailInput.fill(email);
    await expect(passwordInput).toBeVisible({ timeout: 20000 });
    await passwordInput.fill(password);
    await loginButton.click();

    const notNow = this.page.getByRole('button', { name: 'Not now' });
    if (await notNow.isVisible().catch(() => false)) {
      await notNow.click();
    }

    const orgCard = this.page.locator('p[title="OEM EMS TEST"]');
    while (!(await orgCard.isVisible().catch(() => false))) {
      await this.page.mouse.wheel(0, 600).catch(() => {});
      await this.page.waitForTimeout(250);
    }
    await orgCard.click();
    await this.page.getByText('Continue to Dashboard').click();
  }

  async openAddCharger() {
    const plusButton = this.page.locator('button:has(svg.feather-plus)');
    await expect(plusButton).toBeVisible({ timeout: 30000 });
    await plusButton.click();
    await this.page.getByRole('button', { name: 'Add Charger' }).click();
    await expect(this.page.getByText('Charger Details')).toBeVisible();
  }

  async clickAddMore() {
    await this.ensureActivePage();
    await this.page.waitForTimeout(1000);
    await this.page.waitForLoadState('networkidle');

    const btn = this.page.getByRole('button', { name: /Add More Charger/i });

    try {
      await btn.waitFor({ state: 'visible', timeout: 10000 });
      await btn.click();
    } catch (e) {
      console.log('Add More not visible, retrying...');
      await this.page.waitForTimeout(2000);
      await btn.waitFor({ state: 'visible', timeout: 10000 });
      await btn.click();
    }
  }

  async fillStep1(data) {
    await this.chargerNameInput.fill(data.name);
    await this.hostNumberInput.waitFor({ state: 'visible', timeout: 20000 });
    await expect(this.hostNumberInput).toBeEnabled({ timeout: 20000 });
    await this.hostNumberInput.click();
    await this.hostNumberInput.fill(data.host);
    await expect(this.hostNumberInput).toHaveValue(data.host, { timeout: 10000 });

    // Host is a number/spin control: ArrowDown/Enter would change the value, not pick a suggestion.
    await this.chargerNameInput.click();
    await this.page.waitForTimeout(800);

    const invalidHost = this.page.getByText('Invalid phone number').first();
    await expect(invalidHost).not.toBeVisible({ timeout: 20000 });
    await expect(this.hostNumberInput).toHaveValue(data.host, { timeout: 5000 });

    const hostHint = this.page.getByText(/Host name:/i).first();
    await hostHint.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});

    await this.segmentField.click();
    await this.selectDropdownOption(data.segment);

    await this.page.waitForTimeout(1000);

    await this.subsegmentField.click();
    await this.selectDropdownOption(data.subsegment);

    await this.totalCapacityInput.fill(data.capacity);
    await this.page.getByRole('button', { name: data.type, exact: true }).click();

    const parkingOptions = Array.isArray(data.parking) ? data.parking : [data.parking];
    for (const option of parkingOptions) {
      await this.parkingField.click();
      await this.selectDropdownOption(option);
    }

    await this.clickNext();
  }

  async fillStep2(data) {
    await this.page.getByRole('button', { name: data.count, exact: true }).click();

    for (let i = 0; i < parseInt(data.count); i++) {
      await this.connectorTypeField.nth(i).click();
      await this.selectDropdownOption(data.type);
      await this.connectorCapacityInput.nth(i).fill(data.capacity);
    }

    await this.clickNext();
  }

  async fillStep3(data) {
    await this.latitudeInput.fill(data.latitude);
    await this.longitudeInput.fill(data.longitude);

    await this.getAddressBtn.click();

    const addressBox = this.page.locator('textarea, div').filter({ hasText: /,/ });
    await addressBox.first().waitFor({ state: 'visible', timeout: 30000 });

    await this.clickNext();
  }

  async fillStep4(data) {
    await this.ensureActivePage();
    await this.page.waitForSelector('text=Additional Details', { timeout: 10000 });
    let scheduleSummary = '24x7';

    await this.privateChargerField.click();
    await this.selectDropdownOption(data.private);

    await this.open247Field.click();
    await this.selectDropdownOption(data.open247);

    if (data.open247 === 'No') {
      const numberOfDays = (data.dayIndex % 3) + 1;
      const selectedSchedules = [];

      const checkboxes = this.page.locator("//input[@type='checkbox']");
      const timeInputs = this.page.locator("//input[@type='time']");

      for (let i = 0; i < numberOfDays; i++) {
        const dayPosition = (data.dayIndex + i) % 7;
        const slot = AddChargerPage.getOperatingSlot(data.dayIndex, i);

        const checkbox = checkboxes.nth(dayPosition);

        await checkbox.scrollIntoViewIfNeeded();
        await checkbox.check();
        await this.page.waitForTimeout(800);

        const startTime = timeInputs.nth(dayPosition * 2);
        const endTime = timeInputs.nth(dayPosition * 2 + 1);

        await startTime.fill(slot.start, { force: true });
        await endTime.fill(slot.end, { force: true });

        selectedSchedules.push(
          `${AddChargerPage.getDayLabel(dayPosition)} ${slot.start}-${slot.end}`
        );
      }

      scheduleSummary = selectedSchedules.join(', ');
    }

    const removeBtn = this.page.locator('div:has(img)').first().locator('button:has(svg.feather-x)');
    if (await removeBtn.isVisible().catch(() => false)) {
      await removeBtn.click({ force: true });
      await this.page.waitForTimeout(500);
    }

    await this.uploadChargerImage(data.filePath);

    await expect(this.addChargerBtn).toBeEnabled({ timeout: 20000 });
    await this.addChargerBtn.click();
    await this.page.waitForLoadState('networkidle').catch(() => {});

    const addMoreBtn = this.page.getByRole('button', { name: /Add More Charger/i });
    const successToast = this.page
      .getByText(/added successfully|charger added|successfully|created successfully|submitted/i)
      .first();
    const errorToast = this.page.getByText(/error|failed|something went wrong|could not|unable to/i).first();

    const deadline = Date.now() + 240000;
    const submitAt = Date.now();
    let retryUsed = false;
    while (Date.now() < deadline) {
      await this.ensureActivePage();
      if (await addMoreBtn.isVisible().catch(() => false)) {
        return scheduleSummary;
      }
      if (await successToast.isVisible().catch(() => false)) {
        await addMoreBtn.waitFor({ state: 'visible', timeout: 90000 }).catch(() => {});
        if (await addMoreBtn.isVisible().catch(() => false)) {
          return scheduleSummary;
        }
      }
      if (await errorToast.isVisible().catch(() => false)) {
        const msg = (await errorToast.textContent().catch(() => '')) || 'unknown';
        throw new Error(`Add Charger failed: ${msg.trim()}`);
      }
      if (!retryUsed && Date.now() - submitAt > 15000 && await this.addChargerBtn.isEnabled().catch(() => false)) {
        await this.addChargerBtn.click().catch(() => {});
        retryUsed = true;
      }
      await this.page.waitForTimeout(500);
    }

    throw new Error('Add Charger submission did not reach success state (timeout 240s)');
  }

  async uploadChargerImage(filePath) {
    const uploadPrompt = this.page.getByText('Click to upload').first();
    const inputs = this.page.locator('input[type="file"]');
    const count = await inputs.count();

    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);
      await input.setInputFiles(filePath).catch(() => {});
      await this.page.waitForTimeout(800);

      const promptVisible = await uploadPrompt.isVisible().catch(() => false);
      const addEnabled = await this.addChargerBtn.isEnabled().catch(() => false);
      if (!promptVisible || addEnabled) {
        return;
      }
    }

    const fallbackInput = this.imageUploadInput;
    await fallbackInput.setInputFiles(filePath).catch(() => {});
    await this.page.waitForTimeout(800);
  }
}

module.exports = { AddChargerPage };


