import { expect, test } from '../fixtures/muya';

/**
 * Inline HTML tags (`<u>`, `<mark>`, `<sup>`, `<sub>`, `<ruby>`) render via
 * `inlineRenderer/renderer/htmlTag.ts`: each tag becomes an actual element
 * wrapped with `.mu-inline-rule.mu-raw-html`. We assert:
 *   - The tag renders inline (an element with the right tagName mounts).
 *   - getMarkdown round-trips the literal tag text.
 */

interface ITagCase {
    label: string;
    tag: 'u' | 'mark' | 'sup' | 'sub';
    markdown: string;
}

/**
 * Generic tags routed through `htmlTag.ts` mount the actual `<u>` / `<mark>`
 * / `<sup>` / `<sub>` element with `.mu-raw-html`. `<ruby>` is a special
 * case (see below) because it has its own `htmlRuby.ts` renderer.
 */
const TAG_CASES: ITagCase[] = [
    {
        label: 'underline <u>',
        tag: 'u',
        markdown: 'Text with <u>underline</u> inside.',
    },
    {
        label: 'highlight <mark>',
        tag: 'mark',
        markdown: 'Text with <mark>highlight</mark> inside.',
    },
    {
        label: 'superscript <sup>',
        tag: 'sup',
        markdown: 'E = mc<sup>2</sup>.',
    },
    {
        label: 'subscript <sub>',
        tag: 'sub',
        markdown: 'H<sub>2</sub>O.',
    },
];

test.describe('inline html tags', () => {
    for (const tagCase of TAG_CASES) {
        test(`${tagCase.label} renders and round-trips`, async ({ page }) => {
            await page.evaluate((md) => {
                window.muya!.setContent(md);
            }, tagCase.markdown);

            // The actual `<u>` / `<mark>` / `<sup>` / `<sub>` element mounts
            // inside the paragraph wrapped in `.mu-raw-html`.
            const el = page.locator(`${tagCase.tag}.mu-raw-html`).first();
            await expect(el).toBeVisible();

            const md = await page.evaluate(() => window.muya!.getMarkdown());
            // Round-trip preserves the literal opening + closing tag text.
            expect(md).toContain(`<${tagCase.tag}>`);
            expect(md).toContain(`</${tagCase.tag}>`);
        });
    }

    test('ruby <ruby> renders via htmlRuby + round-trips', async ({ page }) => {
        // `<ruby>` flows through `htmlRuby.ts`, which mounts a
        // `span.mu-ruby` wrapper containing a `span.mu-ruby-text` (the
        // source side) and a `span.mu-ruby-render` (the preview that hosts
        // the actual <ruby><rt>…</rt></ruby> DOM via `htmlToVNode(raw)`).
        const markdown = 'Word <ruby>漢<rt>kan</rt></ruby> here.';
        await page.evaluate((md) => {
            window.muya!.setContent(md);
        }, markdown);

        await expect(page.locator('span.mu-ruby').first()).toBeVisible();

        const md = await page.evaluate(() => window.muya!.getMarkdown());
        expect(md).toContain('<ruby>');
        expect(md).toContain('</ruby>');
        expect(md).toContain('<rt>kan</rt>');
    });
});
