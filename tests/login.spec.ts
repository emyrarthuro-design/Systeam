import { test, expect } from '@playwright/test';

test('la pantalla de login carga correctamente', async ({ page }) => {
  await page.goto('/login');

  await expect(page.locator('body')).toBeVisible();

  await expect(page).toHaveURL(/login/);
});
