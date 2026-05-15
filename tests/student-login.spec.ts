import { test, expect } from '@playwright/test';

test('el estudiante puede iniciar sesión', async ({ page }) => {
  const email = process.env.TEST_STUDENT_EMAIL;
  const password = process.env.TEST_STUDENT_PASSWORD;

  if (!email || !password) {
    throw new Error('Faltan TEST_STUDENT_EMAIL o TEST_STUDENT_PASSWORD');
  }

  await page.goto('/login');

  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();

  await page.waitForTimeout(3000);

  const currentUrl = page.url();
  const visibleText = await page.locator('body').innerText();

  console.log('CURRENT_URL:', currentUrl);
  console.log('VISIBLE_TEXT:', visibleText);

  await expect(page).not.toHaveURL(/login/, { timeout: 15000 });
});
