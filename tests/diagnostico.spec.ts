import { test, expect } from '@playwright/test';

test('el estudiante puede abrir la pantalla de diagnóstico', async ({ page }) => {
  await page.goto('/diagnostico');

  await expect(page.locator('body')).toBeVisible();

  await expect(page).toHaveURL(/diagnostico/);
});
