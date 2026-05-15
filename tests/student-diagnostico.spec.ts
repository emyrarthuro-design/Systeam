import { test, expect } from '@playwright/test';

test('el estudiante puede iniciar sesión y abrir el diagnóstico', async ({ page }) => {
  const email = process.env.TEST_STUDENT_EMAIL;
  const password = process.env.TEST_STUDENT_PASSWORD;

  if (!email || !password) {
    throw new Error('Faltan TEST_STUDENT_EMAIL o TEST_STUDENT_PASSWORD');
  }

  await page.goto('/login');

  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();

  await expect(page).not.toHaveURL(/login/, { timeout: 15000 });

  await page.goto('/diagnostico');

  await expect(page.locator('body')).toBeVisible();
  await expect(page).toHaveURL(/diagnostico/, { timeout: 15000 });
  await expect(page.locator('body')).not.toContainText('Iniciar sesión');
});
