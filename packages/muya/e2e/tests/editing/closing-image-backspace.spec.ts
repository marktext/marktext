import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { editor } from '../helpers/selectors';

const DATA_URI = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=';

for (const image of ['', `![keep](${DATA_URI}) `, `<img src="${DATA_URI}"> `]) {
    test(`Backspace after </img> keeps preceding content (${image ? image.slice(0, 5) : 'no image'})`, async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', error => errors.push(error.message));
        const source = `${image}x </img>`;
        await page.evaluate(source => {
            window.muya!.setContent(source);
            const block = window.muya!.editor.scrollPage!.firstContentInDescendant()!;
            block.setCursor(block.text.length, block.text.length, true);
        }, source);

        await page.keyboard.press('Backspace');
        await expect.poll(() => getMarkdown(page)).toBe(`${source.slice(0, -1)}\n`);
        expect(await page.evaluate(() => window.muya!.getSelectionState()?.kind)).toBe('text');
        await page.keyboard.press('Backspace');
        await expect.poll(() => getMarkdown(page)).toBe(`${source.slice(0, -2)}\n`);
        await expect(page.locator(editor.image)).toHaveCount(image ? 1 : 0);
        expect(errors).toEqual([]);
    });
}
