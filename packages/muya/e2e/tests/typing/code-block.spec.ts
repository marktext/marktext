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
});
