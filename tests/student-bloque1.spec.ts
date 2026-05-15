import { test, expect } from '@playwright/test';

test('el estudiante puede abrir y responder el bloque 1 del diagnóstico', async ({ page }) => {
  const email = process.env.TEST_STUDENT_EMAIL;
  const password = process.env.TEST_STUDENT_PASSWORD;

  if (!email || !password) {
    throw new Error('Faltan TEST_STUDENT_EMAIL o TEST_STUDENT_PASSWORD');
  }

  await page.goto('/login');

  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();

  await page.waitForURL(url => !url.toString().includes('/login'), {
    timeout: 15000,
  });

  await page.goto('/diagnostico');

  const startButton = page.getByRole('button', { name: /iniciar proceso/i });
  if (await startButton.isVisible().catch(() => false)) {
    await startButton.click();
  }

  await page.getByText('BLOQUE 1').scrollIntoViewIfNeeded();
  await page.getByText(/continuar/i).first().click();

  await expect(page).toHaveURL(/\/bloque\/1/, {
    timeout: 15000,
  });

  await expect(page.locator('body')).toContainText(/Punto de partida/i);
  await expect(page.locator('body')).toContainText(/área de conocimiento|especialidad/i);

  await page.locator('textarea').first().fill('Marketing digital y automatización con inteligencia artificial');

  await page.getByRole('button', { name: /1-2 años/i }).click();
  await page.getByRole('button', { name: /sí, pero solo de forma informal/i }).click();
  await page.getByRole('button', { name: /no lo monetizo todavía/i }).click();
  await page.getByRole('button', { name: /tengo experiencia, pero no sé cómo comunicarla/i }).click();

  await expect(page.getByRole('button', { name: /siguiente/i })).toBeVisible();

  await page.getByRole('button', { name: /siguiente/i }).click();

  await expect(page.locator('body')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Iniciar sesión');
});
