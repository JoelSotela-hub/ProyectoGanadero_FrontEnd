import { expect, test } from '@playwright/test';

test('sin sesion, la raiz redirige al inicio de sesion', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.locator('ion-content')).toContainText('Inicia sesión');
});
