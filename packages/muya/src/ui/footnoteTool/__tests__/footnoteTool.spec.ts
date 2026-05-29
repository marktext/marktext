// @vitest-environment happy-dom
import type { Muya } from '../../../muya';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FootnoteTool } from '..';
import { registerBlocks } from '../../../block';
import EventCenter from '../../../event';

// Register the block tree so `ScrollPage.loadBlock('footnote')` resolves
// inside `_createDefinition`. Idempotent — re-registering reuses the same
// Map key.
registerBlocks();

// Integration-shaped tests for the footnote tool: emit the
// `muya-footnote-tool` event with a payload shaped like what the click
// dispatcher will produce, advance past the listener's setTimeout, then
// inspect the rendered DOM + observable side effects. We mock the parts of
// Muya the tool touches (eventCenter, domNode, scrollPage.append) but
// otherwise run BaseFloat for real so the DOM-render path is exercised
// end-to-end.

interface IFakeContent {
    text: string;
    setCursor: ReturnType<typeof vi.fn>;
}

interface IFakeFootnoteBlock {
    blockName: 'footnote';
    meta: { identifier: string };
    domNode: HTMLElement;
    firstContentInDescendant: () => IFakeContent;
    depthFirstTraverse: (cb: (n: { text?: string; isContent: () => boolean }) => void) => void;
}

function makeFakeFootnote(identifier: string, definitionText: string): IFakeFootnoteBlock {
    const dom = document.createElement('figure');
    dom.scrollIntoView = vi.fn();
    const content: IFakeContent = {
        text: definitionText,
        setCursor: vi.fn(),
    };
    return {
        blockName: 'footnote',
        meta: { identifier },
        domNode: dom,
        firstContentInDescendant: () => content,
        depthFirstTraverse: (cb) => {
            cb({ text: definitionText, isContent: () => true });
        },
    };
}

function makeFakeMuya(): { muya: Muya; eventCenter: EventCenter; appendSpy: ReturnType<typeof vi.fn> } {
    const eventCenter = new EventCenter();
    const editorDomNode = document.createElement('div');
    const editorWrapper = document.createElement('div');
    editorWrapper.appendChild(editorDomNode);
    document.body.appendChild(editorWrapper);

    // Stand-in for ScrollPage so the tool's `_createDefinition` can both
    // append (the assertion we care about) and dereference `block.path` for
    // the post-append setCursor: the real Parent.append wires the parent,
    // and Parent.path on the root scrollPage is `[]`.
    const scrollPage = {
        append: vi.fn(),
        path: [] as unknown[],
        offset: () => 0,
    };
    const appendSpy = scrollPage.append as ReturnType<typeof vi.fn>;
    appendSpy.mockImplementation((block: { parent?: unknown }) => {
        block.parent = scrollPage;
    });

    const muya = {
        domNode: editorDomNode,
        eventCenter,
        i18n: { t: (s: string) => s },
        options: {
            footnote: true,
            autoPairBracket: false,
            autoPairMarkdownSyntax: false,
            autoPairQuote: false,
        },
        editor: {
            scrollPage,
            // ParagraphContent.update reads inlineRenderer.patch + getLabelInfo
            // during createDomNode. Stub minimally — the tool exercises the
            // create flow, not the inline render output.
            inlineRenderer: {
                patch: () => {},
                getLabelInfo: () => ({ label: '' }),
            },
            // setCursor() on the new paragraph dispatches into selection;
            // no-op stub is enough for the contract this test asserts.
            selection: { setSelection: () => {} },
            activeContentBlock: null,
        },
    } as unknown as Muya;

    return { muya, eventCenter, appendSpy };
}

async function nextTick() {
    // The tool defers `show()` + `render()` through `setTimeout(fn, 0)` to
    // let the originating click event finish propagating before BaseFloat's
    // document-click hide handler can race the float open.
    await new Promise(resolve => setTimeout(resolve, 0));
}

describe('footnoteTool — render on muya-footnote-tool event', () => {
    let muya: Muya;
    let eventCenter: EventCenter;
    let tool: FootnoteTool;
    let reference: HTMLElement;

    beforeEach(() => {
        ({ muya, eventCenter } = makeFakeMuya());
        tool = new FootnoteTool(muya);
        reference = document.createElement('sup');
        // BaseFloat uses computePosition off the reference; happy-dom doesn't
        // populate layout, so a stubbed rect keeps autoUpdate from throwing.
        reference.getBoundingClientRect = () =>
            ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => '' }) as DOMRect;
        document.body.appendChild(reference);
    });

    it('renders a "Go to" button + the definition preview when the identifier hits an existing footnote', async () => {
        const footnotes = new Map<string, IFakeFootnoteBlock>();
        footnotes.set('foo', makeFakeFootnote('foo', 'definition body text'));

        eventCenter.emit('muya-footnote-tool', { reference, identifier: 'foo', footnotes });
        await nextTick();

        const container = tool.container!;
        const button = container.querySelector('a.btn');
        expect(button?.textContent).toBe('Go to');
        const text = container.querySelector('.text');
        expect(text?.textContent).toContain('definition body text');
    });

    it('renders a "Create" button + missing-footnote prompt when the identifier has no matching definition', async () => {
        const footnotes = new Map<string, IFakeFootnoteBlock>();

        eventCenter.emit('muya-footnote-tool', { reference, identifier: 'missing', footnotes });
        await nextTick();

        const container = tool.container!;
        const button = container.querySelector('a.btn');
        expect(button?.textContent).toBe('Create');
        const text = container.querySelector('.text');
        expect(text?.textContent).toContain('missing');
    });
});

describe('footnoteTool — click actions', () => {
    it('goTo: clicking the "Go to" button scrolls the footnote into view and places the cursor on its first content', async () => {
        const { muya, eventCenter } = makeFakeMuya();
        const tool = new FootnoteTool(muya);
        const reference = document.createElement('sup');
        reference.getBoundingClientRect = () =>
            ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => '' }) as DOMRect;
        document.body.appendChild(reference);

        const target = makeFakeFootnote('bar', 'hello there');
        const footnotes = new Map<string, IFakeFootnoteBlock>();
        footnotes.set('bar', target);

        eventCenter.emit('muya-footnote-tool', { reference, identifier: 'bar', footnotes });
        await new Promise(resolve => setTimeout(resolve, 0));

        const button = tool.container!.querySelector('a.btn') as HTMLAnchorElement;
        button.click();

        expect(target.domNode.scrollIntoView).toHaveBeenCalledTimes(1);
        expect(target.firstContentInDescendant().setCursor).toHaveBeenCalledWith(0, 0, true);
    });

    it('create: clicking the "Create" button appends a fresh footnote block via scrollPage.append("user")', async () => {
        const { muya, eventCenter, appendSpy } = makeFakeMuya();
        const tool = new FootnoteTool(muya);
        const reference = document.createElement('sup');
        reference.getBoundingClientRect = () =>
            ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => '' }) as DOMRect;
        document.body.appendChild(reference);

        eventCenter.emit('muya-footnote-tool', {
            reference,
            identifier: 'fresh',
            footnotes: new Map(),
        });
        await new Promise(resolve => setTimeout(resolve, 0));

        const button = tool.container!.querySelector('a.btn') as HTMLAnchorElement;
        button.click();

        expect(appendSpy).toHaveBeenCalledTimes(1);
        const [insertedBlock, source] = appendSpy.mock.calls[0];
        expect(source).toBe('user');
        expect(insertedBlock?.blockName).toBe('footnote');
        expect(insertedBlock?.meta?.identifier).toBe('fresh');
    });
});
