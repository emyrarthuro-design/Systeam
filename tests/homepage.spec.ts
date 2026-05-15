import { test, expect } from '@playwright/test';

test('la app carga correctamente', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body')).toBeVisible();
});
