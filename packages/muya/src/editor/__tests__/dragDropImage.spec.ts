// @vitest-environment happy-dom

import type Parent from '../../block/base/parent';
import type { Muya } from '../../muya';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BLOCK_DOM_PROPERTY } from '../../config';
import EventCenter from '../../event';

// Regression tests for marktext #4406 parity gap PG4: drag-and-drop image
// insertion (local image FILE + web-link image) was entirely absent in the
// @muyajs/core rewrite. `attachDragDropImageHandlers` restores it by binding
// dragover/drop on the editor container and inserting a dropped image as a new
// `![](src)` block — the local-file path additionally persists the image
// through the embedder `imageAction` hook.
//
// happy-dom provides a fully working `DataTransfer` (items.add / getAsString /
// files) and fires `getAsString` synchronously, so the synthetic `drop` event
// drives the real handler end-to-end. The block tree below is mocked at the
// `ScrollPage.loadBlock` seam (the single factory the handler uses to create
// the inserted paragraph) plus a fake outermost-block anchor stamped onto the
// drop-target DOM node.

// Capture the paragraph blocks the handler creates so each test can assert the
// inserted markdown text and where it landed relative to the anchor.
const createdBlocks: Array<{ text: string; insertedBefore: boolean; insertedAfter: boolean }> = [];

vi.mock('../../block/scrollPage', () => ({
    ScrollPage: {
        loadBlock: () => ({
            create: (_muya: unknown, state: { text: string }) => {
                const record = {
                    text: state.text,
                    insertedBefore: false,
                    insertedAfter: false,
                };
                createdBlocks.push(record);
                const block = {
                    record,
                    firstContentInDescendant: () => ({ setCursor: vi.fn() }),
                };
                return block;
            },
        }),
    },
}));

const { attachDragDropImageHandlers } = await import('../dragDropImage');

interface IMockMuya {
    eventCenter: EventCenter;
    domNode: HTMLElement;
    options: {
        imageAction?: (state: { src: string; alt: string; title: string }) => Promise<string>;
        getPathForFile?: (file: File) => string;
    };
    editor: { inlineRenderer: { renderer: { urlMap: Map<string, string> } } };
}

// Build a fake outermost anchor block whose `parent.insertBefore/insertAfter`
// flag the created paragraph so the test can assert the insert position.
function makeAnchor(anchorDom: HTMLElement): Parent {
    const parent = {
        insertBefore: (newBlock: { record?: { insertedBefore: boolean } }) => {
            if (newBlock.record)
                newBlock.record.insertedBefore = true;
        },
        insertAfter: (newBlock: { record?: { insertedAfter: boolean } }) => {
            if (newBlock.record)
                newBlock.record.insertedAfter = true;
        },
    };
    return {
        domNode: anchorDom,
        parent,
    } as unknown as Parent;
}

// A `span.mu-content` drop target stamped with a fake content block whose
// `outMostBlock` is the anchor — exactly what `findContentDOM` + `getBlock`
// resolve at runtime.
function makeDropTarget(muya: IMockMuya): HTMLElement {
    const contentDom = document.createElement('span');
    contentDom.classList.add('mu-content');
    muya.domNode.appendChild(contentDom);

    const anchorDom = document.createElement('div');
    anchorDom.getBoundingClientRect = () =>
        ({ top: 0, left: 0, width: 100, height: 40 }) as DOMRect;
    const anchor = makeAnchor(anchorDom);

    (contentDom as unknown as Record<string, unknown>)[BLOCK_DOM_PROPERTY] = {
        outMostBlock: anchor,
    };

    return contentDom;
}

function makeMuya(options: IMockMuya['options'] = {}): IMockMuya {
    const domNode = document.createElement('div');
    document.body.appendChild(domNode);
    return {
        eventCenter: new EventCenter(),
        domNode,
        options,
        editor: { inlineRenderer: { renderer: { urlMap: new Map() } } },
    };
}

function dropEvent(target: HTMLElement, dataTransfer: DataTransfer): DragEvent {
    const event = new DragEvent('drop', { bubbles: true });
    Object.defineProperty(event, 'dataTransfer', { value: dataTransfer });
    Object.defineProperty(event, 'target', { value: target });
    Object.defineProperty(event, 'clientY', { value: 5 }); // top half → insert above
    return event;
}

afterEach(() => {
    createdBlocks.length = 0;
    document.body.innerHTML = '';
});

describe('attachDragDropImageHandlers — local image FILE', () => {
    it('inserts a loading placeholder and invokes imageAction with the resolved path', async () => {
        const imageAction = vi.fn().mockResolvedValue('assets/shot.png');
        const getPathForFile = vi.fn().mockReturnValue('/abs/shot.png');
        const muya = makeMuya({ imageAction, getPathForFile });
        const contentDom = makeDropTarget(muya);
        attachDragDropImageHandlers(muya as unknown as Muya);

        const file = new File(['x'], 'shot.png', { type: 'image/png' });
        const dt = new DataTransfer();
        dt.items.add(file);

        muya.domNode.dispatchEvent(dropEvent(contentDom, dt));
        // Let the fire-and-forget imageAction promise settle.
        await Promise.resolve();
        await Promise.resolve();

        expect(getPathForFile).toHaveBeenCalledWith(file);
        // A `![loading-id](/abs/shot.png)` placeholder paragraph was inserted.
        expect(createdBlocks).toHaveLength(1);
        expect(createdBlocks[0].text).toMatch(/^!\[loading-[^\]]+\]\(\/abs\/shot\.png\)$/);
        // clientY in the top half → inserted above the anchor.
        expect(createdBlocks[0].insertedBefore).toBe(true);
        // imageAction persisted the file per the embedder preference.
        expect(imageAction).toHaveBeenCalledWith({
            src: '/abs/shot.png',
            alt: 'shot.png',
            title: '',
        });
    });

    it('inserts a clean `![name](path)` (no loading placeholder) when imageAction is absent', () => {
        const getPathForFile = vi.fn().mockReturnValue('/abs/shot.png');
        const muya = makeMuya({ getPathForFile });
        const contentDom = makeDropTarget(muya);
        attachDragDropImageHandlers(muya as unknown as Muya);

        const file = new File(['x'], 'shot.png', { type: 'image/png' });
        const dt = new DataTransfer();
        dt.items.add(file);

        muya.domNode.dispatchEvent(dropEvent(contentDom, dt));

        // Raw path is used verbatim — no permanent `loading-*` alt is left.
        expect(createdBlocks).toHaveLength(1);
        expect(createdBlocks[0].text).toBe('![shot.png](/abs/shot.png)');
    });

    it('does nothing when getPathForFile yields no path', () => {
        const imageAction = vi.fn().mockResolvedValue('x');
        const getPathForFile = vi.fn().mockReturnValue('');
        const muya = makeMuya({ imageAction, getPathForFile });
        const contentDom = makeDropTarget(muya);
        attachDragDropImageHandlers(muya as unknown as Muya);

        const file = new File(['x'], 'shot.png', { type: 'image/png' });
        const dt = new DataTransfer();
        dt.items.add(file);

        muya.domNode.dispatchEvent(dropEvent(contentDom, dt));

        expect(createdBlocks).toHaveLength(0);
        expect(imageAction).not.toHaveBeenCalled();
    });
});

// A browser image drag carries `text/uri-list` + `text/html` and (crucially)
// NO `text/plain`; a plain hyperlink drag additionally carries `text/plain`.
// The handler gates on that signature so it intercepts only likely images.
function webImageDataTransfer(url: string): DataTransfer {
    const dt = new DataTransfer();
    dt.items.add(url, 'text/uri-list');
    dt.items.add(`<img src="${url}">`, 'text/html');
    return dt;
}

describe('attachDragDropImageHandlers — web-link image', () => {
    it('inserts `![](url)` for an image URL dragged from a browser', () => {
        const muya = makeMuya();
        const contentDom = makeDropTarget(muya);
        attachDragDropImageHandlers(muya as unknown as Muya);

        const dt = webImageDataTransfer('https://example.com/pic.png');

        muya.domNode.dispatchEvent(dropEvent(contentDom, dt));

        // happy-dom fires getAsString synchronously and the URL has an image
        // extension, so the block is inserted within the same tick.
        expect(createdBlocks).toHaveLength(1);
        expect(createdBlocks[0].text).toBe('![](https://example.com/pic.png)');
        expect(createdBlocks[0].insertedBefore).toBe(true);
    });

    it('ignores a non-image URL even with the web-image signature', () => {
        const muya = makeMuya();
        const contentDom = makeDropTarget(muya);
        attachDragDropImageHandlers(muya as unknown as Muya);

        // Well-formed signature, but the URL is not an image and the
        // content-type sniff (HEAD fetch) fails under happy-dom → no insert.
        const dt = webImageDataTransfer('https://example.com/page.html');

        muya.domNode.dispatchEvent(dropEvent(contentDom, dt));

        expect(createdBlocks).toHaveLength(0);
    });

    it('ignores a plain hyperlink drag (uri-list + text/plain, no html)', () => {
        const muya = makeMuya();
        const contentDom = makeDropTarget(muya);
        attachDragDropImageHandlers(muya as unknown as Muya);

        // The "dragged a normal link" shape — must be left to the browser.
        const dt = new DataTransfer();
        dt.items.add('https://example.com/pic.png', 'text/uri-list');
        dt.items.add('https://example.com/pic.png', 'text/plain');

        muya.domNode.dispatchEvent(dropEvent(contentDom, dt));

        expect(createdBlocks).toHaveLength(0);
    });
});

describe('attachDragDropImageHandlers — drop target resolution', () => {
    it('inserts nothing when the drop is not over an editor content block', () => {
        const getPathForFile = vi.fn().mockReturnValue('/abs/shot.png');
        const muya = makeMuya({ imageAction: vi.fn(), getPathForFile });
        attachDragDropImageHandlers(muya as unknown as Muya);

        // Drop target is a bare div with no `.mu-content` ancestor.
        const stray = document.createElement('div');
        muya.domNode.appendChild(stray);
        const file = new File(['x'], 'shot.png', { type: 'image/png' });
        const dt = new DataTransfer();
        dt.items.add(file);

        muya.domNode.dispatchEvent(dropEvent(stray, dt));

        expect(createdBlocks).toHaveLength(0);
        expect(getPathForFile).not.toHaveBeenCalled();
    });
});
