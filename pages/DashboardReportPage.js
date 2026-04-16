const { expect } = require('@playwright/test');

class DashboardReportPage {
  constructor(page) {
    this.page = page;
  }

  async selectDayFromCalendar(dayNumber) {
    const dayStr = String(dayNumber);
    const popover = this.page.locator('[role="dialog"]');
    let scope = (await popover.isVisible().catch(() => false)) ? popover : this.page;

    const trySelect = async () => {
      const candidates = scope.getByRole('button', { name: dayStr, exact: true });
      const count = await candidates.count();
      for (let i = 0; i < count; i++) {
        const candidate = candidates.nth(i);
        if (await candidate.isEnabled().catch(() => false)) {
          await expect(candidate).toBeVisible({ timeout: 15000 });
          await candidate.click({ force: true });
          return true;
        }
      }
      return false;
    };

    if (await trySelect()) return true;

    const prevBtn = popover.getByRole('button', { name: /Prev|Previous/i }).first();
    if (await prevBtn.isVisible().catch(() => false)) {
      await prevBtn.click({ force: true });
      scope = popover;
      if (await trySelect()) return true;
    }

    const yesterdayOption = scope.getByText('Yesterday', { exact: true });
    if (await yesterdayOption.isVisible().catch(() => false)) {
      await yesterdayOption.click({ force: true });
      return true;
    }

    const fallback = this.page.getByRole('button', { name: dayStr, exact: true }).first();
    if (await fallback.isVisible().catch(() => false)) {
      await fallback.click({ force: true });
      return true;
    }

    return false;
  }

  async loginAndOpenEnergyManagement(email, password) {
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

    const orgCard = this.page.locator('p[title="OEM EMS TEST"]');
    while (!(await orgCard.isVisible().catch(() => false))) {
      await this.page.mouse.wheel(0, 600).catch(() => {});
      await this.page.waitForTimeout(250);
    }
    await orgCard.click();
    await this.page.getByText('Continue to Dashboard', { exact: true }).click();
    await this.page.getByText('Energy Management', { exact: true }).click();
    await expect(this.page.getByText('Today', { exact: true }).first()).toBeVisible({ timeout: 30000 });
  }

  async selectYesterdayOnDashboard(dayNumber) {
    const todayText = this.page.getByText('Today', { exact: true }).first();
    const todayContainer = this.page.locator(
      '//div[contains(@class,"border-[1px]") and contains(@class,"cursor-pointer") and .//div[normalize-space()="Today"]]'
    ).first();

    if (await todayContainer.isVisible().catch(() => false)) {
      await todayContainer.click({ force: true });
    } else {
      await todayText.click({ force: true });
    }

    const selected = await this.selectDayFromCalendar(dayNumber);
    await this.page.waitForTimeout(1000);
    return selected;
  }

  async getDashboardKpis() {
    const gridValue = this.page.locator('(//section/section/section//section[1]//div[1]//div[1]//h6)[1]');
    const chargerValue = this.page.locator('(//section/section/section//section[1]//div[2]//div[1]//h6)[1]');
    const efficiencyValue = this.page.locator('(//section/section/section//section[1]//div[3]//div[1]//h6)[1]');

    await expect(gridValue).toBeVisible({ timeout: 15000 });
    await expect(chargerValue).toBeVisible({ timeout: 15000 });
    await expect(efficiencyValue).toBeVisible({ timeout: 15000 });

    return {
      gridMwhText: ((await gridValue.textContent()) || '').trim(),
      chargerMwhText: ((await chargerValue.textContent()) || '').trim(),
      efficiencyText: ((await efficiencyValue.textContent()) || '').trim()
    };
  }

  async getDashboardHubNames() {
    const rows = this.page.locator('table tbody tr');
    const count = await rows.count();
    const hubNames = [];

    for (let index = 0; index < count; index++) {
      const hubName = ((await rows.nth(index).locator('td').first().textContent()) || '').trim();
      if (hubName) {
        hubNames.push(hubName);
      }
    }

    return hubNames;
  }

  async openEnergyFunnelReport() {
    await this.page.getByText('Reports & Analytics', { exact: true }).click();
    await this.page.waitForLoadState('networkidle');

    await this.page.getByRole('button', { name: 'EMS', exact: true }).click();
    await this.page.getByText('Energy Funnel', { exact: true }).click();
    await expect(this.page.getByText('Energy Funnel Preview', { exact: true })).toBeVisible({ timeout: 15000 });
  }

  async selectHub(hubName) {
    const hubField = this.page.locator('div').filter({ hasText: /^Hub/ }).locator('input,button').first();
    await hubField.click();
    await this.page.getByText(hubName, { exact: true }).click();
  }

  async selectYesterdayInReport(dayNumber) {
    const selected = await this.selectDayFromCalendar(dayNumber);
    await this.page.waitForTimeout(500);
    return selected;
  }

  async generateReport() {
    await this.page.getByRole('button', { name: /Generate Report/i }).click();
    await this.page.waitForLoadState('networkidle');
    await expect(this.page.getByText('Summary', { exact: true })).toBeVisible({ timeout: 30000 });
  }

  async getPreviewSummary() {
    const summarySection = this.page.locator('div').filter({ hasText: /^Summary/ }).first();
    const summaryText = ((await summarySection.textContent()) || '').replace(/\s+/g, ' ').trim();

    return {
      totalGridUsageText: summaryText.match(/Total Grid Usage:\s*([\d.,]+\s*kWh)/i)?.[1] || '0',
      chargerUsageText: summaryText.match(/Charger Usage:\s*([\d.,]+\s*kWh)/i)?.[1] || '0',
      auxiliaryUsageText: summaryText.match(/Auxiliary Usage:\s*([\d.,]+\s*kWh)/i)?.[1] || '0',
      efficiencyText: summaryText.match(/Grid to Charger Efficiency:\s*([\d.,]+\s*%)/i)?.[1] || '0'
    };
  }

  async downloadCurrentReport() {
    const [download] = await Promise.all([
      this.page.waitForEvent('download'),
      this.page.getByRole('button', { name: /Download/i }).click()
    ]);

    return download;
  }
}

module.exports = { DashboardReportPage };
