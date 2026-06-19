import type Content from '../../block/base/content';
import type { Muya } from '../../muya';
import { describe, expect, it, vi } from 'vitest';

// The clipboard module pulls in CodeBlockContent → utils/prism which touches
// `window` at import time. Stub the prism shim (same stub as the sibling specs).
vi.mock('../../utils/prism/index', () => ({
    default: {},
    walkTokens: () => null,
    loadedLanguages: new Set(),
    transformAliasToOrigin: (s: string) => s,
    loadLanguage: () => null,
    search: () => [],
}));

const Clipboard = (await import('../index')).default;

// `Clipboard.pasteImage(src)` is the programmatic image-insert entry used by the
// desktop macOS screenshot flow. Chromium removed `document.execCommand('paste')`,
// so the screenshot can no longer ride the synthetic paste event — the main
// process hands the renderer a saved PNG path and we splice it in at the cursor,
// routing through `imageAction` exactly like a clipboard image paste.

function makeAnchorBlock(initialText = '', cursor = 0) {
    const block = {
        text: initialText,
        blockName: 'paragraph.content',
        getCursor: () => ({
            start: { offset: cursor },
            end: { offset: cursor },
        }),
        setCursor: vi.fn(),
        getAnchor: () => null,
    };
    return block as unknown as Content;
}

function makeClipboard(options: Record<string, unknown>, anchorBlock: Content) {
    const clipboard = new Clipboard({
        options,
        editor: { activeContentBlock: anchorBlock },
    } as unknown as Muya);
    Object.defineProperty(clipboard, 'selection', {
        get: () => ({
            getSelection: () => ({
                isSelectionInSameBlock: true,
                anchor: { block: anchorBlock },
            }),
        }),
    });
    return clipboard;
}

describe('clipboard.pasteImage — programmatic image insert (screenshot)', () => {
    it('inserts an image at the cursor and routes the src through imageAction', async () => {
        const anchorBlock = makeAnchorBlock('', 0);
        const imageAction = vi.fn().mockResolvedValue('assets/shot.png');
        const clipboard = makeClipboard({ imageAction }, anchorBlock);

        await clipboard.pasteImage('/abs/2026-screenshot.png');

        expect(imageAction).toHaveBeenCalledWith({
            src: '/abs/2026-screenshot.png',
            alt: '',
            title: '',
        });
        expect(anchorBlock.text).toBe('![](assets/shot.png)');
    });

    it('inserts the src directly when no imageAction is configured', async () => {
        const anchorBlock = makeAnchorBlock('', 0);
        const clipboard = makeClipboard({}, anchorBlock);

        await clipboard.pasteImage('/abs/shot.png');

        expect(anchorBlock.text).toBe('![](/abs/shot.png)');
    });

    it('does nothing for an empty src', async () => {
        const anchorBlock = makeAnchorBlock('existing', 8);
        const imageAction = vi.fn();
        const clipboard = makeClipboard({ imageAction }, anchorBlock);

        await clipboard.pasteImage('');

        expect(imageAction).not.toHaveBeenCalled();
        expect(anchorBlock.text).toBe('existing');
    });
});
