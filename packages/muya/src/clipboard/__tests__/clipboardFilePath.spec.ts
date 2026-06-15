/* eslint-disable ts/no-explicit-any */
import type Content from '../../block/base/content';
import type { Muya } from '../../muya';
import { describe, expect, it, vi } from 'vitest';
import { ScrollPage } from '../../block/scrollPage';

// The clipboard module pulls in CodeBlockContent → utils/prism which touches
// `window` at import time. Stub the prism shim so the test can run under Node
// (same stub as copyHandler.spec / getClipboardData.spec).
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
// test environment doesn't provide. Stubbing it lets the fall-through paste
// path run far enough to prove the image hook short-circuited (or didn't).
vi.mock('../../utils/paste', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../utils/paste')>();
    return {
        ...actual,
        normalizePastedHTML: async (html: string) => html,
    };
});

const Clipboard = (await import('../index')).default;

// Ported behaviour from the legacy `@muyajs` `clipboardFilePath` paste hook:
// when the OS clipboard holds a file (e.g. an image copied from a file
// manager), the embedder resolves it to a local path and muya inserts that
// path as an inline image at the cursor instead of running the normal
// text/HTML paste. Returning '' (or omitting the hook) falls through to the
// default paste.

// A minimal stand-in for the anchor content block. The clipboardFilePath path
// only touches `text`, `getCursor()` and `setCursor()`; the extra `blockName`
// and `getAnchor()` members keep the fall-through text-paste path from
// crashing in the tests that assert the hook did NOT short-circuit.
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

function makeClipboard(
    options: Record<string, unknown>,
    anchorBlock: Content,
) {
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

// A clipboard event whose getData returns '' by default. Pass a map keyed by
// MIME type (e.g. { 'text/plain': 'hi' }) to simulate a clipboard that holds
// real text/HTML, proving the synchronous snapshot survives the async hook.
function makePasteEvent(data: Record<string, string> = {}) {
    const getData = vi.fn((type: string) => data[type] ?? '');
    return {
        event: {
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
            clipboardData: { getData },
        } as unknown as ClipboardEvent,
        getData,
    };
}

describe('clipboard.pasteHandler — clipboardFilePath hook', () => {
    it('invokes the hook and inserts the resolved path as an inline image', async () => {
        const clipboardFilePath = vi.fn().mockResolvedValue('/tmp/shot.png');
        const anchorBlock = makeAnchorBlock('', 0);
        const clipboard = makeClipboard({ clipboardFilePath }, anchorBlock);
        const { event, getData } = makePasteEvent();

        await clipboard.pasteHandler(event);

        expect(clipboardFilePath).toHaveBeenCalledOnce();
        expect(anchorBlock.text).toBe('![](/tmp/shot.png)');
        // Cursor lands right after the inserted image markdown.
        expect(anchorBlock.setCursor).toHaveBeenCalledWith(18, 18, true);
        // text/html is snapshotted synchronously up front (before the async
        // hook detaches the clipboard), but the resolved image still
        // short-circuits the normal text/HTML paste so nothing else inserts.
        expect(getData).toHaveBeenCalled();
    });

    it('splices the image into existing text at the cursor offset', async () => {
        const clipboardFilePath = vi.fn().mockResolvedValue('/tmp/a.png');
        // Cursor between "ab" and "cd".
        const anchorBlock = makeAnchorBlock('abcd', 2);
        const clipboard = makeClipboard({ clipboardFilePath }, anchorBlock);
        const { event } = makePasteEvent();

        await clipboard.pasteHandler(event);

        expect(anchorBlock.text).toBe('ab![](/tmp/a.png)cd');
    });

    it('escapes spaces and # in the resolved path', async () => {
        const clipboardFilePath = vi
            .fn()
            .mockResolvedValue('/tmp/my shot#1.png');
        const anchorBlock = makeAnchorBlock('', 0);
        const clipboard = makeClipboard({ clipboardFilePath }, anchorBlock);
        const { event } = makePasteEvent();

        await clipboard.pasteHandler(event);

        expect(anchorBlock.text).toBe('![](/tmp/my%20shot%231.png)');
    });

    it('falls through to the normal paste when the hook returns ""', async () => {
        const clipboardFilePath = vi.fn().mockResolvedValue('');
        const anchorBlock = makeAnchorBlock('', 0);
        const clipboard = makeClipboard({ clipboardFilePath }, anchorBlock);
        const { event, getData } = makePasteEvent();

        await clipboard.pasteHandler(event);

        expect(clipboardFilePath).toHaveBeenCalledOnce();
        // No image inserted; the text/HTML branch was reached (getData read).
        expect(anchorBlock.text).toBe('');
        expect(getData).toHaveBeenCalled();
    });

    it('pastes the snapshotted text/plain when the hook is present but returns ""', async () => {
        // Regression: the hook is configured, so `pasteHandler` awaits it. The
        // snapshot of `event.clipboardData` must be taken synchronously BEFORE
        // that await — otherwise the detached DataTransfer would yield '' here
        // and the paste would silently insert nothing.
        //
        // A plain-text paste into a non-literal anchor now always parses
        // through `MarkdownToState` (Track D / sub-item 1), so the captured text
        // lands in a created paragraph block rather than being spliced into the
        // anchor verbatim. Mock `loadBlock` to capture the created block's state.
        const created: any[] = [];
        const spy = vi
            .spyOn(ScrollPage, 'loadBlock')
            .mockImplementation(() => ({
                create: (_muya: unknown, state: any) => {
                    created.push(state);
                    return {
                        firstContentInDescendant: () => ({
                            text: state.text ?? '',
                            setCursor: vi.fn(),
                        }),
                    };
                },
            }) as any);

        const clipboardFilePath = vi.fn().mockResolvedValue('');
        const anchorBlock = makeAnchorBlock('', 0);
        // The anchor's wrapper records the created block so the empty origin
        // paragraph cleanup can run without crashing.
        const wrapper = {
            blockName: 'paragraph',
            getState: () => ({ name: 'paragraph', text: '' }),
            remove: vi.fn(),
            parent: { insertAfter: vi.fn() },
        };
        (anchorBlock as any).getAnchor = () => wrapper;
        const clipboard = makeClipboard({ clipboardFilePath }, anchorBlock);
        const { event, getData } = makePasteEvent({ 'text/plain': 'hello world' });

        await clipboard.pasteHandler(event);

        expect(clipboardFilePath).toHaveBeenCalledOnce();
        expect(getData).toHaveBeenCalledWith('text/plain');
        // The captured text survived the async hook and reached the paste path.
        expect(created).toEqual([{ name: 'paragraph', text: 'hello world' }]);

        spy.mockRestore();
    });

    it('falls through to the normal paste when the resolved path is not an image', async () => {
        const clipboardFilePath = vi.fn().mockResolvedValue('/tmp/notes.txt');
        const anchorBlock = makeAnchorBlock('', 0);
        const clipboard = makeClipboard({ clipboardFilePath }, anchorBlock);
        const { event, getData } = makePasteEvent();

        await clipboard.pasteHandler(event);

        expect(anchorBlock.text).toBe('');
        expect(getData).toHaveBeenCalled();
    });

    it('does nothing special when the hook is absent', async () => {
        const anchorBlock = makeAnchorBlock('', 0);
        const clipboard = makeClipboard({}, anchorBlock);
        const { event, getData } = makePasteEvent();

        await clipboard.pasteHandler(event);

        expect(anchorBlock.text).toBe('');
        expect(getData).toHaveBeenCalled();
    });
});
