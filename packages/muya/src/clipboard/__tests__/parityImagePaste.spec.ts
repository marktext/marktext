import type Content from '../../block/base/content';
import type { Muya } from '../../muya';
import { describe, expect, it, vi } from 'vitest';

// PARITY SCOREBOARD — gaps PG5 (file PG05) + PG6 (file PG06).
//
// PG6: legacy `packages/muyajs` routed a pasted image FILE through
// `imageAction(imagePath, id)` so the user's `imageInsertAction` preference
// (copy-to-assets / upload / keep-path) applied. `@muyajs/core`'s path-paste
// branch calls `insertImagePath(anchorBlock, imagePath)`, which writes
// `![](rawPath)` verbatim and NEVER invokes `options.imageAction` — so a
// pasted image file is linked from its original on-disk location and the
// document is non-portable.
//
// PG5: legacy `packages/muyajs` `pasteImage()` had a binary/bitmap branch:
// when no clipboard file path resolved, it read the in-memory image File via
// `clipboardData.items[i].getAsFile()` + `FileReader.readAsDataURL` and
// persisted it via `imageAction(file, id)`. `@muyajs/core`'s `pasteHandler`
// has no `getAsFile`/`FileReader`/`clipboardData.files` path at all, so a
// bitmap-only clipboard (screenshot, browser "Copy Image") inserts nothing.
//
// Both assert the DESIRED behaviour. The engine now routes pasted images
// (resolved file paths and in-memory bitmaps) through `options.imageAction`
// (PG05/PG06), so they pass.

// The clipboard module pulls in CodeBlockContent → utils/prism which touches
// `window` at import time. Stub the prism shim so the test can run under Node
// (same stub as clipboardFilePath.spec / copyHandler.spec).
vi.mock('../../utils/prism/index', () => ({
    default: {},
    walkTokens: () => null,
    loadedLanguages: new Set(),
    transformAliasToOrigin: (s: string) => s,
    loadLanguage: () => null,
    search: () => [],
}));

// Keep the real `resolveClipboardImagePath` (the decision under test) but neuter
// `normalizePastedHTML`, whose DOMPurify call needs a DOM the default `node`
// test environment doesn't provide.
vi.mock('../../utils/paste', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../utils/paste')>();
    return {
        ...actual,
        normalizePastedHTML: async (html: string) => html,
    };
});

const Clipboard = (await import('../index')).default;

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
    return block as unknown as Content & { setCursor: ReturnType<typeof vi.fn> };
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

// A paste event with optional text/html data and optional in-memory image
// `files`/`items` (the bitmap clipboard case for PG5).
function makePasteEvent(
    data: Record<string, string> = {},
    files: File[] = [],
) {
    const getData = vi.fn((type: string) => data[type] ?? '');
    const items = files.map(file => ({
        kind: 'file',
        type: file.type,
        getAsFile: () => file,
    }));
    return {
        event: {
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
            clipboardData: { getData, files, items },
        } as unknown as ClipboardEvent,
        getData,
    };
}

describe('parity PG6: pasted image FILE routes through imageAction', () => {
    it(
        'PG6: a resolved clipboard image path is persisted via options.imageAction (insert preference)',
        async () => {
            const clipboardFilePath = vi.fn().mockResolvedValue('/abs/photo.png');
            // The user's insert preference moves the file into the assets dir and
            // returns the rewritten src.
            const imageAction = vi
                .fn()
                .mockResolvedValue('assets/photo.png');
            const anchorBlock = makeAnchorBlock('', 0);
            const clipboard = makeClipboard(
                { clipboardFilePath, imageAction },
                anchorBlock,
            );
            const { event } = makePasteEvent();

            await clipboard.pasteHandler(event);

            // Desired: imageAction was invoked with the resolved source path so
            // the copy-to-assets / upload preference can apply.
            expect(imageAction).toHaveBeenCalledTimes(1);
            const arg = imageAction.mock.calls[0][0];
            const src = typeof arg === 'string' ? arg : arg?.src;
            expect(src).toBe('/abs/photo.png');
        },
    );

    it(
        'PG6: the persisted (rewritten) src — not the raw on-disk path — is inserted',
        async () => {
            const clipboardFilePath = vi.fn().mockResolvedValue('/abs/photo.png');
            const imageAction = vi.fn().mockResolvedValue('assets/photo.png');
            const anchorBlock = makeAnchorBlock('', 0);
            const clipboard = makeClipboard(
                { clipboardFilePath, imageAction },
                anchorBlock,
            );
            const { event } = makePasteEvent();

            await clipboard.pasteHandler(event);

            // Desired: the assets-relative src returned by imageAction is what
            // lands in the document (portable).
            expect(anchorBlock.text).toBe('![](assets/photo.png)');
        },
    );
});

describe('parity PG5: binary/bitmap clipboard image paste', () => {
    it(
        'PG5: a bitmap-only clipboard (no file path) inserts an image via imageAction',
        async () => {
            // No clipboardFilePath hook resolves a path: the only data is an
            // in-memory PNG File (the screenshot / "Copy Image" case).
            const clipboardFilePath = vi.fn().mockResolvedValue('');
            const imageAction = vi.fn().mockResolvedValue('assets/pasted.png');
            const anchorBlock = makeAnchorBlock('', 0);
            const clipboard = makeClipboard(
                { clipboardFilePath, imageAction },
                anchorBlock,
            );
            const pngFile = new File([new Uint8Array([0x89, 0x50, 0x4E, 0x47])], 'image.png', {
                type: 'image/png',
            });
            const { event } = makePasteEvent({}, [pngFile]);

            await clipboard.pasteHandler(event);

            // Desired: the binary image is persisted through imageAction and an
            // image is inserted.
            expect(imageAction).toHaveBeenCalledTimes(1);
            expect(anchorBlock.text).toBe('![](assets/pasted.png)');
        },
    );
});
