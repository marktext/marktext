import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';

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

    test('a nested decimal list does not take its parent style', async ({ page }) => {
        await render(page, 'I.  outer\n    1. inner\n');
        expect(await listMarkers(page)).toEqual(['I.', '1.']);
    });
});
