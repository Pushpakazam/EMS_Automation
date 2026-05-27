const { expect } = require('@playwright/test');

const METER_CONDITIONS = [
  'Power factor error',
  'Power error',
  'Powered by Diesel Generator',
];

class SmartMeterPage {
  constructor(page) {
    this.page = page;

    this.hubDropdown = page.locator('select[name="hub"]');
    this.makeDropdown = page.locator('select[name="make"]');
    this.modelDropdown = page.locator('select[name="model"]');

    this.searchInput = page.locator(
      'input[placeholder*="Search by meter"], input[placeholder*="Search by Meter"], input[placeholder*="Search"]'
    );
  }

  static uniqueId(prefix) {
    return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  }

  async getSelectedOptionLabel(selectLocator) {
    return selectLocator.evaluate((el) => {
      const select = el;
      const selected = select.options[select.selectedIndex];
      return selected ? (selected.textContent || '').trim() : '';
    });
  }

  async getValidOptions(selectLocator) {
    const options = await selectLocator.locator('option').evaluateAll((opts) =>
      opts.map((o) => ({
        value: o.value,
        label: (o.textContent || '').trim(),
        disabled: o.disabled,
      }))
    );

    return options.filter(
      (o) =>
        o.value &&
        o.label &&
        !o.disabled &&
        !/select|input meter id|output terminal|meter type|data logger id/i.test(o.label)
    );
  }

  getSearchPlan(expected, searchModeIndex) {
    const plans = [
      { key: 'meterId', label: 'Meter ID', query: expected.meterId },
      { key: 'name', label: 'Name', query: expected.name },
      { key: 'make', label: 'Make', query: expected.make },
      { key: 'model', label: 'Model', query: expected.model },
      { key: 'zone', label: 'Zone(Hub)', query: expected.hub },
    ];
    return plans[searchModeIndex % plans.length];
  }

  // STEP 1: Login and land on dashboard.
  async loginAndOpenDashboard(email, password) {
    await this.page.goto(
      'https://novo.kazam.in/auth/login'
    );

    const emailInput = this.page.locator('input[name="email"]');
    const passwordInput = this.page.locator('input[name="password"]');
    const loginButton = this.page.getByRole('button', { name: /login/i });
    await emailInput.fill(email);
    await passwordInput.fill(password);
    await loginButton.click();

    const notNowBtn = this.page.locator('button:has-text("Not now")');
    if (await notNowBtn.isVisible()) await notNowBtn.click();
    const orgCard = this.page.locator('p[title="OEM EMS TEST"]');
    while (!(await orgCard.isVisible().catch(() => false))) {
      await this.page.mouse.wheel(0, 600).catch(() => {});
      await this.page.waitForTimeout(250);
    }
    await orgCard.click();
    await this.page.getByText('Continue to Dashboard', { exact: true }).click();
  }

  // STEP 2: Open Manage Smart Meter > Add smart meter form.
  async openAddSmartMeterForm() {
    const plusButton = this.page.locator('button:has(svg.feather-plus)');
    await expect(plusButton).toBeVisible({ timeout: 30000 });
    await plusButton.click();
    await this.page.getByRole('button', { name: 'Manage Smart Meter' }).click();
    await this.page.getByRole('button', { name: 'Add smart meter' }).click();

    await expect(this.hubDropdown).toBeVisible();
    await this.waitForHubOptions();
  }

  async waitForHubOptions() {
    await this.page.waitForFunction(() => {
      const select = document.querySelector('select[name="hub"]');
      return select && select.options.length > 1;
    });
  }

  /** Wait until a `<select>` has at least one real (non-placeholder) option. */
  async waitForValidOptions(selectLocator) {
    await expect(selectLocator).toBeVisible({ timeout: 15000 });
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      const opts = await this.getValidOptions(selectLocator);
      if (opts.length > 0) return;
      await this.page.waitForTimeout(400);
    }
    throw new Error('Timed out waiting for dropdown options');
  }

  async selectTerminalPair(inputLabel, outputLabel) {
    const inputDropdown = this.page.locator('select[name="input"]');
    const outputDropdown = this.page.locator('select[name="output"]');

    await expect(inputDropdown).toBeVisible({ timeout: 15000 });
    await expect(outputDropdown).toBeVisible({ timeout: 15000 });

    await inputDropdown.selectOption({ label: inputLabel });
    const selectedInputLabel = await this.getSelectedOptionLabel(inputDropdown);
    expect(selectedInputLabel).toBe(inputLabel);
    console.log(`[TERMINAL] Input selected: ${inputLabel}`);

    await this.page.waitForTimeout(1200);

    const outputOptions = await outputDropdown.locator('option').evaluateAll((opts) =>
      opts.map((o) => ({
        value: o.value,
        label: (o.textContent || '').trim(),
        disabled: o.disabled,
      }))
    );

    const selectable = outputOptions.filter(
      (o) => o.value && o.label && !o.disabled && !/output terminal/i.test(o.label)
    );

    const target = selectable.find((o) => o.label.toLowerCase() === outputLabel.toLowerCase());

    if (!target) {
      console.log(
        `[TERMINAL][SKIP] Invalid pair ${inputLabel} -> ${outputLabel}. Available: ${selectable
          .map((o) => o.label)
          .join(', ')}`
      );
      return { ok: false, available: selectable.map((o) => o.label) };
    }

    await outputDropdown.selectOption(target.value);
    await expect(outputDropdown).toHaveValue(target.value, { timeout: 10000 });
    const selectedOutputLabel = await this.getSelectedOptionLabel(outputDropdown);
    expect(selectedOutputLabel).toBe(target.label);
    console.log(`[TERMINAL] Output selected: ${target.label}`);

    return { ok: true, selectedOutput: target.label };
  }

  async findInputTerminalMeterDropdown() {
    const selectors = [
      'select[name="input_terminal_meter"]',
      'select[name="input_meter"]',
      'select[id="input_terminal_meter"]',
      'select[id="input_meter"]',
    ];

    for (const selector of selectors) {
      const loc = this.page.locator(selector).first();
      if ((await loc.count()) > 0) return loc;
    }

    const fallback = this.page
      .locator('select')
      .filter({ has: this.page.locator('option', { hasText: 'Input meter ID' }) })
      .first();

    if ((await fallback.count()) > 0) return fallback;
    return null;
  }

  async selectAnyInputTerminalMeter(inputTerminal) {
    if (inputTerminal === 'Grid') {
      console.log('[TERMINAL] Input is Grid -> input terminal meter not required.');
      return { ok: true, selected: '' };
    }

    const dropdown = await this.findInputTerminalMeterDropdown();
    if (!dropdown) {
      console.log(`[TERMINAL][SKIP] Dropdown not found for input "${inputTerminal}"`);
      return { ok: false, reason: 'dropdown_not_found' };
    }

    await dropdown.waitFor({ state: 'visible', timeout: 15000 });

    const timeoutMs = 30000;
    const pollMs = 1000;
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      const disabled = await dropdown.isDisabled();

      if (!disabled) {
        const rawOptions = await dropdown.locator('option').evaluateAll((opts) =>
          opts.map((o) => ({
            value: o.value,
            label: (o.textContent || '').trim(),
            disabled: o.disabled,
          }))
        );

        const options = rawOptions.filter(
          (o) => o.value && o.label && !o.disabled && !/select|input meter id/i.test(o.label)
        );

        if (options.length) {
          await dropdown.selectOption(options[0].value);
          await expect(dropdown).toHaveValue(options[0].value, { timeout: 10000 });
          console.log(`[TERMINAL] Input terminal meter selected (${inputTerminal}): ${options[0].label}`);
          return { ok: true, selected: options[0].label };
        }
      }

      await this.page.waitForTimeout(pollMs);
    }

    console.log(`[TERMINAL][SKIP] No input terminal meter options loaded for input "${inputTerminal}"`);
    return { ok: false, reason: 'no_options' };
  }

  // STEP 3: Make sure only intended meter condition is ON.
  async setMeterCondition(selectedCondition) {
    for (const condition of METER_CONDITIONS) {
      const card = this.page
        .locator(
          `xpath=//*[normalize-space(text())="${condition}"]/ancestor::*[.//input[@type="checkbox"] or .//*[@role="switch"] or .//button][1]`
        )
        .first();
      const toggle = card.locator('input[type="checkbox"],[role="switch"],button').first();
      await expect(toggle).toBeVisible({ timeout: 10000 });

      const shouldBeOn = condition === selectedCondition;

      let isOn = false;
      const ariaChecked = await toggle.getAttribute('aria-checked');
      const inputChecked = await toggle
        .evaluate((el) => (el instanceof HTMLInputElement ? el.checked : false))
        .catch(() => false);

      if (ariaChecked !== null) isOn = ariaChecked === 'true';
      else isOn = inputChecked;

      if (isOn !== shouldBeOn) {
        await toggle.click({ force: true });
        await this.page.waitForTimeout(300);
      }

      const verifyAriaChecked = await toggle.getAttribute('aria-checked');
      const verifyInputChecked = await toggle
        .evaluate((el) => (el instanceof HTMLInputElement ? el.checked : false))
        .catch(() => false);
      const verifiedOn = verifyAriaChecked !== null ? verifyAriaChecked === 'true' : verifyInputChecked;

      if (verifiedOn !== shouldBeOn) {
        throw new Error(`Failed to set meter condition "${condition}" to ${shouldBeOn ? 'ON' : 'OFF'}`);
      }
    }

    console.log(`[CONDITION] Selected: ${selectedCondition}`);
  }

  async assertAtLeastOneMeterConditionSelected() {
    let selected = 0;

    for (const condition of METER_CONDITIONS) {
      const card = this.page
        .locator(
          `xpath=//*[normalize-space(text())="${condition}"]/ancestor::*[.//input[@type="checkbox"] or .//*[@role="switch"] or .//button][1]`
        )
        .first();
      const toggle = card.locator('input[type="checkbox"],[role="switch"],button').first();

      if (!(await toggle.isVisible().catch(() => false))) continue;

      const aria = await toggle.getAttribute('aria-checked');
      if (aria !== null) {
        if (aria === 'true') selected += 1;
        continue;
      }

      const checked = await toggle
        .evaluate((el) => (el instanceof HTMLInputElement ? el.checked : false))
        .catch(() => false);

      if (checked) selected += 1;
    }

    expect(selected, 'At least one meter condition must be selected').toBeGreaterThan(0);
  }

  // STEP 4: Create model from popup and assert selection.
  async createAndSelectModelForMake(makeLabel) {
    await this.page.getByRole('button', { name: 'Add smart meter model', exact: true }).click();

    const popup = this.page.getByRole('heading', { name: 'Add smart meter model' }).locator('..').locator('..');
    const popupMake = popup.locator('select');
    await popupMake.first().waitFor({ state: 'visible' });
    await popupMake.first().selectOption({ label: makeLabel });

    const modelName = SmartMeterPage.uniqueId('AutoModel');
    await popup.locator('input').fill(modelName);
    await popup.getByRole('button', { name: 'Add Smart Meter Model', exact: true }).click();

    await this.page.waitForTimeout(1500);
    return modelName;
  }

  async verifySmartMeterInList(expected, searchModeIndex) {
    await this.ensureSmartMeterListOpen();
    await expect(this.searchInput.first()).toBeVisible({ timeout: 20000 });

    const plan = this.getSearchPlan(expected, searchModeIndex);

    console.log('\n[SEARCH] ----------------------------------------');
    console.log(`[SEARCH] By: ${plan.label}`);
    console.log(`[SEARCH] Query: ${plan.query}`);
    console.log(`[SEARCH] Expected details: ${JSON.stringify(expected)}`);

    const searchBox = this.searchInput.first();
    await searchBox.click();
    await searchBox.fill(plan.query);
    await searchBox.press('Enter');
    await this.page.waitForTimeout(2500);

    const filteredRow = this.page.locator('tr', { hasText: expected.meterId }).first();
    await expect(filteredRow).toBeVisible({ timeout: 20000 });

    const rowCells = (await filteredRow.locator('td').allTextContents()).map((t) => t.trim());
    console.log(`[SEARCH] Actual row: ${JSON.stringify(rowCells)}`);

    await expect(filteredRow).toContainText(expected.hub);
    await expect(filteredRow).toContainText(expected.name);
    await expect(filteredRow).toContainText(expected.make);
    await expect(filteredRow).toContainText(expected.model);
    await expect(filteredRow).toContainText(expected.meterId);
    await expect(filteredRow).toContainText(expected.meterType);
    await expect(filteredRow).toContainText(expected.input);
    await expect(filteredRow).toContainText(expected.output);

    const rowText = rowCells.join(' | ').toLowerCase();
    expect(rowText).toContain(String(plan.query).toLowerCase());
    console.log(`[SEARCH] PASS (${plan.label})`);

    await searchBox.click();
    await searchBox.press('Control+A');
    await searchBox.press('Backspace');
    await searchBox.press('Enter');
    await this.page.waitForTimeout(1500);

    console.log('[SEARCH] Cleared');
    console.log('[SEARCH] ----------------------------------------\n');
  }

  async waitForMeterCreationCompletion(submitButton = this.page.getByRole('button', { name: 'submit' })) {
    const toastContainer = this.page.locator(
      [
        '[role="alert"]',
        '[aria-live]',
        '.Toastify__toast',
        '[class*="toast"]',
        '[class*="Toast"]',
        '[data-sonner-toast]',
        '[data-hot-toast]',
      ].join(',')
    );
    const successToast = toastContainer.filter({ hasText: /meter created successfully|created successfully|success/i }).first();
    const errorToast = toastContainer
      .filter({ hasText: /error|failed|something went wrong|could not|unable/i })
      .first();
    const addSmartMeterButton = this.page.getByRole('button', { name: 'Add smart meter' });

    const deadline = Date.now() + 120000;
    const submittedAt = Date.now();
    let retryUsed = false;

    while (Date.now() < deadline) {
      if (await addSmartMeterButton.isVisible().catch(() => false)) {
        return addSmartMeterButton;
      }

      if (await successToast.isVisible().catch(() => false)) {
        await addSmartMeterButton.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
        if (await addSmartMeterButton.isVisible().catch(() => false)) {
          return addSmartMeterButton;
        }
      }

      if (await errorToast.isVisible().catch(() => false)) {
        const msg = (await errorToast.textContent().catch(() => '')) || 'unknown';
        throw new Error(`Meter creation failed: ${msg.trim()}`);
      }

      if (
        !retryUsed &&
        Date.now() - submittedAt > 15000 &&
        (await submitButton.isEnabled().catch(() => false))
      ) {
        await submitButton.click().catch(() => {});
        retryUsed = true;
      }

      await this.page.waitForTimeout(1000);
    }

    throw new Error('Timed out waiting for smart meter creation to complete');
  }

  async ensureSmartMeterListOpen() {
    const visible = await this.searchInput.first().isVisible().catch(() => false);
    if (visible) return;

    const backLink = this.page.getByRole('link', { name: 'Back' });
    if (await backLink.isVisible().catch(() => false)) {
      await backLink.click();
    } else {
      const backButton = this.page.getByRole('button', { name: 'Back' });
      if (await backButton.isVisible().catch(() => false)) {
        await backButton.click();
      }
    }

    const smartMetersBreadcrumb = this.page.getByText('Smart meters', { exact: true });
    if (await smartMetersBreadcrumb.isVisible().catch(() => false)) {
      await smartMetersBreadcrumb.click();
    }

    await this.page.waitForLoadState('networkidle').catch(() => {});
  }

  async recoverToAddSmartMeterForm() {
    const addBtn = this.page.getByRole('button', { name: 'Add smart meter' });
    if (await addBtn.isVisible().catch(() => false)) {
      await addBtn.click().catch(() => {});
      await this.waitForHubOptions().catch(() => {});
      return true;
    }

    const manageBtn = this.page.getByRole('button', { name: 'Manage Smart Meter' });
    if (await manageBtn.isVisible().catch(() => false)) {
      await manageBtn.click().catch(() => {});
    }

    if (await addBtn.isVisible().catch(() => false)) {
      await addBtn.click().catch(() => {});
      await this.waitForHubOptions().catch(() => {});
      return true;
    }

    await this.page.reload();
    await this.waitForHubOptions().catch(() => {});
    return true;
  }
}

module.exports = {
  SmartMeterPage,
  METER_CONDITIONS,
};

