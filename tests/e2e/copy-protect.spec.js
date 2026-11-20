// @ts-check
/* Content copy protection (js/copy-protect.js, 20 Nov 2026).
   Every Enterprise and Leaders page stops right-click, selection, copy and the
   save / print / view-source / developer-tools shortcuts outside the fields
   people type in; the launchpad, the shared sign-up and the admin console are
   left alone. Needs no account: a program's sign-in page is enough. */
const { test, expect } = require('@playwright/test');

/** Fires a cancelable event at `sel` and reports whether something prevented it. */
async function prevented(page, sel, type, init = {}) {
  return page.evaluate(([sel, type, init]) => {
    const el = sel === 'body' ? document.body : document.querySelector(sel);
    if (!el) throw new Error('no element ' + sel);
    const Ctor = type === 'keydown' ? KeyboardEvent : type === 'contextmenu' ? MouseEvent : Event;
    const ev = new Ctor(type, Object.assign({ bubbles: true, cancelable: true }, init));
    el.dispatchEvent(ev);
    return ev.defaultPrevented;
  }, [sel, type, init]);
}

const PROTECTED = [
  'leaders/judgment-critical-thinking/login',
  'leaders/conscience-ethical-reasoning/login',
  'enterprises/innovation-pipeline/login',
  'enterprises/culture/login',
  'enterprises/',
  'leaders/',
];
const OPEN = ['', 'signup', 'admin'];

for (const path of PROTECTED) {
  test(`protected: /${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('html')).toHaveClass(/copy-protected/);
  });
}
for (const path of OPEN) {
  test(`not protected: /${path || '(launchpad)'}`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('html')).not.toHaveClass(/copy-protected/);
    expect(await prevented(page, 'body', 'contextmenu')).toBe(false);
  });
}

test('page text is protected, typing fields are not', async ({ page }) => {
  await page.goto('leaders/judgment-critical-thinking/login');
  await page.waitForSelector('input');

  // The page itself
  expect(await prevented(page, 'body', 'contextmenu')).toBe(true);
  expect(await prevented(page, 'body', 'selectstart')).toBe(true);
  expect(await prevented(page, 'body', 'copy')).toBe(true);
  expect(await prevented(page, 'body', 'cut')).toBe(true);
  for (const key of ['a', 'c', 'x', 's', 'u', 'p']) {
    expect(await prevented(page, 'body', 'keydown', { key, code: 'Key' + key.toUpperCase(), ctrlKey: true }), 'Ctrl+' + key).toBe(true);
    expect(await prevented(page, 'body', 'keydown', { key, code: 'Key' + key.toUpperCase(), metaKey: true }), 'Cmd+' + key).toBe(true);
  }
  expect(await prevented(page, 'body', 'keydown', { key: 'F12', code: 'F12' })).toBe(true);
  expect(await prevented(page, 'body', 'keydown', { key: 'I', code: 'KeyI', ctrlKey: true, shiftKey: true })).toBe(true);
  expect(await prevented(page, 'body', 'keydown', { key: 'ˆ', code: 'KeyI', metaKey: true, altKey: true })).toBe(true);
  expect(await page.evaluate(() => getComputedStyle(document.body).userSelect)).toBe('none');

  // A field someone types in
  expect(await prevented(page, 'input', 'contextmenu')).toBe(false);
  expect(await prevented(page, 'input', 'selectstart')).toBe(false);
  expect(await prevented(page, 'input', 'copy')).toBe(false);
  for (const key of ['a', 'c', 'x', 'v']) {
    expect(await prevented(page, 'input', 'keydown', { key, code: 'Key' + key.toUpperCase(), ctrlKey: true }), 'field Ctrl+' + key).toBe(false);
  }
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('input')).userSelect)).not.toBe('none');

  // Typing, select-all and replace still work for real
  const field = page.locator('input:visible').first();
  await field.click();
  await field.pressSequentially('hello world');
  await field.press('Control+A');
  await field.pressSequentially('replaced');
  await expect(field).toHaveValue('replaced');

  // The notice
  await page.evaluate(() => document.body.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })));
  await expect(page.locator('#copyProtectNotice')).toHaveText('This content is protected.');
});

test('data-allow-copy opens a block back up; videos lose their Download button', async ({ page }) => {
  await page.goto('enterprises/innovation-pipeline/login');
  await page.evaluate(() => {
    const d = document.createElement('div'); d.id = 'cpOpen'; d.setAttribute('data-allow-copy', ''); d.innerHTML = '<span id="cpInner">share me</span>';
    const v = document.createElement('video'); v.id = 'cpVid'; v.setAttribute('controls', ''); v.setAttribute('controlslist', 'nofullscreen');
    document.body.append(d, v);
  });
  expect(await prevented(page, '#cpInner', 'contextmenu')).toBe(false);
  expect(await prevented(page, '#cpInner', 'copy')).toBe(false);
  await expect(page.locator('#cpVid')).toHaveAttribute('controlslist', 'nofullscreen nodownload');
});

test('the dev install is protected too', async ({ page }) => {
  await page.goto('enterprises/dev/culture/login');
  await expect(page.locator('html')).toHaveClass(/copy-protected/);
  expect(await prevented(page, 'body', 'contextmenu')).toBe(true);
});
