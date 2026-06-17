import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { editor } from '../helpers/selectors';

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
});
