import { expect, test } from '../fixtures/muya';
import { getInitialMarkdown, getMarkdown } from '../helpers/api';
import { editor } from '../helpers/selectors';

test.describe('boot', () => {
    test('host page loads and exposes window.muya', async ({ page }) => {
        await expect(page).toHaveTitle(/Muya E2E/);
        const muyaIsReady = await page.evaluate(() => Boolean(window.muya?.editor?.scrollPage));
        expect(muyaIsReady).toBe(true);
    });

    test('initial markdown renders into the DOM', async ({ page }) => {
        await expect(page.locator(editor.container)).toBeVisible();
        // INITIAL_MARKDOWN starts with `# Muya E2E`, so an atx-heading must render.
        await expect(page.locator(editor.atxHeading).first()).toContainText('Muya E2E');
        // Plus at least one bullet-list item from the initial markdown.
        await expect(page.locator(editor.bulletList).first()).toBeVisible();
        await expect(page.locator(`${editor.bulletList} >> text=item one`)).toBeVisible();
    });

    test('getMarkdown round-trips the initial content', async ({ page }) => {
        const [actual, expected] = await Promise.all([
            getMarkdown(page),
            getInitialMarkdown(page),
        ]);
        // Round-trip may normalize trailing whitespace / list marker spacing,
        // so assert structural inclusion rather than strict equality.
        expect(actual).toContain('# Muya E2E');
        expect(actual).toContain('**bold**');
        expect(actual).toContain('[link](https://example.com)');
        expect(actual).toContain('item one');
        expect(actual).toContain('item two');
        // Sanity: actual is non-empty and similar length to expected.
        expect(actual.length).toBeGreaterThan(expected.length / 2);
    });
});
