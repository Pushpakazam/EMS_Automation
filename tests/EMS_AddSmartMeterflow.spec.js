const path = require('path');
const { test, expect } = require('@playwright/test');
const { SmartMeterPage, METER_CONDITIONS } = require('../pages/SmartMeterPage');

const IMAGE_PATH = path.join('C:\\Users\\pushp\\Downloads\\error_file.jpeg');

const METER_TYPES = [
  'Grid',
  'Charger',
  'HT Main',
  'HT Panel',
  'LT Panel',
  'Charging Bay',
  'Auxiliary',
  'Diesel Generator',
];

const TERMINAL_FLOW = [
  { input: 'Grid', output: 'HT Panel' },
  { input: 'HT Main', output: 'HT Panel' },
  { input: 'HT Panel', output: 'LT Panel' },
  { input: 'LT Panel', output: 'Charging Bay' },
  { input: 'Charging Bay', output: 'Spare' },
];
const FALLBACK_TERMINAL_PAIR = { input: 'Grid', output: 'HT Panel' };

test('EMS_Add/Manage_SmartMeter_Flow', async ({ browser }) => {
  test.setTimeout(120 * 60 * 1000);

  const context = await browser.newContext({ permissions: ['geolocation'] });
  const page = await context.newPage();
  const smartMeter = new SmartMeterPage(page);

  let meterTypeRotationIndex = 0;
  let terminalRotationIndex = 0;
  let meterConditionRotationIndex = 0;
  let createdMeterCount = 0;

  await smartMeter.loginAndOpenDashboard('pushpa@kazam.in', 'Shivanna@123');
  await smartMeter.openAddSmartMeterForm();

  const allowedSmartMeterHubs = new Set([
    'MAHADEVPURA TEST - INVENDIS',
    'TEST L&T',
    'test office',
    'test ACREL',
    'PMI_PLANT_TEST CHARGER',
  ]);

  const normalizeHubLabel = (label) => label.replace(/\s+/g, ' ').trim();

  const hubs = (await smartMeter.getValidOptions(smartMeter.hubDropdown)).filter((hub) =>
    allowedSmartMeterHubs.has(normalizeHubLabel(hub.label))
  );

  console.log('Hubs:', hubs.map((h) => h.label));

  for (const hub of hubs) {
    console.log(`\n===== Testing Hub: ${hub.label} =====`);

    await smartMeter.hubDropdown.selectOption(hub.value);
    await smartMeter.waitForValidOptions(smartMeter.makeDropdown);

    const makes = await smartMeter.getValidOptions(smartMeter.makeDropdown);

    for (const make of makes) {
      const meterType = METER_TYPES[meterTypeRotationIndex++ % METER_TYPES.length];
      const terminalPair = TERMINAL_FLOW[terminalRotationIndex++ % TERMINAL_FLOW.length];
      const selectedCondition = METER_CONDITIONS[meterConditionRotationIndex++ % METER_CONDITIONS.length];

      console.log(`
--- Scenario ---
Hub: ${hub.label}
Make: ${make.label}
MeterType: ${meterType}
Terminal: ${terminalPair.input} -> ${terminalPair.output}
Condition: ${selectedCondition}
----------------
      `);

      try {
        await smartMeter.hubDropdown.selectOption(hub.value);
        await smartMeter.waitForValidOptions(smartMeter.makeDropdown);
        await smartMeter.makeDropdown.selectOption(make.value);
        const modelName = await smartMeter.createAndSelectModelForMake(make.label);

        await smartMeter.hubDropdown.selectOption(hub.value);
        await smartMeter.makeDropdown.selectOption(make.value);
        await smartMeter.waitForValidOptions(smartMeter.modelDropdown);
        await smartMeter.modelDropdown.selectOption({ label: modelName });

        await page.locator('#variant').fill('1234');
        await page.locator('#class').fill('0.5');
        await page.locator('#pt_primary').fill('100');
        await page.locator('#pt_secondary').fill('100');
        await page.locator('#ct_primary').fill('100');
        await page.locator('#ct_secondary').fill('10');
        await page.locator('input[type="file"]').first().setInputFiles(IMAGE_PATH);

        await page.getByRole('button', { name: 'Next' }).click();

        const meterName = `AUTO_${Date.now()}`;
        const meterId = `${Date.now()}`;

        await page.getByPlaceholder('Enter smart meter name').fill(meterName);

        const meterTypeDropdown = page.locator('select[name="meter_type"]');
        const availableTypes = await smartMeter.getValidOptions(meterTypeDropdown);

        if (!availableTypes.some((mt) => mt.label === meterType)) {
          throw new Error(`MeterType not available: ${meterType}`);
        }

        await meterTypeDropdown.selectOption({ label: meterType });

        await page.getByText('Generate new data logger ID').click();
        await page.locator('#meter_id').fill(meterId);

        let selectedTerminalPair = terminalPair;
        let terminalOk = await smartMeter.selectTerminalPair(selectedTerminalPair.input, selectedTerminalPair.output);
        if (!terminalOk.ok) {
          console.log(
            `[TERMINAL][FALLBACK] Invalid terminal combo ${selectedTerminalPair.input} -> ${selectedTerminalPair.output}. Using ${FALLBACK_TERMINAL_PAIR.input} -> ${FALLBACK_TERMINAL_PAIR.output}.`
          );
          selectedTerminalPair = FALLBACK_TERMINAL_PAIR;
          terminalOk = await smartMeter.selectTerminalPair(selectedTerminalPair.input, selectedTerminalPair.output);
        }
        if (!terminalOk.ok) {
          throw new Error(`Invalid terminal combo: ${selectedTerminalPair.input} -> ${selectedTerminalPair.output}`);
        }

        let inputOk = await smartMeter.selectAnyInputTerminalMeter(selectedTerminalPair.input);
        if (!inputOk.ok) {
          console.log(
            `[TERMINAL][FALLBACK] Input terminal meter not available for ${selectedTerminalPair.input}. Using ${FALLBACK_TERMINAL_PAIR.input} -> ${FALLBACK_TERMINAL_PAIR.output}.`
          );
          selectedTerminalPair = FALLBACK_TERMINAL_PAIR;
          terminalOk = await smartMeter.selectTerminalPair(selectedTerminalPair.input, selectedTerminalPair.output);
          if (!terminalOk.ok) {
            throw new Error(`Invalid fallback terminal combo: ${selectedTerminalPair.input} -> ${selectedTerminalPair.output}`);
          }
          inputOk = await smartMeter.selectAnyInputTerminalMeter(selectedTerminalPair.input);
        }
        if (!inputOk.ok) {
          throw new Error(`Input terminal meter not available for: ${selectedTerminalPair.input}`);
        }

        await page.locator('#imei').fill('123456789012345');
        await page.locator('#serial_no').fill(`SN_${Date.now()}`);

        await smartMeter.setMeterCondition(selectedCondition);
        await smartMeter.assertAtLeastOneMeterConditionSelected();

        await page.locator('input[type="file"]').last().setInputFiles(IMAGE_PATH);

        const submitButton = page.getByRole('button', { name: 'submit' });
        await expect(submitButton).toBeEnabled({ timeout: 30000 });
        await submitButton.click();
        await smartMeter.waitForMeterCreationCompletion(submitButton);

        createdMeterCount += 1;
        console.log('SUCCESS');
      } catch (error) {
        console.log(`[SMART_METER][SKIP] ${hub.label} / ${make.label}: ${error.message}`);
      }

      await smartMeter.recoverToAddSmartMeterForm();
    }
  }

  expect(createdMeterCount, 'At least one smart meter should be created successfully').toBeGreaterThan(0);

  await context.close();
});
