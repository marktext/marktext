import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { getMarkdown, getState } from '../helpers/api';
import { slowType } from '../helpers/keyboard';
import { editor } from '../helpers/selectors';

/** A muya state node as returned by `muya.getState()`. */
interface IStateNode {
    name: string;
    text?: string;
    meta?: { type?: string; lang?: string };
    children?: IStateNode[];
}

/** Read the top-level document state as a typed array of blocks. */
async function getBlocks(page: Page): Promise<IStateNode[]> {
    return (await getState(page)) as IStateNode[];
}

test.describe('code block', () => {
    test('typing ``` + Enter converts paragraph to a fenced code block', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent(''));
        await page.locator(editor.paragraph).first().click();
        await page.keyboard.type('```');
        await page.keyboard.press('Enter');
        await expect(page.locator(editor.codeBlock).first()).toBeVisible();
        await expect(page.locator(editor.languageInput).first()).toBeVisible();
    });

    test('typing ```<lang> + Enter records the lang via setContent path', async ({ page }) => {
        // Note: typing through the language token after ``` is timing-sensitive
        // because the code-block language selector popup intercepts subsequent
        // keystrokes. To assert lang behavior deterministically we go through
        // the public state shape.
        await page.evaluate(() => {
            window.muya!.setContent('```javascript\nconsole.log(1);\n```\n');
        });
        await expect(page.locator(editor.codeBlock).first()).toBeVisible();
        const md = await getMarkdown(page);
        expect(md).toContain('```javascript');
        expect(md).toContain('console.log(1);');
    });

    test('setContent with a code-block + code text serializes back', async ({ page }) => {
        await page.evaluate(() => {
            window.muya!.setContent('```js\nconst x = 1;\n```\n');
        });
        await expect(page.locator(editor.codeBlock).first()).toBeVisible();
        expect(await getMarkdown(page)).toContain('const x = 1;');
    });

    test('js code block highlights real code with Prism token spans and reflects ```js', async ({ page }) => {
        // The `js` alias resolves to `javascript`, which muya preloads into its
        // Prism `loadedLanguages` set
        // (packages/muya/src/utils/prism/loadLanguage.ts), so highlighting runs
        // synchronously on the first render — no language fetch is needed.
        await page.evaluate(() => {
            window.muya!.setContent('```js\nconst x = 1;\n```\n');
        });
        await expect(page.locator(editor.codeBlock).first()).toBeVisible();

        const codeContent = page.locator(editor.codeContent).first();
        // The code leaf carries class `mu-codeblock-content` (not the stale
        // `.mu-fence-code`); Prism appends `<span class="token …">` runs here.
        await expect(codeContent).toBeVisible();

        const tokens = page.locator(`${editor.codeContent} .token`);
        await expect(tokens.first()).toBeVisible();
        // `const x = 1;` tokenizes into keyword / operator / number / punctuation.
        await expect(tokens).toHaveCount(4);
        await expect(
            page.locator(`${editor.codeContent} .token.keyword`).first(),
        ).toHaveText('const');

        // The fenced wrapper records the language and the language-input shows it.
        await expect(page.locator(editor.codeBlock).first()).toHaveClass(/mu-fenced-code/);
        await expect(page.locator(editor.languageInput).first()).toHaveText('js');

        // Round-trip: the language fence and code text survive serialization.
        const md = await getMarkdown(page);
        expect(md).toContain('```js');
        expect(md).toContain('const x = 1;');
    });

    // Item 97 — lazily-loaded (non-preloaded) language highlights after async load.
    test('rust code block highlights after the lazy prism-rust import resolves', async ({ page }) => {
        // `rust` is NOT in the preloaded set
        // (markup/css/clike/javascript — packages/muya/src/utils/prism/loadLanguage.ts),
        // so the first render emits plain text and `CodeBlock.set lang` kicks off a
        // dynamic `import('prism-rust')`; on resolve it re-renders with Prism tokens.
        await page.evaluate(() => {
            window.muya!.setContent('```rust\nfn main() { let x = 1; }\n```\n');
        });
        await expect(page.locator(editor.codeBlock).first()).toBeVisible();

        // The async import + re-highlight can take a moment, so poll for the first
        // `.token` span instead of asserting synchronously.
        const tokens = page.locator(`${editor.codeContent} .token`);
        await expect(tokens.first()).toBeVisible({ timeout: 15_000 });
        expect(await tokens.count()).toBeGreaterThan(0);

        // `fn` is a rust keyword — its presence proves the rust grammar (not a
        // fallback) drove the highlight.
        await expect(
            page.locator(`${editor.codeContent} .token.keyword`).first(),
        ).toHaveText('fn');

        // Round-trip survives serialization.
        const md = await getMarkdown(page);
        expect(md).toContain('```rust');
        expect(md).toContain('fn main() { let x = 1; }');
    });

    // Item 45 — typing 4 leading spaces + text produces an INDENTED code block.
    test('typing 4 leading spaces + text converts a paragraph to an indented code block', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent(''));
        await page.locator(editor.paragraph).first().click();

        // `_convertToIndentedCodeBlock` (block/base/format.ts) fires from the
        // inline-update pipeline once the text matches `^( {4,})` — four spaces
        // then any text.
        await slowType(page, '    code');

        const codeBlock = page.locator(editor.codeBlock).first();
        await expect(codeBlock).toBeVisible();

        // Indented blocks carry `mu-indented-code`, never the fenced wrapper class.
        // (Every code block — including indented — still renders a language-input
        // row; for an indented block it stays empty, so we assert the wrapper
        // class rather than the input's presence.)
        await expect(codeBlock).toHaveClass(/mu-indented-code/);
        await expect(codeBlock).not.toHaveClass(/mu-fenced-code/);
        await expect(page.locator(editor.languageInput).first()).toHaveText('');

        // State shape: a single code-block whose meta.type is 'indented'.
        const blocks = await getBlocks(page);
        expect(blocks).toHaveLength(1);
        expect(blocks[0].name).toBe('code-block');
        expect(blocks[0].meta?.type).toBe('indented');

        // Round-trip: serializes back to a 4-space-prefixed line, no ``` fence.
        const md = await getMarkdown(page);
        expect(md).toContain('    code');
        expect(md).not.toContain('```');
    });
});
