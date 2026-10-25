import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { loadMarkdown } from '../helpers/keyboard';
import { editor, floats } from '../helpers/selectors';

interface ISelectionRecord {
    kind: string | null;
    text: string;
    docChanged: boolean;
}

async function recordSelections(page: Page): Promise<ISelectionRecord[]> {
    const records: ISelectionRecord[] = [];
    await page.exposeFunction('recordSelection', (record: ISelectionRecord) =>
        records.push(record),
    );
    await page.evaluate(() => {
        const recorder: Window & { recordSelection?: (record: ISelectionRecord) => Promise<void> } =
            window;
        window.muya!.on('selection-change', ({ selection, docChanged }) => {
            void recorder.recordSelection?.({
                kind: selection?.kind ?? null,
                text: window.muya!.getSelectedText(),
                docChanged,
            });
        });
    });
    return records;
}

test('text drag publishes before mouseup and the toolbar waits for release', async ({ page }) => {
    await loadMarkdown(page, 'Alpha beta gamma\n');
    const records = await recordSelections(page);
    const paragraph = page.locator(editor.paragraph).first();
    const box = (await paragraph.boundingBox())!;
    await page.mouse.move(box.x + 1, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 1, box.y + box.height / 2, {
        steps: 8,
    });
    await expect.poll(() => records[records.length - 1]?.text).toBe('Alpha beta gamma');
    expect(records[records.length - 1]?.kind).toBe('text');
    expect(await page.evaluate(() => window.muya!.ui.shownFloat.size)).toBe(0);
    await page.mouse.up();
    await expect(page.locator(floats.inlineFormatToolbar)).toBeInViewport();
});

test('table drag publishes cell text before mouseup and survives native root focus', async ({
    page,
}) => {
    await loadMarkdown(page, '| a | b |\n| --- | --- |\n| c | d |\n');
    const records = await recordSelections(page);
    const cells = page.locator(`${editor.table} td`);
    const start = (await cells.first().boundingBox())!;
    const end = (await cells.last().boundingBox())!;
    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
    await page.mouse.down();
    await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, {
        steps: 8,
    });
    await expect.poll(() => records[records.length - 1]?.text).toBe('a\tb\nc\td');
    expect(records[records.length - 1]?.kind).toBe('table');
    await page.mouse.up();
    await expect(page.locator(`${editor.table} td.mu-table-cell-selected`)).toHaveCount(4);
    await expect.poll(() => page.evaluate(() => window.muya!.getSelection()?.kind)).toBe('table');
    await page.keyboard.press('Backspace');
    await expect.poll(() => records[records.length - 1]?.text).toBe('\t\n\t');
    expect(records[records.length - 1]?.docChanged).toBe(true);
    await page.evaluate(() => window.muya!.undo());
    await expect.poll(() => records[records.length - 1]?.text).toBe('a\tb\nc\td');
    expect(records[records.length - 1]?.kind).toBe('table');
});

test('image deletion undo restores the object selection without selected text', async ({
    page,
}) => {
    const src =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=';
    await loadMarkdown(page, `![alt](${src})\n\nafter\n`);
    const image = page.locator(`${editor.image} img`).first();
    await expect(image).toBeVisible();
    const records = await recordSelections(page);
    await image.click();
    await expect.poll(() => records[records.length - 1]?.kind).toBe('image');
    expect(records[records.length - 1]?.text).toBe('');
    await page.keyboard.press('Backspace');
    await expect
        .poll(() => page.evaluate(() => window.muya!.getMarkdown()))
        .not.toContain('![alt]');
    await page.evaluate(() => window.muya!.undo());
    await expect.poll(() => records[records.length - 1]?.kind).toBe('image');
    expect(records[records.length - 1]?.text).toBe('');
    await expect(page.locator(floats.imageTransformerHandle)).toHaveCount(2);
});
