import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { editor } from '../helpers/selectors';

// #4716: undoing a list unwrap (or any op) must never leave ScrollPage empty.
// `updateContents` dispatches to the json state first, then rebuilds the live
// tree incrementally via pick/drop. If a block throws while being rebuilt
// (KaTeX/diagram/etc.), the tree was left half-applied — `pick` removed blocks
// `drop` never re-inserted — so the document looked correct (json state is
// right) but the live ScrollPage was empty, and the next blank-area click
// crashed the renderer in `ScrollPage._clickHandler`.

function liveTree(page: Page) {
    return page.evaluate(() => {
        const sp = (window.muya as any).editor.scrollPage;
        return {
            len: sp.children.length,
            tail: sp.children.tail?.blockName ?? null,
            dom: sp.domNode.childElementCount,
            md: window.muya!.getMarkdown(),
        };
    });
}

test('undo that fails to rebuild a block re-syncs from state and never empties the editor', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', err => pageErrors.push(err.message));

    await page.evaluate(() => window.muya!.setContent([
        { name: 'bullet-list', meta: { loose: true, marker: '-' }, children: [
            { name: 'list-item', children: [{ name: 'paragraph', text: 'foo' }] },
            { name: 'list-item', children: [{ name: 'paragraph', text: 'bar' }] },
        ] },
    ] as never));

    // Unwrap the list (what the front menu's highlighted list item does).
    await page.evaluate(() => {
        const sp = (window.muya as any).editor.scrollPage;
        sp.firstChild.firstContentInDescendant().setCursor(0, 0, true);
        window.muya!.resetToParagraph(sp.firstChild);
        (window.muya as any).editor.jsonState.flush();
    });
    expect((await liveTree(page)).md).not.toContain('- ');

    // Make the bullet-list throw ONCE while the undo's drop phase rebuilds it,
    // then undo. The incremental apply fails after pick emptied the tree.
    await page.evaluate(() => {
        const SP = (window.muya as any).editor.scrollPage.constructor;
        const real = SP.loadBlock.bind(SP);
        let thrown = false;
        SP.loadBlock = (name: string) => {
            if (name === 'bullet-list' && !thrown) {
                thrown = true;
                throw new Error('simulated block build failure');
            }
            return real(name);
        };
        try {
            window.muya!.undo();
            (window.muya as any).editor.jsonState.flush();
        }
        finally {
            SP.loadBlock = real;
        }
    });

    const afterUndo = await liveTree(page);
    expect(afterUndo.md).toContain('- foo');
    expect(afterUndo.tail, 'ScrollPage must not be left empty').not.toBeNull();
    expect(afterUndo.len).toBe(afterUndo.dom);

    // The reported crash trigger: click the editor's blank area.
    const edBox = await page.locator(editor.root).boundingBox();
    if (edBox)
        await page.mouse.click(edBox.x + edBox.width / 2, edBox.y + edBox.height - 4);
    await page.waitForTimeout(50);

    expect(pageErrors, `renderer errors: ${pageErrors.join(' | ')}`).toEqual([]);
});
