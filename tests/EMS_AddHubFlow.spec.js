const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { AddHubPage } = require('../pages/AddHubPage');

const credPath = path.join(__dirname, '..', 'emsCredentials.js');

let email;
let password;

if (fs.existsSync(credPath)) {
  ({ email, password } = require('../emsCredentials'));
} else {
  require('dotenv').config();
  email = process.env.EMS_TEST_EMAIL || 'pushpa@kazam.in';
  password = process.env.EMS_TEST_PASSWORD || 'Shivanna@123';
}

test('EMS_AddHubFlow', async ({ browser }) => {
  test.setTimeout(35 * 60 * 1000);

  const context = await browser.newContext({
    permissions: ['geolocation']
  });

  const page = await context.newPage();
  const addHubPage = new AddHubPage(page);

  try {
    await addHubPage.login(email, password);
    await addHubPage.openOrg();

    const scenarios = [
      { label: 'single', chargerSelectionCount: 1, reAddCount: 1 },
      { label: 'multiple', chargerSelectionCount: 3, reAddCount: 3 }
    ];

    for (const scenario of scenarios) {
      const hubName = `AUTO_HUB_${scenario.label}_${Date.now()}`;
      await addHubPage.openManageOrg();
      await addHubPage.openManageHubs();
      await addHubPage.createHub(hubName, scenario.chargerSelectionCount);
      await addHubPage.openManageOrg();
      await addHubPage.searchHubInManageOrgDashboard(hubName);
      await addHubPage.openManageHubs();
      await addHubPage.searchHubInManageHubList(hubName);
      await expect(
        page.locator(`text=${hubName}`).first()
      ).toBeVisible({ timeout: 10000 });

      await addHubPage.openHubDetails(hubName);
      await addHubPage.searchChargerInHub();
      await addHubPage.removeChargerFromHub();
      await addHubPage.addChargerToHub(scenario.reAddCount);
      await addHubPage.searchChargerInHub();
      await addHubPage.tryDeleteHubWithCharger();
      await addHubPage.removeChargerFromHub();
      await addHubPage.deleteHub();
      await addHubPage.verifyHubNotPresentInManageOrgDashboard(hubName);
    }
  } finally {
    await context.close();
  }
});
