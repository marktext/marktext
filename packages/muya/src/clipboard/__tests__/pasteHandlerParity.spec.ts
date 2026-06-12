// @vitest-environment happy-dom

/* eslint-disable ts/no-explicit-any */
import type { Muya } from '../../muya';
import { describe, expect, it, vi } from 'vitest';
import { ScrollPage } from '../../block/scrollPage';

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

// Keep the real markdown/HTML conversion logic, but neuter `normalizePastedHTML`
// (its DOMPurify call needs a richer DOM than the test gives) — return the html
// unchanged so the converter sees what we pasted.
vi.mock('../../utils/paste', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../utils/paste')>();
    return {
        ...actual,
        normalizePastedHTML: async (html: string) => html,
    };
});

const Clipboard = (await import('../index')).default;

// ---------------------------------------------------------------------------
// Fakes. The pasteHandler block-creation path calls
// `ScrollPage.loadBlock(name).create(muya, state)` and
// `wrapperBlock.parent.insertAfter(newBlock, ref)`. We record every created
// block's state and the wrapper's children so a test can assert that single
// line markdown produced REAL block states (heading / list / table / quote)
// rather than a literal text insert.
// ---------------------------------------------------------------------------

interface IRecordedBlock {
    name: string;
    state: any;
    _contentText: string;
}

function makeCreatedBlock(state: any): IRecordedBlock & {
    firstContentInDescendant: () => any;
    lastContentInDescendant: () => any;
} {
    const content = {
        text: state.text ?? '',
        setCursor: vi.fn(),
    };
    return {
        name: state.name,
        state,
        _contentText: state.text ?? '',
        firstContentInDescendant: () => content,
        lastContentInDescendant: () => content,
    };
}

function installLoadBlockSpy(created: IRecordedBlock[]) {
    return vi.spyOn(ScrollPage, 'loadBlock').mockImplementation((_name: string) => {
        return {
            create: (_muya: Muya, state: any) => {
                const block = makeCreatedBlock(state);
                created.push(block);
                return block;
            },
        } as any;
    });
}

function makeWrapper(blockName: string) {
    const children: any[] = [];
    const wrapper: any = {
        blockName,
        firstContentInDescendant: () => null,
        getState: () => ({ name: blockName, text: '' }),
        remove: vi.fn(),
    };
    wrapper.parent = {
        insertAfter: vi.fn((newBlock: any, _ref: any) => {
            children.push(newBlock);
        }),
        children,
    };
    return wrapper;
}

function makeAnchorBlock(
    blockName: string,
    text: string,
    wrapper: any,
    cursor = text.length,
) {
    const block: any = {
        blockName,
        text,
        getCursor: () => ({ start: { offset: cursor }, end: { offset: cursor } }),
        setCursor: vi.fn(),
        getAnchor: () => wrapper,
        firstContentInDescendant: () => block,
        getState: () => ({ name: blockName, text: block.text }),
        update: vi.fn(),
    };
    return block;
}

function makeClipboard(
    anchorBlock: any,
    options: Record<string, unknown> = {},
    tableStub: { hasSelection: boolean; getStateForCopy: () => any; clear: ReturnType<typeof vi.fn> } = {
        hasSelection: false,
        getStateForCopy: () => null,
        clear: vi.fn(),
    },
) {
    const clipboard = new Clipboard({
        options: { bulletListMarker: '-', frontMatter: true, ...options },
        editor: {},
    } as unknown as Muya);
    Object.defineProperty(clipboard, 'selection', {
        get: () => ({
            getSelection: () => ({ isSelectionInSameBlock: true, anchorBlock }),
            table: tableStub,
        }),
    });
    return clipboard;
}

function makePasteEvent(data: Record<string, string> = {}) {
    return {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        clipboardData: {
            getData: (type: string) => data[type] ?? '',
            files: [],
            items: [],
        },
    } as unknown as ClipboardEvent;
}

describe('pasteHandler — single-line markdown parses into real blocks (sub-item 1)', () => {
    it('pastes `# Title` into an empty paragraph as an atx-heading block', async () => {
        const created: IRecordedBlock[] = [];
        installLoadBlockSpy(created);
        const wrapper = makeWrapper('paragraph');
        const anchor = makeAnchorBlock('paragraph.content', '', wrapper, 0);
        const clipboard = makeClipboard(anchor);

        await clipboard.pasteHandler(makePasteEvent({ 'text/plain': '# Title' }));

        const names = created.map(b => b.name);
        expect(names).toContain('atx-heading');
        expect(anchor.text).toBe('');
    });

    it('pastes `- item` into an empty paragraph as a bullet-list block', async () => {
        const created: IRecordedBlock[] = [];
        installLoadBlockSpy(created);
        const wrapper = makeWrapper('paragraph');
        const anchor = makeAnchorBlock('paragraph.content', '', wrapper, 0);
        const clipboard = makeClipboard(anchor);

        await clipboard.pasteHandler(makePasteEvent({ 'text/plain': '- item' }));

        expect(created.map(b => b.name)).toContain('bullet-list');
    });

    it('pastes `1. one` into an empty paragraph as an order-list block', async () => {
        const created: IRecordedBlock[] = [];
        installLoadBlockSpy(created);
        const wrapper = makeWrapper('paragraph');
        const anchor = makeAnchorBlock('paragraph.content', '', wrapper, 0);
        const clipboard = makeClipboard(anchor);

        await clipboard.pasteHandler(makePasteEvent({ 'text/plain': '1. one' }));

        expect(created.map(b => b.name)).toContain('order-list');
    });

    it('pastes `> quote` into an empty paragraph as a block-quote block', async () => {
        const created: IRecordedBlock[] = [];
        installLoadBlockSpy(created);
        const wrapper = makeWrapper('paragraph');
        const anchor = makeAnchorBlock('paragraph.content', '', wrapper, 0);
        const clipboard = makeClipboard(anchor);

        await clipboard.pasteHandler(makePasteEvent({ 'text/plain': '> quote' }));

        expect(created.map(b => b.name)).toContain('block-quote');
    });

    it('pastes a single-line GFM table into an empty paragraph as a table block', async () => {
        const created: IRecordedBlock[] = [];
        installLoadBlockSpy(created);
        const wrapper = makeWrapper('paragraph');
        const anchor = makeAnchorBlock('paragraph.content', '', wrapper, 0);
        const clipboard = makeClipboard(anchor);

        const md = '| a | b |\n| - | - |\n| 1 | 2 |';
        await clipboard.pasteHandler(makePasteEvent({ 'text/plain': md }));

        expect(created.map(b => b.name)).toContain('table');
    });
});

describe('pasteHandler — single-line paste keeps literal insert for code-like anchors', () => {
    it('language-input anchor inserts the text literally, no block creation', async () => {
        const created: IRecordedBlock[] = [];
        installLoadBlockSpy(created);
        const wrapper = makeWrapper('code-block');
        const anchor = makeAnchorBlock('language-input', '', wrapper, 0);
        const clipboard = makeClipboard(anchor);

        await clipboard.pasteHandler(makePasteEvent({ 'text/plain': '# Title' }));

        expect(created).toHaveLength(0);
        expect(anchor.text).toBe('# Title');
    });

    it('table.cell.content anchor inserts literally with \\n → <br/>', async () => {
        const created: IRecordedBlock[] = [];
        installLoadBlockSpy(created);
        const wrapper = makeWrapper('table');
        const anchor = makeAnchorBlock('table.cell.content', '', wrapper, 0);
        const clipboard = makeClipboard(anchor);

        await clipboard.pasteHandler(makePasteEvent({ 'text/plain': '- item' }));

        expect(created).toHaveLength(0);
        expect(anchor.text).toBe('- item');
    });

    it('codeblock.content anchor inserts the text literally', async () => {
        const created: IRecordedBlock[] = [];
        installLoadBlockSpy(created);
        const wrapper = makeWrapper('code-block');
        const anchor = makeAnchorBlock('codeblock.content', '', wrapper, 0);
        const clipboard = makeClipboard(anchor);

        await clipboard.pasteHandler(makePasteEvent({ 'text/plain': '# Title' }));

        expect(created).toHaveLength(0);
        expect(anchor.text).toBe('# Title');
    });
});

describe('pasteHandler — block-level HTML becomes a live html-block (sub-item 2)', () => {
    it('pastes `<ul>...</ul>` (block HTML in text/plain) as an html-block, not a ```html code block', async () => {
        const created: IRecordedBlock[] = [];
        const spy = installLoadBlockSpy(created);
        const wrapper = makeWrapper('paragraph');
        const anchor = makeAnchorBlock('paragraph.content', '', wrapper, 0);
        const clipboard = makeClipboard(anchor);

        // A block-level tag arrives in text/plain only (no text/html flavour) →
        // getCopyTextType returns 'code' (legacy `copyAsHtml`).
        await clipboard.pasteHandler(
            makePasteEvent({ 'text/plain': '<ul><li>a</li><li>b</li></ul>' }),
        );

        const requested = spy.mock.calls.map(c => c[0]);
        expect(requested).toContain('html-block');
        expect(created.some(b => b.name === 'html-block')).toBe(true);
        expect(created.some(b => b.state?.meta?.lang === 'html')).toBe(false);
    });
});

describe('pasteHandler — table-cell paste guards (sub-item 4)', () => {
    function makeClipboardWithTableSelection(
        anchorBlock: any,
        hasSelection: boolean,
        isSingleCell: boolean,
    ) {
        const rows = isSingleCell
            ? [{ children: [{ text: '' }] }]
            : [{ children: [{ text: '' }, { text: '' }] }];
        const tableStub = {
            hasSelection,
            getStateForCopy: () => ({ name: 'table', children: rows }),
            clear: vi.fn(),
        };
        return makeClipboard(anchorBlock, {}, tableStub);
    }

    it('single-cell selection replaces the cell text (\\n → <br/>)', async () => {
        installLoadBlockSpy([]);
        const wrapper = makeWrapper('table');
        const anchor = makeAnchorBlock('table.cell.content', 'old', wrapper, 3);
        const clipboard = makeClipboardWithTableSelection(anchor, true, true);

        await clipboard.pasteHandler(
            makePasteEvent({ 'text/plain': 'line1\nline2' }),
        );

        expect(anchor.text).toBe('line1<br/>line2');
    });

    it('multi-cell selection is a no-op — the cell text is left unchanged', async () => {
        installLoadBlockSpy([]);
        const wrapper = makeWrapper('table');
        const anchor = makeAnchorBlock('table.cell.content', 'keep', wrapper, 4);
        const clipboard = makeClipboardWithTableSelection(anchor, true, false);

        await clipboard.pasteHandler(
            makePasteEvent({ 'text/plain': 'pasted' }),
        );

        expect(anchor.text).toBe('keep');
    });
});
