import { expect, test } from '@playwright/test';

/**
 * Sin sesion activa, el guardian de rutas redirige cualquier ruta privada
 * al inicio de sesion (Persona 2).
 */
test('sin sesion, la raiz redirige al inicio de sesion', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.locator('ion-content')).toContainText('Inicia sesión');
});
