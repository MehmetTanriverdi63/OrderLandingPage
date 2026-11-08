import { test, expect } from '@playwright/test';
test('Instagram editorial links to the real profile without a broken embed or remote calls',async({page})=>{
  const requests:string[]=[];
  page.on('request',request=>{if(/instagram|cdninstagram|facebook/.test(new URL(request.url()).hostname))requests.push(request.url());});
  await page.goto('/');
  const section=page.locator('#instagram');
  await section.scrollIntoViewIfNeeded();
  await expect(section.getByRole('heading',{name:/Gutes Essen/})).toBeVisible();
  await expect(section.locator('iframe')).toHaveCount(0);
  for(const link of await section.getByRole('link').all())await expect(link).toHaveAttribute('href','https://www.instagram.com/mediterranekucheworms/');
  await expect(section.locator('img')).toBeVisible();
  expect(requests).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`/tmp/instagram-${test.info().project.name}.png`});
});
