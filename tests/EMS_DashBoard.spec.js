const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { test, expect } = require('@playwright/test');
const { DashboardReportPage } = require('../pages/DashboardReportPage');

const DOWNLOAD_DIR = path.join(process.cwd(), 'test-results', 'dashboard-report-downloads');

function cleanText(value) {
  return (value || '').replace(/,/g, '').replace(/\s+/g, ' ').trim();
}

function getNumber(value) {
  const match = cleanText(value).match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function toMwh(kwhValue) {
  return Number((kwhValue / 1000).toFixed(3));
}

function closeEnough(actual, expected, tolerance, label) {
  expect(
    Math.abs(actual - expected),
    `${label} mismatch. Expected ${expected}, got ${actual}`
  ).toBeLessThanOrEqual(tolerance);
}

function getYesterdayDayNumber() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.getDate().toString();
}

function getSharedStrings(zip) {
  const filePath = path.join(zip, 'xl', 'sharedStrings.xml');
  if (!fs.existsSync(filePath)) return [];

  const xml = fs.readFileSync(filePath, 'utf8');
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((item) =>
    [...item[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((part) => part[1]).join('')
  );
}

function getColumnIndex(columnRef) {
  let value = 0;
  for (const char of columnRef) {
    value = value * 26 + (char.charCodeAt(0) - 64);
  }
  return value - 1;
}

function readRowsFromXlsx(filePath) {
  const extractFolder = path.join(
    DOWNLOAD_DIR,
    `extract_${path.basename(filePath, path.extname(filePath))}_${Date.now()}`
  );
  const tempZipPath = path.join(extractFolder, 'report.zip');

  fs.mkdirSync(extractFolder, { recursive: true });
  fs.copyFileSync(filePath, tempZipPath);

  execFileSync('powershell.exe', [
    '-NoProfile',
    '-Command',
    `Expand-Archive -LiteralPath '${tempZipPath.replace(/'/g, "''")}' -DestinationPath '${extractFolder.replace(/'/g, "''")}' -Force`
  ]);

  const sharedStrings = getSharedStrings(extractFolder);
  const sheetPath = path.join(extractFolder, 'xl', 'worksheets', 'sheet1.xml');
  const xml = fs.readFileSync(sheetPath, 'utf8');
  const rows = [];

  for (const rowMatch of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row = [];

    for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const ref = cellMatch[1].match(/r="([A-Z]+)\d+"/);
      if (!ref) continue;

      const index = getColumnIndex(ref[1]);
      const type = (cellMatch[1].match(/t="([^"]+)"/) || [])[1];
      const rawValue = (cellMatch[2].match(/<v>([\s\S]*?)<\/v>/) || [])[1] || '';

      row[index] = type === 's' ? sharedStrings[Number(rawValue)] || '' : rawValue;
    }

    if (row.some(Boolean)) {
      rows.push(row.map((cell) => (cell || '').toString().trim()));
    }
  }

  return rows;
}

function readRowsFromCsv(filePath) {
  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.split(',').map((cell) => cell.trim()))
    .filter((row) => row.some(Boolean));
}

function readDownloadedRows(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.xlsx') return readRowsFromXlsx(filePath);
  return readRowsFromCsv(filePath);
}

function findRow(rows, label) {
  return rows.find((row) => (row[0] || '').trim().toLowerCase() === label.toLowerCase());
}

function findSummaryValue(rows, label) {
  const matchRow = rows.find((row) => row.some((cell) => cell.trim().toLowerCase() === label.toLowerCase()));
  if (!matchRow) {
    throw new Error(`Could not find "${label}" in downloaded report`);
  }

  const labelIndex = matchRow.findIndex((cell) => cell.trim().toLowerCase() === label.toLowerCase());
  return matchRow.slice(labelIndex + 1).find(Boolean) || '0';
}

function getDownloadedSummary(filePath) {
  const rows = readDownloadedRows(filePath);

  return {
    totalGridUsageKwh: getNumber(findSummaryValue(rows, 'Total Grid Usage')),
    chargerUsageKwh: getNumber(findSummaryValue(rows, 'Charger Usage')),
    auxiliaryUsageKwh: getNumber(findSummaryValue(rows, 'Auxiliary Usage')),
    efficiencyPct: getNumber(findSummaryValue(rows, 'Grid to Charger Efficiency')),
    ltPanelRow: findRow(rows, 'LT Panel'),
    chargingBayRow: findRow(rows, 'Charging Bay'),
    chargerRow: findRow(rows, 'Charger'),
    depotLossRow: findRow(rows, 'Overall Depot Loss')
  };
}

test('Validate EMS Dashboard with Energy Funnel preview and downloaded report', async ({ browser }) => {
  test.setTimeout(12 * 60 * 1000);

  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  const dashboardPage = new DashboardReportPage(page);
  const yesterdayDay = getYesterdayDayNumber();
  const todayDay = new Date().getDate().toString();

  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

  try {
    await dashboardPage.loginAndOpenEnergyManagement('pushpa@kazam.in', 'Shivanna@123');
    const usedYesterday = await dashboardPage.selectYesterdayOnDashboard(yesterdayDay);
    const reportDay = usedYesterday ? yesterdayDay : todayDay;

    const dashboardSummary = await dashboardPage.getDashboardKpis();
    const hubNames = await dashboardPage.getDashboardHubNames();

    expect(hubNames.length).toBeGreaterThan(0);

    const totalFromReports = {
      totalGridUsageKwh: 0,
      chargerUsageKwh: 0,
      auxiliaryUsageKwh: 0
    };

    await dashboardPage.openEnergyFunnelReport();

    for (const hubName of hubNames) {
      await dashboardPage.selectHub(hubName);
      await dashboardPage.selectYesterdayInReport(reportDay);
      await dashboardPage.generateReport();

      const previewSummary = await dashboardPage.getPreviewSummary();

      const download = await dashboardPage.downloadCurrentReport();
      const filePath = path.join(
        DOWNLOAD_DIR,
        `${hubName.replace(/[^\w.-]+/g, '_')}_${Date.now()}${path.extname(download.suggestedFilename()) || '.xlsx'}`
      );
      await download.saveAs(filePath);

      const reportSummary = getDownloadedSummary(filePath);

      closeEnough(reportSummary.totalGridUsageKwh, getNumber(previewSummary.totalGridUsageText), 0.5, `${hubName} total grid usage`);
      closeEnough(reportSummary.chargerUsageKwh, getNumber(previewSummary.chargerUsageText), 0.5, `${hubName} charger usage`);
      closeEnough(reportSummary.auxiliaryUsageKwh, getNumber(previewSummary.auxiliaryUsageText), 0.5, `${hubName} auxiliary usage`);
      closeEnough(reportSummary.efficiencyPct, getNumber(previewSummary.efficiencyText), 0.2, `${hubName} efficiency`);

      totalFromReports.totalGridUsageKwh += getNumber(previewSummary.totalGridUsageText);
      totalFromReports.chargerUsageKwh += getNumber(previewSummary.chargerUsageText);
      totalFromReports.auxiliaryUsageKwh += getNumber(previewSummary.auxiliaryUsageText);
    }

    const totalGridMwh = toMwh(totalFromReports.totalGridUsageKwh);
    const totalChargerMwh = toMwh(totalFromReports.chargerUsageKwh);
    const totalEfficiencyPct = totalFromReports.totalGridUsageKwh
      ? Number(((totalFromReports.chargerUsageKwh / totalFromReports.totalGridUsageKwh) * 100).toFixed(2))
      : 0;

    closeEnough(totalGridMwh, getNumber(dashboardSummary.gridMwhText), 0.5, 'Dashboard total grid usage');
    closeEnough(totalChargerMwh, getNumber(dashboardSummary.chargerMwhText), 0.5, 'Dashboard charger usage');
    closeEnough(totalEfficiencyPct, getNumber(dashboardSummary.efficiencyText), 1, 'Dashboard efficiency');
  } finally {
    await context.close();
  }
});
