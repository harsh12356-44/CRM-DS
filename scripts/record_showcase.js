const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  console.log('Recording crisp, complete portal walkthrough video (target: ~1m 45s, under 3 mins)...');
  const videosDir = path.resolve(__dirname, '../videos');
  if (!fs.existsSync(videosDir)) {
    fs.mkdirSync(videosDir, { recursive: true });
  }

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,720']
  });

  const context = await browser.newContext({
    recordVideo: {
      dir: videosDir,
      size: { width: 1280, height: 720 }
    },
    viewport: { width: 1280, height: 720 }
  });

  const page = await context.newPage();

  // Helper smooth scroll
  async function smoothScroll(distance, step = 45, delay = 16) {
    const totalSteps = Math.ceil(Math.abs(distance) / step);
    const direction = distance > 0 ? 1 : -1;
    for (let i = 0; i < totalSteps; i++) {
      await page.mouse.wheel(0, step * direction);
      await sleep(delay);
    }
  }

  try {
    // ==========================================
    // SCENE 1: LOGIN PAGE
    // ==========================================
    console.log('Scene 1: Loading Login Page...');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
    await sleep(1500);

    const switchBtn = page.locator('text=Sign in as a different employee');
    if (await switchBtn.isVisible().catch(() => false)) {
      await switchBtn.click();
      await sleep(800);
    }

    const emailInput = page.locator('input[type="text"]').first();
    const passInput = page.locator('input[type="password"]').first();
    const submitBtn = page.locator('button[type="submit"]').first();

    console.log('Entering HR / Admin credentials...');
    await emailInput.click();
    await emailInput.fill('');
    await emailInput.pressSequentially('digitalsuncityoffice@gmail.com', { delay: 20 });
    await sleep(400);

    await passInput.click();
    await passInput.fill('');
    await passInput.pressSequentially('Ravina@1996#', { delay: 25 });
    await sleep(500);

    console.log('Submitting login...');
    await submitBtn.click();
    await page.waitForURL('**/admin**', { timeout: 15000 }).catch(() => {});
    await sleep(2000);

    // ==========================================
    // SCENE 2: ADMIN DASHBOARD / CENTRAL CONTROLLER
    // ==========================================
    console.log('Scene 2: Admin Dashboard Overview...');
    await page.goto('http://localhost:3000/admin', { waitUntil: 'networkidle' }).catch(() => {});
    await sleep(1500);
    await smoothScroll(250, 40, 16);
    await sleep(1200);
    await smoothScroll(-250, 40, 16);
    await sleep(800);

    // ==========================================
    // SCENE 3: BIOMETRIC ATTENDANCE (31-DAY MATRIX)
    // ==========================================
    console.log('Scene 3: 31-Day Attendance Matrix...');
    await page.goto('http://localhost:3000/admin/attendance', { waitUntil: 'networkidle' }).catch(() => {});
    await sleep(1500);
    await smoothScroll(180, 40, 16);
    await sleep(1000);

    const tableContainer = page.locator('.overflow-x-auto').first();
    if (await tableContainer.isVisible().catch(() => false)) {
      await tableContainer.evaluate(el => el.scrollBy({ left: 600, behavior: 'smooth' }));
      await sleep(1500);
      await tableContainer.evaluate(el => el.scrollBy({ left: -600, behavior: 'smooth' }));
      await sleep(1000);
    }
    await smoothScroll(-180, 40, 16);
    await sleep(800);

    // ==========================================
    // SCENE 4: EMPLOYEES & MANAGER HIERARCHY
    // ==========================================
    console.log('Scene 4: Employees Directory & Dual Managers...');
    await page.goto('http://localhost:3000/admin/employees', { waitUntil: 'networkidle' }).catch(() => {});
    await sleep(1500);
    await smoothScroll(200, 40, 16);
    await sleep(1000);

    const editBtn = page.locator('button:has-text("Edit")').first();
    if (await editBtn.isVisible().catch(() => false)) {
      console.log('Opening Employee Profile Modal...');
      await editBtn.click();
      await sleep(1200);

      const modal = page.locator('.fixed.inset-0').first();
      if (await modal.isVisible().catch(() => false)) {
        await page.mouse.wheel(0, 220);
        await sleep(1500);
      }

      const closeBtn = page.locator('button:has-text("Cancel"), button:has-text("✕")').first();
      if (await closeBtn.isVisible().catch(() => false)) {
        await closeBtn.click();
        await sleep(800);
      }
    }
    await smoothScroll(-200, 40, 16);
    await sleep(800);

    // ==========================================
    // SCENE 5: LEAVE TRACKER (QUARTERLY 6-DAY QUOTAS)
    // ==========================================
    console.log('Scene 5: Leave Tracker & Quotas...');
    await page.goto('http://localhost:3000/admin/leave-tracker', { waitUntil: 'networkidle' }).catch(() => {});
    await sleep(1500);
    await smoothScroll(260, 40, 16);
    await sleep(1500);
    await smoothScroll(-260, 40, 16);
    await sleep(800);

    // ==========================================
    // SCENE 6: WFH TIME TRACKING & MONITOR
    // ==========================================
    console.log('Scene 6: WFH Live Command Board...');
    await page.goto('http://localhost:3000/admin/time-tracking', { waitUntil: 'networkidle' }).catch(() => {});
    await sleep(1500);
    await smoothScroll(220, 40, 16);
    await sleep(1500);
    await smoothScroll(-220, 40, 16);
    await sleep(800);

    // ==========================================
    // SCENE 7: MANAGERS DESK
    // ==========================================
    console.log('Scene 7: Managers Desk...');
    await page.goto('http://localhost:3000/admin/managers', { waitUntil: 'networkidle' }).catch(() => {});
    await sleep(1500);
    await smoothScroll(180, 40, 16);
    await sleep(1200);
    await smoothScroll(-180, 40, 16);
    await sleep(800);

    // ==========================================
    // SCENE 8: BRANCHES & MULTI-SHIFT CONFIG
    // ==========================================
    console.log('Scene 8: Branches & Shifts...');
    await page.goto('http://localhost:3000/admin/branches', { waitUntil: 'networkidle' }).catch(() => {});
    await sleep(1500);
    await smoothScroll(180, 40, 16);
    await sleep(1200);
    await smoothScroll(-180, 40, 16);
    await sleep(800);

    // ==========================================
    // SCENE 9: MULTI-COMPANY SPACES
    // ==========================================
    console.log('Scene 9: Multi-Company Spaces...');
    await page.goto('http://localhost:3000/admin/companies', { waitUntil: 'networkidle' }).catch(() => {});
    await sleep(1500);
    await smoothScroll(180, 40, 16);
    await sleep(1200);
    await smoothScroll(-180, 40, 16);
    await sleep(800);

    // ==========================================
    // SCENE 10: AUTOMATED NOTIFICATION SETTINGS
    // ==========================================
    console.log('Scene 10: Notification Settings...');
    await page.goto('http://localhost:3000/admin/settings', { waitUntil: 'networkidle' }).catch(() => {});
    await sleep(1500);
    await smoothScroll(380, 40, 16);
    await sleep(1800);
    await smoothScroll(-380, 40, 16);
    await sleep(800);

    // ==========================================
    // SCENE 11: MANAGER DESK
    // ==========================================
    console.log('Scene 11: Manager Desk Approvals...');
    await page.goto('http://localhost:3000/manager', { waitUntil: 'networkidle' }).catch(() => {});
    await sleep(1500);
    await smoothScroll(200, 40, 16);
    await sleep(1200);
    await smoothScroll(-200, 40, 16);
    await sleep(800);

    // ==========================================
    // SCENE 12: EMPLOYEE PORTAL
    // ==========================================
    console.log('Scene 12: Employee Portal (Punch Clock & Leaves)...');
    await page.goto('http://localhost:3000/employee', { waitUntil: 'networkidle' }).catch(() => {});
    await sleep(1500);
    await smoothScroll(200, 40, 16);
    await sleep(1500);

    const applyTab = page.locator('button:has-text("Apply for Leave"), a:has-text("Apply for Leave")').first();
    if (await applyTab.isVisible().catch(() => false)) {
      await applyTab.click();
      await sleep(1200);
    }

    const notifTab = page.locator('button:has-text("Notifications"), a:has-text("Notifications")').first();
    if (await notifTab.isVisible().catch(() => false)) {
      await notifTab.click();
      await sleep(1500);
    }

    const punchTab = page.locator('button:has-text("Punch"), a:has-text("Punch"), button:has-text("Dashboard")').first();
    if (await punchTab.isVisible().catch(() => false)) {
      await punchTab.click();
      await sleep(1200);
    }

    console.log('All tabs showcased successfully! Finalizing video file...');
    await sleep(1500);
  } catch (err) {
    console.error('Error during recording:', err);
  } finally {
    await context.close();
    await browser.close();

    const files = fs.readdirSync(videosDir).filter(f => f.endsWith('.webm') && f !== 'crm-ds-full-portal-walkthrough.webm');
    if (files.length > 0) {
      files.sort((a, b) => fs.statSync(path.join(videosDir, b)).mtime - fs.statSync(path.join(videosDir, a)).mtime);
      const latestFile = path.join(videosDir, files[0]);
      const targetFile = path.join(videosDir, 'crm-ds-portal-showcase-walkthrough.webm');
      if (fs.existsSync(targetFile)) {
        fs.unlinkSync(targetFile);
      }
      fs.renameSync(latestFile, targetFile);
      const stats = fs.statSync(targetFile);
      console.log(`Video saved to: ${targetFile} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
    }
  }
})();
