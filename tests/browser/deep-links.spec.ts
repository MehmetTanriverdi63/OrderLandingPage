import { test, expect, type Page } from '@playwright/test';
async function expectAtDeal(page: Page) {
  await expect.poll(() => page.evaluate(() => {
    const section=document.getElementById('angebot')!, header=document.querySelector('.header')!;
    const top=section.getBoundingClientRect().top, bottom=header.getBoundingClientRect().bottom;
    return top>=bottom-1 && top<=bottom+65;
  })).toBe(true);
  await expect(page.getByRole('button', { name: 'Deal sichern' })).toBeInViewport();
}
test('cold fragment link and reload open at the deal after React mounts', async ({ page }) => {
  await page.route('**/src/main.tsx', async route => { await new Promise(resolve=>setTimeout(resolve,250)); await route.continue(); });
  await page.goto('/#angebot');
  await expectAtDeal(page);
  await expect(page.getByRole('button', { name: 'Deal sichern' })).toBeEnabled();
  await page.reload();
  await expectAtDeal(page);
  await page.getByRole('button', { name: 'Deal sichern' }).click();
  await expect(page.getByRole('dialog')).toContainText('Das Instagram-Menü');
});
test('normal home and clicked fragment navigation still work', async ({ page }) => {
  await page.goto('/');
  await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBe(0);
  await page.getByRole('link', { name: /Jetzt entdecken/ }).click();
  await expect(page).toHaveURL(/#angebot$/);
  await expectAtDeal(page);
  await page.locator('.brand').first().click();
  await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBe(0);
});
