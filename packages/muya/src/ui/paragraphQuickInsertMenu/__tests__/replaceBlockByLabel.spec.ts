// @vitest-environment happy-dom
import type Parent from '../../../block/base/parent';
import type { IConstructor } from '../../../block/types';
import type { Muya } from '../../../index';
import { describe, expect, it, vi } from 'vitest';
import { replaceBlockByLabel } from '../../../block/blockTransforms';
import { ScrollPage } from '../../../block/scrollPage';

// Loose mock-block shape the tests build via `makeFakeBlock` /
// `makeFakeOriginBlock`. These don't satisfy the full Parent surface — the
// production helper only touches the methods listed here, so we keep the
// surface narrow and cast at the boundary instead of dragging `any` in.
interface IFakeBlockState {
    name: string;
    meta?: Record<string, unknown>;
    children: IFakeBlockState[];
    text?: string;
}
interface IFakeBlock {
    state?: IFakeBlockState;
    parent?: { insertAfter: ReturnType<typeof vi.fn> };
    replaceWith: ReturnType<typeof vi.fn>;
    firstContentInDescendant?: () => { text: string; setCursor: ReturnType<typeof vi.fn> };
}

// Regression for marktext 8891287b "fix paragraph turn into list bug (#1025)".
//
// In marktext, the old `updateCtrl.updateParagraphToList` ran a loop on
// `text.split('\n')` looking for `LIST_ITEM_REG.test(l)` matches and dropped
// every line that didn't match into `preParagraphLines`. When the conversion
// was triggered from the front menu (no `marker` argument), no line ever
// matched the bullet/order regex, so the entire paragraph contents were
// silently lost.
//
// The marktext fix branched: `if (marker) { …split-and-strip… } else
// { listItemLines = lines /* take the whole input verbatim */ }`.
//
// The new architecture has no `updateParagraphToList` at all — front-menu
// conversion is `replaceBlockByLabel({label: 'bullet-list', text})`, which
// builds the new list from `deepClone(emptyStates['bullet-list'])` and assigns
// the whole `text` to `state.children[0].children[0].text` (a single
// list-item's paragraph). No line splitting, no marker regex.
//
// We unit-test `replaceBlockByLabel` by stubbing `ScrollPage.loadBlock(...).create`
// so we can capture the state object it builds, then assert that the text
// the user typed survives verbatim.

interface ICapturedCreate {
    label: string;
    state: IFakeBlockState;
}

function setupCreateSpy(): {
    captured: ICapturedCreate[];
    restore: () => void;
} {
    const captured: ICapturedCreate[] = [];
    const realLoadBlock = ScrollPage.loadBlock.bind(ScrollPage);
    const spy = vi.spyOn(ScrollPage, 'loadBlock').mockImplementation((label: string) => {
        const ctor = {
            blockName: label,
            create: (_muya: Muya, state: IFakeBlockState) => {
                captured.push({ label, state });
                // Return a fake block with the surface `replaceBlockByLabel`
                // touches afterwards (`replaceWith` / `firstContentInDescendant`).
                return makeFakeBlock(state);
            },
        };
        return ctor as unknown as IConstructor<Parent>;
    });

    return {
        captured,
        restore: () => {
            spy.mockRestore();
            // The mock above does not call the real `loadBlock`, but reset for safety.
            void realLoadBlock;
        },
    };
}

function makeFakeBlock(state: IFakeBlockState): IFakeBlock {
    return {
        state,
        parent: { insertAfter: vi.fn() },
        replaceWith: vi.fn(),
        firstContentInDescendant: () => ({
            text: '',
            setCursor: vi.fn(),
        }),
    };
}

function makeFakeOriginBlock(): Parent {
    return {
        replaceWith: vi.fn(),
    } as unknown as Parent;
}

function makeFakeMuya(): Muya {
    return {
        options: {
            preferLooseListItem: false,
            bulletListMarker: '-',
            orderListDelimiter: '.',
            frontmatterType: '---',
        },
    } as unknown as Muya;
}

describe('replaceBlockByLabel — paragraph→list keeps text verbatim (marktext 8891287b)', () => {
    it('bullet-list: puts plain paragraph text into the first list-item paragraph', () => {
        const { captured, restore } = setupCreateSpy();
        try {
            replaceBlockByLabel({
                block: makeFakeOriginBlock(),
                muya: makeFakeMuya(),
                label: 'bullet-list',
                text: 'plain text',
            });

            const list = captured.find(c => c.label === 'bullet-list')!;
            expect(list).toBeTruthy();
            expect(list.state.name).toBe('bullet-list');
            expect(list.state.children).toHaveLength(1);
            expect(list.state.children[0].name).toBe('list-item');
            expect(list.state.children[0].children[0].name).toBe('paragraph');
            expect(list.state.children[0].children[0].text).toBe('plain text');
        }
        finally {
            restore();
        }
    });

    it('does not strip a leading `- ` from the bullet-list text (no marker regex)', () => {
        // Pre-fix marktext (front-menu trigger, no marker) dropped this entire
        // text since no line matched the bullet regex while `isPushedListItemLine`
        // stayed false. New muya must keep it verbatim.
        const { captured, restore } = setupCreateSpy();
        try {
            replaceBlockByLabel({
                block: makeFakeOriginBlock(),
                muya: makeFakeMuya(),
                label: 'bullet-list',
                text: '- foo',
            });

            const list = captured.find(c => c.label === 'bullet-list')!;
            expect(list.state.children[0].children[0].text).toBe('- foo');
        }
        finally {
            restore();
        }
    });

    it('order-list: does not strip a leading `1. ` from the text', () => {
        const { captured, restore } = setupCreateSpy();
        try {
            replaceBlockByLabel({
                block: makeFakeOriginBlock(),
                muya: makeFakeMuya(),
                label: 'order-list',
                text: '1. foo',
            });

            const list = captured.find(c => c.label === 'order-list')!;
            expect(list.state.children[0].children[0].text).toBe('1. foo');
        }
        finally {
            restore();
        }
    });

    it('keeps multi-line text in a single list-item paragraph (no split)', () => {
        // Pre-fix marktext walked `text.split("\n")` and partitioned lines
        // into preParagraphLines vs listItemLines. New muya never splits —
        // the whole string goes into one paragraph.
        const { captured, restore } = setupCreateSpy();
        try {
            replaceBlockByLabel({
                block: makeFakeOriginBlock(),
                muya: makeFakeMuya(),
                label: 'bullet-list',
                text: 'first line\nsecond line\nthird',
            });

            const list = captured.find(c => c.label === 'bullet-list')!;
            expect(list.state.children).toHaveLength(1);
            expect(list.state.children[0].children[0].text).toBe(
                'first line\nsecond line\nthird',
            );
        }
        finally {
            restore();
        }
    });

    it('task-list: first item has the checkbox meta and the input text', () => {
        const { captured, restore } = setupCreateSpy();
        try {
            replaceBlockByLabel({
                block: makeFakeOriginBlock(),
                muya: makeFakeMuya(),
                label: 'task-list',
                text: 'todo item',
            });

            const list = captured.find(c => c.label === 'task-list')!;
            expect(list.state.children[0].name).toBe('task-list-item');
            expect(list.state.children[0].meta).toEqual({ checked: false });
            expect(list.state.children[0].children[0].text).toBe('todo item');
        }
        finally {
            restore();
        }
    });

    it('empty text is acceptable (no exception, default empty paragraph)', () => {
        const { captured, restore } = setupCreateSpy();
        try {
            expect(() => {
                replaceBlockByLabel({
                    block: makeFakeOriginBlock(),
                    muya: makeFakeMuya(),
                    label: 'bullet-list',
                    text: '',
                });
            }).not.toThrow();

            const list = captured.find(c => c.label === 'bullet-list')!;
            expect(list.state.children[0].children[0].text).toBe('');
        }
        finally {
            restore();
        }
    });
});

// Front matter is prepended at the document start rather than replacing the
// cursor block in place (`block.replaceWith`), so the `/` quick-insert trigger
// text the user typed survives in the original paragraph unless we clear it
// explicitly. Every other label drops the trigger implicitly via
// `block.replaceWith(newBlock)`; front matter must clear the trigger paragraph
// itself. Regression target: "通过 quick insert 菜单插入 Front matter 时候 `/`
// 没有自动删除".
function makeFrontMatterMuya(): Muya {
    return {
        options: {
            preferLooseListItem: false,
            bulletListMarker: '-',
            orderListDelimiter: '.',
            frontmatterType: '-',
        },
        editor: {
            scrollPage: {
                firstChild: { blockName: 'paragraph' },
                insertBefore: vi.fn(),
            },
        },
    } as unknown as Muya;
}

describe('replaceBlockByLabel — frontmatter clears the `/` trigger text', () => {
    it('empties the trigger paragraph content and refreshes its DOM', () => {
        const { restore } = setupCreateSpy();
        try {
            const update = vi.fn();
            const content = { text: '/front', update };
            const replaceWith = vi.fn();
            const block = {
                replaceWith,
                firstContentInDescendant: () => content,
            } as unknown as Parent;

            replaceBlockByLabel({
                block,
                muya: makeFrontMatterMuya(),
                label: 'frontmatter',
            });

            // The `/` typed to open the menu must be gone...
            expect(content.text).toBe('');
            // ...and the DOM re-rendered so it does not keep showing `/front`.
            expect(update).toHaveBeenCalled();
            // Front matter is prepended, never an in-place replace of the cursor block.
            expect(replaceWith).not.toHaveBeenCalled();
        }
        finally {
            restore();
        }
    });
});

// The in-editor "table" insert (the `/` quick-insert menu and the paragraph
// front-menu both route through `replaceBlockByLabel`) must show the legacy
// hover-grid dimension picker (`TableChessboard`) — NOT drop a fixed-size
// table. This is a regression target: #4435 deleted the picker UI and the
// quick-insert dropped a default table directly. `replaceBlockByLabel({label:
// 'table'})` must instead dispatch `muya-table-picker` (which the chessboard
// subscribes to) with a position reference and an `(row, column)` callback,
// and that callback must create a table at `row + 1 × column + 1` to match
// legacy muyajs `showTablePicker`.
function makeTableMuya(): {
    muya: Muya;
    emit: ReturnType<typeof vi.fn>;
    createTable: ReturnType<typeof vi.fn>;
} {
    const emit = vi.fn();
    const createTable = vi.fn();

    const muya = {
        options: {
            preferLooseListItem: false,
            bulletListMarker: '-',
            orderListDelimiter: '.',
            frontmatterType: '---',
        },
        eventCenter: { emit },
        createTable,
    } as unknown as Muya;

    return { muya, emit, createTable };
}

function makeTableBlock(): Parent {
    return {
        replaceWith: vi.fn(),
        // `showTablePicker` falls back to the block's DOM node when the cursor
        // has no coords (the happy-dom test env has no real selection).
        domNode: document.createElement('div'),
    } as unknown as Parent;
}

describe('replaceBlockByLabel — in-editor "table" shows the grid picker (revert #4435)', () => {
    it('dispatches `muya-table-picker` with a reference + handler instead of creating a default table', () => {
        const { captured, restore } = setupCreateSpy();
        try {
            const { muya, emit, createTable } = makeTableMuya();

            replaceBlockByLabel({
                block: makeTableBlock(),
                muya,
                label: 'table',
            });

            // The picker is dispatched...
            expect(emit).toHaveBeenCalledTimes(1);
            const [event, data, reference, handler] = emit.mock.calls[0];
            expect(event).toBe('muya-table-picker');
            expect(data).toEqual({ row: -1, column: -1 });
            expect(reference).toBeTruthy();
            expect(typeof handler).toBe('function');

            // ...and NO default table block is built up-front.
            expect(captured.find(c => c.label === 'table')).toBeUndefined();
            expect(createTable).not.toHaveBeenCalled();
        }
        finally {
            restore();
        }
    });

    it('the picker handler creates a table at (row + 1) × (column + 1)', () => {
        const { muya, emit, createTable } = makeTableMuya();

        replaceBlockByLabel({
            block: makeTableBlock(),
            muya,
            label: 'table',
        });

        const handler = emit.mock.calls[0][3] as (row: number, column: number) => void;
        // The chessboard pick is zero-based, e.g. picking the 3rd row / 4th
        // column reports (2, 3) -> a 3×4 table.
        handler(2, 3);

        expect(createTable).toHaveBeenCalledTimes(1);
        // The picker always replaces its disposable trigger block.
        expect(createTable).toHaveBeenCalledWith({ rows: 3, columns: 4 }, { replace: true });
    });

    it('falls back to the block DOM node as the reference when the cursor has no coords', () => {
        const { muya, emit } = makeTableMuya();
        const block = makeTableBlock();

        replaceBlockByLabel({ block, muya, label: 'table' });

        const reference = emit.mock.calls[0][2];
        // happy-dom yields no selection coords, so `getCursorReference()` is
        // null and the fallback is the block's own DOM node.
        expect(reference).toBe((block as unknown as { domNode: HTMLElement }).domNode);
    });
});
