import type { TState } from '@muyajs/core';
import { expect, test } from '../fixtures/muya';
import { editor } from '../helpers/selectors';

/**
 * Frontmatter has four delimiter styles, each round-tripped by
 * serializeFrontMatter in `state/stateToMarkdown.ts`:
 *   - YAML  `---\n…---\n`         (lang: 'yaml',  style: '-')
 *   - TOML  `+++\n…+++\n`         (lang: 'toml',  style: '+')
 *   - JSON  `;;;\n…;;;\n`         (lang: 'json',  style: ';')
 *   - JSON  `{\n…}\n`             (lang: 'json',  style: '{')
 *
 * Each style is set via `setContent` with explicit meta. We assert the block
 * renders + the markdown round-trip preserves the right delimiter shape.
 */

interface IStyleCase {
    label: string;
    lang: 'yaml' | 'toml' | 'json';
    style: '-' | '+' | ';' | '{';
    text: string;
    expectedStart: string;
    expectedEnd: string;
}

const STYLE_CASES: IStyleCase[] = [
    {
        label: 'YAML (---)',
        lang: 'yaml',
        style: '-',
        text: 'title: hi\nauthor: me',
        expectedStart: '---\n',
        expectedEnd: '---\n',
    },
    {
        label: 'TOML (+++)',
        lang: 'toml',
        style: '+',
        text: 'title = "hi"\nauthor = "me"',
        expectedStart: '+++\n',
        expectedEnd: '+++\n',
    },
    {
        label: 'JSON (;;;)',
        lang: 'json',
        style: ';',
        text: '"title": "hi",\n"author": "me"',
        expectedStart: ';;;\n',
        expectedEnd: ';;;\n',
    },
    {
        label: 'JSON ({})',
        lang: 'json',
        style: '{',
        text: '"title": "hi",\n"author": "me"',
        expectedStart: '{\n',
        expectedEnd: '}\n',
    },
];

test.describe('frontmatter block', () => {
    for (const styleCase of STYLE_CASES) {
        test(`renders + round-trips ${styleCase.label}`, async ({ page }) => {
            await page.evaluate((c) => {
                const state: TState[] = [{
                    name: 'frontmatter',
                    meta: { lang: c.lang, style: c.style },
                    text: c.text,
                }, {
                    name: 'paragraph',
                    text: 'body',
                }];
                window.muya!.setContent(state);
            }, styleCase);

            // The block mounts as `<pre.mu-frontmatter>` wrapping a code block.
            const fm = page.locator(editor.frontmatter);
            await expect(fm).toBeVisible();
            // Use a sync barrier on the paragraph too — its presence confirms
            // the document loaded fully.
            await expect(page.locator(editor.paragraph).first()).toContainText('body');

            const md = await page.evaluate(() => window.muya!.getMarkdown());
            expect(md.startsWith(styleCase.expectedStart)).toBe(true);
            expect(md).toContain(styleCase.text);
            // The closing delimiter immediately precedes the body paragraph.
            expect(md).toContain(styleCase.expectedEnd);
        });
    }

    test('defaults to collapsed and toggles without changing markdown', async ({ page }) => {
        await page.evaluate(() => {
            const state: TState[] = [{
                name: 'frontmatter',
                meta: { lang: 'yaml', style: '-' },
                text: 'title: hi\nauthor: me',
            }, {
                name: 'paragraph',
                text: 'body',
            }];
            window.muya!.setContent(state);
        });

        const fm = page.locator(editor.frontmatter);
        const toggle = fm.locator('.mu-frontmatter-toggle');
        const code = fm.locator('.mu-code');
        const markdownBefore = await page.evaluate(() => window.muya!.getMarkdown());

        await expect(fm).toHaveClass(/mu-frontmatter-collapsed/);
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
        await expect(toggle).toContainText('Properties');
        await expect(code).toBeHidden();

        await toggle.click();
        await expect(fm).not.toHaveClass(/mu-frontmatter-collapsed/);
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
        await expect(code).toBeVisible();
        await expect(code).toContainText('title: hi');
        expect(await page.evaluate(() => window.muya!.getMarkdown())).toBe(markdownBefore);
    });

    test('supports expanded as the configured default', async ({ page }) => {
        await page.evaluate(() => {
            window.muya!.setOptions({ frontmatterDefaultCollapsed: false }, true);
            const state: TState[] = [{
                name: 'frontmatter',
                meta: { lang: 'yaml', style: '-' },
                text: 'title: expanded',
            }, {
                name: 'paragraph',
                text: 'body',
            }];
            window.muya!.setContent(state);
        });

        const fm = page.locator(editor.frontmatter);
        await expect(fm).not.toHaveClass(/mu-frontmatter-collapsed/);
        await expect(fm.locator('.mu-frontmatter-toggle')).toHaveAttribute('aria-expanded', 'true');
        await expect(fm.locator('.mu-code')).toBeVisible();
    });
});
