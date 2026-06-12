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

interface IPropertyRow {
    name: 'frontmatter.row';
    key: string;
    value: string;
}

interface IStyleCase {
    label: string;
    lang: 'yaml' | 'toml' | 'json';
    style: '-' | '+' | ';' | '{';
    properties: IPropertyRow[];
    expectedStart: string;
    expectedEnd: string;
    expectedKey: string;
    expectedValue: string;
}

const STYLE_CASES: IStyleCase[] = [
    {
        label: 'YAML (---)',
        lang: 'yaml',
        style: '-',
        properties: [
            { name: 'frontmatter.row', key: 'title', value: 'hi' },
            { name: 'frontmatter.row', key: 'author', value: 'me' },
        ],
        expectedStart: '---\n',
        expectedEnd: '---\n',
        expectedKey: 'title',
        expectedValue: 'hi',
    },
    {
        label: 'TOML (+++)',
        lang: 'toml',
        style: '+',
        properties: [
            { name: 'frontmatter.row', key: 'title', value: 'hi' },
            { name: 'frontmatter.row', key: 'author', value: 'me' },
        ],
        expectedStart: '+++\n',
        expectedEnd: '+++\n',
        expectedKey: 'title',
        expectedValue: 'hi',
    },
    {
        label: 'JSON (;;;)',
        lang: 'json',
        style: ';',
        properties: [
            { name: 'frontmatter.row', key: 'title', value: 'hi' },
            { name: 'frontmatter.row', key: 'author', value: 'me' },
        ],
        expectedStart: ';;;\n',
        expectedEnd: ';;;\n',
        expectedKey: 'title',
        expectedValue: 'hi',
    },
    {
        label: 'JSON ({})',
        lang: 'json',
        style: '{',
        properties: [
            { name: 'frontmatter.row', key: 'title', value: 'hi' },
            { name: 'frontmatter.row', key: 'author', value: 'me' },
        ],
        expectedStart: '{\n',
        expectedEnd: '}\n',
        expectedKey: 'title',
        expectedValue: 'hi',
    },
];

test.describe('frontmatter block', () => {
    for (const styleCase of STYLE_CASES) {
        test(`renders + round-trips ${styleCase.label}`, async ({ page }) => {
            await page.evaluate((c) => {
                const state: TState[] = [{
                    name: 'frontmatter',
                    meta: { lang: c.lang, style: c.style },
                    properties: c.properties,
                }, {
                    name: 'paragraph',
                    text: 'body',
                }];
                window.muya!.setContent(state);
            }, styleCase);

            // The block mounts as `.mu-frontmatter`.
            const fm = page.locator(editor.frontmatter);
            await expect(fm).toBeVisible();
            // Use a sync barrier on the paragraph too — its presence confirms
            // the document loaded fully.
            await expect(page.locator(editor.paragraph).first()).toContainText('body');

            // The Properties header should be visible.
            await expect(fm.locator('.mu-frontmatter-header')).toBeVisible();

            // Key and value cells should contain the expected text.
            await expect(fm.locator('.mu-frontmatter-key').first()).toContainText(styleCase.expectedKey);
            await expect(fm.locator('.mu-frontmatter-value').first()).toContainText(styleCase.expectedValue);

            const md = await page.evaluate(() => window.muya!.getMarkdown());
            expect(md.startsWith(styleCase.expectedStart)).toBe(true);
            expect(md).toContain(styleCase.expectedKey);
            expect(md).toContain(styleCase.expectedValue);
            // The closing delimiter immediately precedes the body paragraph.
            expect(md).toContain(styleCase.expectedEnd);
        });
    }
});
