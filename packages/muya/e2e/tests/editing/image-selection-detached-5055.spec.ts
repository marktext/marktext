import { expect, test } from '../fixtures/muya';
import { editor } from '../helpers/selectors';

const DATA_URI = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=';

test('#5055 Backspace after the selected image\'s paragraph was removed does not crash', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(String(err?.message ?? err)));

    await page.evaluate(uri => window.muya!.setContent(`first\n\n![alt](${uri})\n`), DATA_URI);
    const image = page.locator(editor.image).first();
    await expect.poll(() => image.evaluate(el => el.classList.contains('mu-image-success'))).toBe(true);
    await image.locator('img').first().click();

    await page.evaluate(() => {
        window.muya!.editor.scrollPage.lastChild.remove();
    });
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(300);

    expect(errors, `renderer pageerrors: ${errors.join(' | ')}`).toEqual([]);
});
