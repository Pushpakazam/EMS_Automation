const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const PDFMerger = require('pdf-merger-js').default;

(async () => {
  try {
    const reportsDir = path.resolve(__dirname, '../reports');

    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir);
    }

    const basePath = path.resolve(__dirname, '../ortoni-report/index.html');

    if (!fs.existsSync(basePath)) {
      throw new Error('Ortoni report not found. Run tests first.');
    }

    const now = new Date();
    const formattedDate =
      now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0') + '_' +
      String(now.getHours()).padStart(2, '0') + '-' +
      String(now.getMinutes()).padStart(2, '0') + '-' +
      String(now.getSeconds()).padStart(2, '0');

    const finalPdf = path.join(
      reportsDir,
      `EMS_Automation_${formattedDate}.pdf`
    );

    const dashboardPdf = path.join(reportsDir, 'dashboard.pdf');
    const testsPdf = path.join(reportsDir, 'tests.pdf');

    const browser = await chromium.launch();
    const page = await browser.newPage();

    console.log('Generating Dashboard PDF...');
    await page.goto(`file://${basePath}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    await page.pdf({
      path: dashboardPdf,
      format: 'A4',
      landscape: true,
      printBackground: true,
      scale: 0.65
    });

    console.log('Generating Tests PDF...');
    await page.goto(`file://${basePath}#/tests`, { waitUntil: 'networkidle' });
    await page.waitForSelector('text=Filter Status', { timeout: 15000 });

    await page.pdf({
      path: testsPdf,
      format: 'A4',
      landscape: true,
      printBackground: true,
    });

    await browser.close();

    console.log('Merging PDFs...');
    const merger = new PDFMerger();
    await merger.add(dashboardPdf);
    await merger.add(testsPdf);
    await merger.save(finalPdf);

    fs.unlinkSync(dashboardPdf);
    fs.unlinkSync(testsPdf);

    console.log('PDF Generated Successfully');
    console.log(`Saved As: ${finalPdf}`);

  } catch (error) {
    console.error('PDF Generation Failed');
    console.error(error.message);
    process.exit(1);
  }
})();
