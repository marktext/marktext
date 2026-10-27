import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { slowType } from '../helpers/keyboard';
import { editor } from '../helpers/selectors';

// The rendered marker text is not in the DOM; Chromium's accessibility tree
// names each `ListMarker` node with it.
async function listMarkers(page: Page): Promise<string[]> {
    const cdp = await page.context().newCDPSession(page);
    const { nodes } = await cdp.send('Accessibility.getFullAXTree');
    await cdp.detach();

    return nodes
        .filter(node => node.role?.value === 'ListMarker')
        .map(node => String(node.name?.value ?? '').trim());
}

async function render(page: Page, markdown: string) {
    await page.evaluate((md) => {
        window.__e2e!.rebuildMuya({ fancyLists: true, markdown: md });
    }, markdown);
}

test.describe('fancy list markers', () => {
    test.skip(({ browserName }) => browserName !== 'chromium', 'reads markers through the Chromium accessibility tree');

    test('each style renders with a period', async ({ page }) => {
        await render(page, [
            'III. three',
            'IV. four',
            '',
            'B.  bee',
            '',
            'c. see',
            '',
            'ii. two',
            '',
            '7. seven',
            '',
        ].join('\n'));
        expect(await listMarkers(page)).toEqual(['III.', 'IV.', 'B.', 'c.', 'ii.', '7.']);
    });

    test('a one-paren delimiter renders as written', async ({ page }) => {
        await render(page, '1) one\n2) two\n\nc) see\n\nIV) four\n');
        expect(await listMarkers(page)).toEqual(['1)', '2)', 'c)', 'IV)']);
    });

    test('a two-paren delimiter renders as written', async ({ page }) => {
        await render(page, '(1) one\n(2) two\n\n(a) ay\n\n(ii) two\n');
        expect(await listMarkers(page)).toEqual(['(1)', '(2)', '(a)', '(ii)']);
    });

    test('a # list numbers in digits with its delimiter', async ({ page }) => {
        await render(page, '#. one\n#. two\n\n#) three\n\n(#) four\n');
        expect(await listMarkers(page)).toEqual(['1.', '2.', '1)', '(1)']);
    });

    test('typing # and a period starts a # list, not a heading', async ({ page }) => {
        await render(page, '');
        await page.locator(editor.paragraph).first().click();
        await slowType(page, '#. one');
        await expect(page.locator(editor.orderList).first()).toContainText('one');
        expect(await listMarkers(page)).toEqual(['1.']);
        expect(await getMarkdown(page)).toBe('#. one\n');
    });

    test('a nested decimal list does not take its parent style', async ({ page }) => {
        await render(page, 'I.  outer\n    1. inner\n');
        expect(await listMarkers(page)).toEqual(['I.', '1.']);
    });

    test('Tab at an outline item start takes the next outline level and undoes in one step', async ({ page }) => {
        await render(page, 'I.  a\nII. b\n');
        await page.evaluate(() => window.muya!.editor.scrollPage!.lastContentInDescendant()!.setCursor(0, 0, true));
        await page.keyboard.press('Tab');
        await expect.poll(() => getMarkdown(page)).toBe('I.  a\n    A.  b\n');
        expect(await listMarkers(page)).toEqual(['I.', 'A.']);
        await page.evaluate(() => window.muya!.undo());
        await expect.poll(() => getMarkdown(page)).toBe('I.  a\nII. b\n');
    });
});
