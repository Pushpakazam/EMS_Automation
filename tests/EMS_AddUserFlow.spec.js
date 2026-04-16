const { test } = require('@playwright/test');
const { AddUserPage } = require('../pages/AddUserPage');

test('EMS_AddUserFlow', async ({ browser }) => {
  const context = await browser.newContext({ permissions: ['geolocation'] });
  const page = await context.newPage();
  const addUserPage = new AddUserPage(page);

  try {
    const shouldSendInvite = String(process.env.SEND_INVITE || 'false').toLowerCase() === 'true';
    await addUserPage.loginAndOpenDashboard('pushpa@kazam.in', 'Shivanna@123');
    await addUserPage.openAddUserFlow();
    await addUserPage.fillUserDetails({
      email: 'akhilesh@kazam.in',
      role: 'viewer',
      designation: 'Senior QA Engineer',
    });

    await addUserPage.selectHubs(['wwr1fg', 't26c3r']);
    if (shouldSendInvite) {
      await addUserPage.sendInviteAndWaitForCompletion();
    }
  } finally {
    await context.close();
  }
});
