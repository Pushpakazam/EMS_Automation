require('dotenv').config();
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

function findLatestPdf(reportsDir) {
  const files = fs
    .readdirSync(reportsDir)
    .filter((file) => file.startsWith('EMS_Automation_') && file.endsWith('.pdf'))
    .map((file) => ({
      name: file,
      time: fs.statSync(path.join(reportsDir, file)).mtime.getTime(),
    }))
    .sort((a, b) => b.time - a.time);

  return files.length ? path.join(reportsDir, files[0].name) : null;
}

(async () => {
  try {
    const reportsDir = path.resolve(__dirname, '../reports');

    if (!process.env.REPORT_EMAIL_USER || !process.env.REPORT_EMAIL_PASS || !process.env.TO_EMAIL) {
      throw new Error('Missing environment variables. Check .env file.');
    }

    const latestPdf = findLatestPdf(reportsDir);
    if (!latestPdf) {
      throw new Error('No PDF report found in reports folder.');
    }

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.REPORT_EMAIL_USER,
        pass: process.env.REPORT_EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: `"EMS Automation Report" <${process.env.REPORT_EMAIL_USER}>`,
      to: process.env.TO_EMAIL,
      subject: `EMS Automation Test Report - ${new Date().toLocaleString()}`,
      html: `
        <p>Hello Team,</p>

        <p>Please find the Energy Management System(EMS) automation execution report attached.</p>

        <p><b>Attachment:</b> PDF Summary Report</p>

        <br/>

        <p style="margin:0;">Regards,</p>
        <p style="margin:0;"><b>Pushpa Shivanna</b></p>
        <p style="margin:0;">QA Engineer</p>
        <p style="margin:0;">Kazam EV Tech Private Limited</p>
        <p style="margin:0;">📞 +91 6363360267</p>
        <p style="margin:0;">✉️ pushpa@kazam.in</p>
      `,
      attachments: [
        {
          filename: path.basename(latestPdf),
          path: latestPdf,
        },
      ],
    };

    await transporter.sendMail(mailOptions);
    console.log('Email sent successfully');
    console.log(`Attached PDF: ${latestPdf}`);
  } catch (error) {
    console.error('Email failed');
    console.error(error.message);
    process.exit(1);
  }
})();
