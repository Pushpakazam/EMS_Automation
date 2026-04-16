const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const reportsDir = path.resolve(__dirname, '../reports');
const zipPath = path.join(reportsDir, 'EMS_Automation_Ortoni_HTML.zip');
const ortoniReportDir = path.resolve(__dirname, '../ortoni-report');

if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir);
}

if (!fs.existsSync(path.join(ortoniReportDir, 'ortoni-report.html'))) {
  console.error('Ortoni HTML report file not found!');
  process.exit(1);
}

const output = fs.createWriteStream(zipPath);
const archive = archiver('zip', { zlib: { level: 9 } });

archive.pipe(output);
archive.directory(ortoniReportDir, false);
archive.finalize();

output.on('close', () => {
  console.log('Ortoni HTML report zipped successfully');
  console.log(`Saved As: ${zipPath}`);
});
