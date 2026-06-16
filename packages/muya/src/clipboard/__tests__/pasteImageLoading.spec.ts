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

vi.mock('../../utils/paste', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../utils/paste')>();
    return {
        ...actual,
        normalizePastedHTML: async (html: string) => html,
    };
});

const Clipboard = (await import('../index')).default;

// Track D / sub-item 5 (D3): pasting an image should insert a LOADING
// placeholder image immediately, then await `imageAction`, and only then
// replace the placeholder with the final src. Mirrors legacy
// `pasteCtrl.pasteImage`'s `loading-<id>` insert → imageAction → replace flow.

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
    const clipboard = new Clipboard({ options } as unknown as Muya);
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

function makePasteEvent() {
    return {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        clipboardData: { getData: () => '', files: [], items: [] },
    } as unknown as ClipboardEvent;
}

describe('pasteHandler image paste — loading placeholder then replace (sub-item 5)', () => {
    it('inserts a placeholder image BEFORE imageAction resolves, then swaps in the final src', async () => {
        let resolveAction: (src: string) => void = () => {};
        const actionPromise = new Promise<string>((resolve) => {
            resolveAction = resolve;
        });
        const anchorBlock = makeAnchorBlock('', 0);
        // While imageAction is in flight, the anchor must already carry a
        // placeholder image (non-empty) so the user sees a loading state.
        let textWhileLoading: string | null = null;
        const imageAction = vi.fn().mockImplementation(() => {
            textWhileLoading = anchorBlock.text;
            return actionPromise;
        });
        const clipboardFilePath = vi.fn().mockResolvedValue('/abs/photo.png');

        const clipboard = makeClipboard(
            { clipboardFilePath, imageAction },
            anchorBlock,
        );

        const done = clipboard.pasteHandler(makePasteEvent());

        // The placeholder is spliced in synchronously just before `imageAction`
        // is awaited; wait until that call to avoid coupling to microtask counts.
        await vi.waitFor(() => expect(imageAction).toHaveBeenCalled());

        // A placeholder image markdown must already be present in the anchor.
        expect(anchorBlock.text).toMatch(/!\[[^\]]*\]\([^)]+\)/);

        resolveAction('assets/photo.png');
        await done;

        // The placeholder was captured while imageAction was pending.
        expect(textWhileLoading).toMatch(/!\[[^\]]*\]\([^)]+\)/);
        // And the final anchor text carries the resolved src, exactly once.
        expect(anchorBlock.text).toBe('![](assets/photo.png)');
    });
});
