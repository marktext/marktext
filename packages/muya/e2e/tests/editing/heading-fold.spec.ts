import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { lineEndKey, lineStartKey, loadMarkdown, metaKey } from '../helpers/keyboard';
import { editor, toolbar } from '../helpers/selectors';

test.describe('heading fold', () => {
    test('keyboard navigation skips hidden content before typing', async ({ page }) => {
        await loadMarkdown(page, '# A\n\nsecret\n\n# B\n');
        await page.evaluate(() => {
            const content = window.muya!.editor.scrollPage!.firstContentInDescendant()!;
            content.setCursor(content.text.length, content.text.length, true);
        });
        await page.keyboard.press(`${metaKey()}+Shift+[`);
        await expect(page.locator(editor.paragraph)).toBeHidden();
        await page.keyboard.press('ArrowRight');
        await expect(page.locator(editor.paragraph)).toBeHidden();
        await expect.poll(() => page.evaluate(() => window.muya!.editor.activeContentBlock?.text)).toBe('# B');
        await page.keyboard.press(lineEndKey());
        await expect.poll(() => page.evaluate(() => window.muya!.editor.selection.anchor?.offset)).toBe(3);
        await page.keyboard.type('X');
        await expect.poll(() => getMarkdown(page)).toBe('# A\n\nsecret\n\n# BX\n');
    });

    test('converting a folded heading restores the section', async ({ page }) => {
        await loadMarkdown(page, '# A\n\nsecret\n\n# B\n');
        await page.locator(editor.foldToggle).first().click();
        await expect(page.locator(editor.paragraph)).toBeHidden();
        await page.evaluate(() => {
            window.muya!.editor.scrollPage!.firstContentInDescendant()!.setCursor(0, 0, true);
        });
        await page.keyboard.press('Backspace');
        await expect(page.locator(editor.paragraph).filter({ hasText: 'secret' })).toBeVisible();
        await expect.poll(() => getMarkdown(page)).toBe('A\n\nsecret\n\n# B\n');
    });

    test('find-in-document expands all sections', async ({ page }) => {
        await loadMarkdown(page, '# A\n\nsecret one\n\n# B\n\nsecret two\n');
        await page.locator(editor.foldToggle).nth(0).click();
        await page.locator(editor.foldToggle).nth(1).click();
        await page.locator(toolbar.search).fill('secret');
        await expect(page.locator(editor.paragraph).nth(0)).toBeVisible();
        await expect(page.locator(editor.paragraph).nth(1)).toBeVisible();
        await page.locator(toolbar.next).click();
        await expect(page.locator(editor.paragraph).nth(1)).toBeVisible();
    });

    test('Setext headings close a folded section', async ({ page }) => {
        await loadMarkdown(page, '# A\n\nalpha\n\nB\n===\n\nbravo\n');
        await page.locator(editor.foldToggle).click();
        await expect(page.locator(editor.paragraph).nth(0)).toBeHidden();
        await expect(page.locator(editor.setextHeading)).toBeVisible();
        await expect(page.locator(editor.paragraph).nth(1)).toBeVisible();
    });

    test('reveals a TOC target before measuring its scroll position', async ({ page }) => {
        await loadMarkdown(page, '# A\n\n## B\n\nsecret\n');
        await page.locator(editor.foldToggle).nth(1).click();
        await page.locator(editor.foldToggle).nth(0).click();
        const target = page.locator(editor.atxHeading).nth(1);
        await expect(target).toBeHidden();
        await target.evaluate(element => window.muya!.revealElement(element));
        await expect(target).toBeVisible();
        expect(await target.evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThan(0);
        await expect(page.locator(editor.paragraph)).toBeHidden();
    });

    test('hover feedback works in both fold states and keyboard activates the button', async ({ page }) => {
        await loadMarkdown(page, '# A\n\nsecret\n');
        const toggle = page.locator(editor.foldToggle);
        await toggle.hover();
        await expect(toggle).toHaveCSS('opacity', '1');
        await toggle.focus();
        await page.keyboard.press('Enter');
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
        await expect(page.locator(editor.paragraph)).toBeHidden();
        await expect(toggle).toHaveCSS('opacity', '1');
        await page.keyboard.press('Space');
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
        await expect(page.locator(editor.paragraph)).toBeVisible();
    });
});

test('undo and redo a folded heading conversion without orphaning hidden content', async ({ page }) => {
    await loadMarkdown(page, '# A\n\nsecret\n\n# B\n');
    await page.locator(editor.foldToggle).first().click();
    await page.evaluate(() => {
        window.muya!.editor.scrollPage!.firstContentInDescendant()!.setCursor(0, 0, true);
    });
    await page.keyboard.press('Backspace');
    await expect.poll(() => getMarkdown(page)).toBe('A\n\nsecret\n\n# B\n');
    await page.locator(toolbar.undo).click();
    await expect.poll(() => getMarkdown(page)).toBe('# A\n\nsecret\n\n# B\n');
    await expect(page.locator(editor.paragraph)).toBeVisible();
    await page.locator(toolbar.redo).click();
    await expect.poll(() => getMarkdown(page)).toBe('A\n\nsecret\n\n# B\n');
    await expect(page.locator(editor.paragraph).filter({ hasText: 'secret' })).toBeVisible();
});

async function foldAndPlaceCaret(page: Page, offset: number | 'end', markdown = '# ABC\n\nalpha\n\n## Inner\n\nbeta\n\n# B\n\nbravo\n') {
    await loadMarkdown(page, markdown);
    await page.locator(editor.foldToggle).first().click();
    await expect(page.locator(editor.foldToggle).first()).toHaveAttribute('aria-expanded', 'false');
    await page.evaluate((position) => {
        const content = window.muya!.editor.scrollPage!.firstContentInDescendant()!;
        const at = position === 'end' ? content.text.length : position;
        content.setCursor(at, at, true);
    }, offset);
}

for (const key of ['ArrowRight', 'ArrowDown']) {
    test(`${key} skips a folded section without expanding it`, async ({ page }) => {
        await foldAndPlaceCaret(page, 'end');
        await page.keyboard.press(key);
        const active = await page.evaluate(() => window.muya!.editor.activeContentBlock?.text);
        expect(active).toBe('# B');
        await expect(page.locator(editor.foldToggle).first()).toHaveAttribute('aria-expanded', 'false');
        await expect(page.locator(editor.paragraph).filter({ hasText: 'alpha' })).toBeHidden();
    });
}

for (const key of ['ArrowLeft', 'ArrowUp']) {
    test(`${key} skips a folded section in reverse`, async ({ page }) => {
        await foldAndPlaceCaret(page, 'end');
        await page.evaluate(() => {
            const block = window.muya!.editor.scrollPage!.children.tail!.prev!;
            if (block.isParent())
                block.firstContentInDescendant()!.setCursor(0, 0, true);
        });
        await page.keyboard.press(key);
        expect(await page.evaluate(() => window.muya!.editor.activeContentBlock?.text)).toBe('# ABC');
        await expect(page.locator(editor.foldToggle).first()).toHaveAttribute('aria-expanded', 'false');
    });
}

test('ArrowDown at the last folded section uses fold state even without its CSS class', async ({ page }) => {
    const markdown = '# ABC\n\nalpha\n';
    await foldAndPlaceCaret(page, 'end', markdown);
    await page.locator(editor.atxHeading).evaluate(heading => heading.classList.remove('mu-folded'));
    await page.keyboard.press('ArrowDown');
    expect(await getMarkdown(page)).toBe(markdown);
    await expect(page.locator(editor.paragraph)).toHaveCount(1);
    await expect(page.locator(editor.foldToggle)).toHaveAttribute('aria-expanded', 'false');
});

test('Enter at the end inserts a same-level heading after the entire folded section', async ({ page }) => {
    await foldAndPlaceCaret(page, 'end');
    await page.keyboard.press('Enter');
    await page.keyboard.type('New');
    await expect.poll(() => getMarkdown(page)).toBe('# ABC\n\nalpha\n\n## Inner\n\nbeta\n\n# New\n\n# B\n\nbravo\n');
    await expect(page.locator(editor.foldToggle).first()).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator(editor.paragraph).filter({ hasText: 'alpha' })).toBeHidden();
});

test('Enter in the middle splits the title after the folded section', async ({ page }) => {
    await foldAndPlaceCaret(page, 3);
    await page.keyboard.press('Enter');
    await expect.poll(() => getMarkdown(page)).toBe('# A\n\nalpha\n\n## Inner\n\nbeta\n\n# BC\n\n# B\n\nbravo\n');
    await expect(page.locator(editor.foldToggle).first()).toHaveAttribute('aria-expanded', 'false');
});

test('Enter at the title start inserts before the folded section', async ({ page }) => {
    await foldAndPlaceCaret(page, 2);
    await page.keyboard.press('Enter');
    const first = page.locator(editor.content).first();
    await expect(first).toHaveText('');
    await expect(page.locator(editor.foldToggle).first()).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator(editor.paragraph).filter({ hasText: 'alpha' })).toBeHidden();
});

test('a second Enter on the empty heading produces an editable paragraph outside the folded section', async ({ page }) => {
    await foldAndPlaceCaret(page, 'end');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.keyboard.type('new paragraph');
    await expect.poll(() => getMarkdown(page)).toBe('# ABC\n\nalpha\n\n## Inner\n\nbeta\n\nnew paragraph\n\n# B\n\nbravo\n');
    await expect(page.locator(editor.paragraph).filter({ hasText: 'new paragraph' })).toBeVisible();
    await expect(page.locator(editor.foldToggle).first()).toHaveAttribute('aria-expanded', 'false');
});

test('Shift+Enter adds an inline heading break and preserves the folded section', async ({ page }) => {
    await foldAndPlaceCaret(page, 'end');
    await page.keyboard.press('Shift+Enter');
    await page.keyboard.type('continued');
    await expect.poll(() => getMarkdown(page)).toBe('# ABC<br/>continued\n\nalpha\n\n## Inner\n\nbeta\n\n# B\n\nbravo\n');
    await expect(page.locator(editor.foldToggle).first()).toHaveAttribute('aria-expanded', 'false');
});

for (const [key, offset, title] of [
    ['Backspace', 4, 'AC'],
    ['Backspace', 5, 'AB'],
    ['Delete', 2, 'BC'],
    ['Delete', 3, 'AC'],
] as const) {
    test(`${key} at offset ${offset} edits only the folded title`, async ({ page }) => {
        await foldAndPlaceCaret(page, offset);
        await page.keyboard.press(key);
        await expect.poll(() => getMarkdown(page)).toBe(`# ${title}\n\nalpha\n\n## Inner\n\nbeta\n\n# B\n\nbravo\n`);
        await expect(page.locator(editor.foldToggle).first()).toHaveAttribute('aria-expanded', 'false');
    });
}

test('Delete at a folded title end reveals and merges the first paragraph', async ({ page }) => {
    await foldAndPlaceCaret(page, 'end');
    await page.keyboard.press('Delete');
    await expect.poll(() => getMarkdown(page)).toBe('# ABCalpha\n\n## Inner\n\nbeta\n\n# B\n\nbravo\n');
    await expect(page.locator(editor.foldToggle).first()).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator(editor.paragraph).filter({ hasText: 'beta' })).toBeVisible();
});

for (const key of ['Shift+ArrowRight', 'Shift+ArrowDown']) {
    test(`${key} exposes the selection destination before editing`, async ({ page }) => {
        await foldAndPlaceCaret(page, 'end');
        await page.keyboard.press(key);
        await expect(page.locator(editor.paragraph).filter({ hasText: 'alpha' })).toBeVisible();
        const selection = await page.evaluate((hiddenSelector) => {
            const range = window.getSelection();
            return {
                anchorHidden: Boolean(range?.anchorNode?.parentElement?.closest(hiddenSelector)),
                focusHidden: Boolean(range?.focusNode?.parentElement?.closest(hiddenSelector)),
            };
        }, editor.foldedContent);
        expect(selection).toEqual({ anchorHidden: false, focusHidden: false });
    });
}

test('line navigation and Tab do not change the folded document', async ({ page }) => {
    await foldAndPlaceCaret(page, 'end');
    const before = await getMarkdown(page);
    await page.keyboard.press(lineStartKey());
    await page.keyboard.press(lineEndKey());
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    expect(await getMarkdown(page)).toBe(before);
    await expect(page.locator(editor.foldToggle).first()).toHaveAttribute('aria-expanded', 'false');
});

test('copying a folded section preserves its hidden content', async ({ page }) => {
    await foldAndPlaceCaret(page, 'end');
    const copied = await page.evaluate(() => {
        const muya = window.muya!;
        muya.selectAll();
        muya.selectAll();
        return muya.editor.selection.getSelectedText();
    });
    expect(copied).toContain('alpha');
    expect(copied).toContain('beta');
    expect(copied).toContain('bravo');
});

for (const key of ['Shift+ArrowLeft', 'Shift+ArrowUp']) {
    test(`${key} exposes a backwards selection destination`, async ({ page }) => {
        await foldAndPlaceCaret(page, 'end');
        await page.evaluate(() => {
            const block = window.muya!.editor.scrollPage!.children.tail!.prev!;
            if (block.isParent())
                block.firstContentInDescendant()!.setCursor(0, 0, true);
        });
        await page.keyboard.press(key);
        await expect(page.locator(editor.paragraph).filter({ hasText: 'beta' })).toBeVisible();
    });
}

test('Backspace on the following heading leaves the preceding section folded', async ({ page }) => {
    await foldAndPlaceCaret(page, 'end');
    await page.evaluate(() => {
        const block = window.muya!.editor.scrollPage!.children.tail!.prev!;
        if (block.isParent())
            block.firstContentInDescendant()!.setCursor(0, 0, true);
    });
    await page.keyboard.press('Backspace');
    await expect.poll(() => getMarkdown(page)).toBe('# ABC\n\nalpha\n\n## Inner\n\nbeta\n\nB\n\nbravo\n');
    await expect(page.locator(editor.foldToggle).first()).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator(editor.paragraph).filter({ hasText: /^B$/ })).toBeVisible();
});

test('pasting in a folded title preserves the section and undo restores the title', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await foldAndPlaceCaret(page, 'end');
    await page.evaluate(() => navigator.clipboard.writeText(' pasted'));
    await page.keyboard.press(`${metaKey()}+v`);
    await expect.poll(() => getMarkdown(page)).toBe('# ABC pasted\n\nalpha\n\n## Inner\n\nbeta\n\n# B\n\nbravo\n');
    await expect(page.locator(editor.foldToggle).first()).toHaveAttribute('aria-expanded', 'false');
    await page.locator(toolbar.undo).click();
    await expect.poll(() => getMarkdown(page)).toBe('# ABC\n\nalpha\n\n## Inner\n\nbeta\n\n# B\n\nbravo\n');
});

test('copy-link, front menu, and fold toggle do not overlap in narrow editor viewports', async ({ page }) => {
    await page.setViewportSize({ width: 700, height: 700 });
    await loadMarkdown(page, '# Heading\n\nbody\n');
    const rects = await page.evaluate((affordances) => {
        const root = window.muya!.domNode;
        root.style.overflow = 'auto';
        const bounds = root.getBoundingClientRect();
        const buttons = [...root.querySelectorAll(affordances)];
        return buttons.map((button) => {
            const rect = button.getBoundingClientRect();
            return { left: rect.left >= bounds.left, right: rect.right <= bounds.right };
        });
    }, `${editor.headingCopyLink}, ${editor.foldToggle}`);
    expect(rects).toHaveLength(2);
    expect(rects.every(rect => rect.left && rect.right)).toBe(true);
    await page.locator(editor.atxHeading).hover();
    const frontButton = page.locator('.mu-front-button');
    await expect(frontButton).toBeVisible();
    await expect.poll(async () => {
        const front = await frontButton.boundingBox();
        const fold = await page.locator(editor.foldToggle).boundingBox();
        return front !== null && fold !== null && front.x + front.width <= fold.x;
    }).toBe(true);
    const front = await frontButton.boundingBox();
    const root = await page.locator('.mu-container').boundingBox();
    expect(front!.x).toBeGreaterThanOrEqual(root!.x);
    const fold = await page.locator(editor.foldToggle).boundingBox();
    const copy = await page.locator(editor.headingCopyLink).boundingBox();
    expect(fold).not.toBeNull();
    expect(copy).not.toBeNull();
    expect(copy!.x + copy!.width).toBeLessThanOrEqual(front!.x);
    await frontButton.click();
    await expect(page.locator('.mu-front-menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.locator(editor.foldToggle).click();
    await expect(page.locator(editor.paragraph)).toBeHidden();
});

for (const key of ['Backspace', 'Delete']) {
    test(`${key} after selecting the document removes hidden content and undo restores it`, async ({ page }) => {
        await foldAndPlaceCaret(page, 'end');
        const before = await getMarkdown(page);
        await page.evaluate(() => {
            window.muya!.selectAll();
            window.muya!.selectAll();
        });
        await page.keyboard.press(key);
        await expect.poll(async () => (await getMarkdown(page)).trim()).toBe('');
        await page.locator(toolbar.undo).click();
        await expect.poll(() => getMarkdown(page)).toBe(before);
        await expect(page.locator(editor.paragraph).filter({ hasText: 'alpha' })).toBeVisible();
    });
}

test('cutting the document includes folded content and is undoable', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await foldAndPlaceCaret(page, 'end');
    const before = await getMarkdown(page);
    await page.evaluate(() => {
        window.muya!.selectAll();
        window.muya!.selectAll();
    });
    await page.keyboard.press(`${metaKey()}+x`);
    await expect.poll(async () => (await getMarkdown(page)).trim()).toBe('');
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain('alpha');
    expect(copied).toContain('beta');
    await page.locator(toolbar.undo).click();
    await expect.poll(() => getMarkdown(page)).toBe(before);
});

test('undo and redo a folded title split preserve all section content', async ({ page }) => {
    await foldAndPlaceCaret(page, 3);
    const before = await getMarkdown(page);
    await page.keyboard.press('Enter');
    const after = '# A\n\nalpha\n\n## Inner\n\nbeta\n\n# BC\n\n# B\n\nbravo\n';
    await expect.poll(() => getMarkdown(page)).toBe(after);
    await page.locator(toolbar.undo).click();
    await expect.poll(() => getMarkdown(page)).toBe(before);
    await page.locator(toolbar.redo).click();
    await expect.poll(() => getMarkdown(page)).toBe(after);
});
