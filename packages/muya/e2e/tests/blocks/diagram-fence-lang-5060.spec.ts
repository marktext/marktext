import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { slowType } from '../helpers/keyboard';
import { editor, floats } from '../helpers/selectors';

// #5060: a fence whose language is a diagram language must become a diagram
// block (with its live preview) however the language was entered — not only
// when the paragraph reads exactly ```mermaid (#2177). Loading the same
// markdown already yields a diagram, which is why a source-mode round-trip was
// the only way to get the preview.

const BODY = 'graph TD\nA-->B';

interface IBlockState { name: string; text?: string; meta?: { type?: string; lang?: string } }

function firstBlock(page: Page): Promise<IBlockState> {
    return page.evaluate(() => window.muya!.getState()[0] as IBlockState);
}

function nextFrame(page: Page): Promise<void> {
    return page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
}

// The `<pre>` intercepts pointer events over the language input, so place the
// caret the way the engine does (see ui/code-block-language-selector.spec.ts).
async function focusLanguageInput(page: Page): Promise<void> {
    await page.evaluate(() => {
        window.muya!.editor.scrollPage.firstChild.firstContentInDescendant().setCursor(0, 0, true);
    });
    await expect
        .poll(() => page.evaluate(() => window.muya!.editor.activeContentBlock?.blockName))
        .toBe('language-input');
}

async function expectMermaidDiagram(page: Page): Promise<void> {
    await expect.poll(async () => (await firstBlock(page)).name).toBe('diagram');
    expect((await firstBlock(page)).meta).toEqual({ type: 'mermaid', lang: 'yaml' });
}

async function expectRenderedBody(page: Page): Promise<void> {
    await expect(page.locator(`${editor.diagramPreview} svg`).first()).toBeVisible({ timeout: 15_000 });
    await expect.poll(() => getMarkdown(page)).toContain(`\`\`\`mermaid\n${BODY}\n\`\`\``);
}

test.describe('diagram language entered through the language picker or input (#5060)', () => {
    test('accepting "mermaid" from the fence autocomplete with Enter creates a diagram', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent(''));
        await page.locator(editor.paragraph).first().click();
        await slowType(page, '```mer');
        await expect(page.locator(`${floats.codeBlockLanguageSelector} li.item[data-label="mermaid"]`)).toBeVisible();

        await page.keyboard.press('Enter');

        await expectMermaidDiagram(page);
        await slowType(page, BODY);
        await expectRenderedBody(page);
    });

    test('clicking "mermaid" in the fence autocomplete creates a diagram', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent(''));
        await page.locator(editor.paragraph).first().click();
        await slowType(page, '```mer');

        await page.locator(`${floats.codeBlockLanguageSelector} li.item[data-label="mermaid"]`).click();

        await expectMermaidDiagram(page);
        await slowType(page, BODY);
        await expectRenderedBody(page);
    });

    test('setting an existing code block\'s language to mermaid converts it and keeps the code', async ({ page }) => {
        await page.evaluate(md => window.muya!.setContent(md), `\`\`\`\n${BODY}\n\`\`\`\n`);
        await focusLanguageInput(page);
        await slowType(page, 'mermaid');

        await page.keyboard.press('Enter');

        await expectMermaidDiagram(page);
        expect((await firstBlock(page)).text).toBe(BODY);
        await expectRenderedBody(page);
    });

    test('typing mermaid in the language input, then clicking into the code, converts it', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent('```\n\n```\n'));
        await focusLanguageInput(page);
        await slowType(page, 'mermaid');

        await page.locator(editor.codeContent).first().click();

        await expectMermaidDiagram(page);
        await slowType(page, BODY);
        await expectRenderedBody(page);
    });

    test('a non-diagram language entered in the language input stays a code block', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent('```\ncode\n```\n'));
        await focusLanguageInput(page);
        await slowType(page, 'python');

        await page.keyboard.press('Enter');

        await expect
            .poll(() => page.evaluate(() => window.muya!.editor.activeContentBlock?.blockName))
            .toBe('codeblock.content');
        await nextFrame(page);
        const block = await firstBlock(page);
        expect(block.name).toBe('code-block');
        expect(block.text).toBe('code');
    });
});
