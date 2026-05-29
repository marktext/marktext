// @vitest-environment happy-dom
import type Parent from '../../../block/base/parent';
import type { IConstructor } from '../../../block/types';
import type { Muya } from '../../../index';
import { describe, expect, it, vi } from 'vitest';
import { ScrollPage } from '../../../block/scrollPage';
import { replaceBlockByLabel } from '../config';

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
