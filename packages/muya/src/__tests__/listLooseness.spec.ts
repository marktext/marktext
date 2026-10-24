// @vitest-environment happy-dom
import type Format from '../block/base/format';
import type Parent from '../block/base/parent';
import type TaskListCheckbox from '../block/gfm/taskListCheckbox';
import type { IBulletListState, IOrderListState, ITaskListState } from '../state/types';
import * as json1 from 'ot-json1';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../muya';
import { SelectionCaretType, SelectionDirection } from '../selection/types';
import { asDoc } from '../state';
import { MarkdownToState } from '../state/markdownToState';
import ExportMarkdown from '../state/stateToMarkdown';
import { ChangeSource } from '../types';

type TList = IBulletListState | IOrderListState | ITaskListState;
const instances: Muya[] = [];

beforeEach(() => {
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    for (const muya of instances.splice(0)) {
        muya.destroy();
        muya.domNode.remove();
    }
    document.getSelection()?.removeAllRanges();
    vi.restoreAllMocks();
});

function boot(markdown: string, preferLooseListItem = false) {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown, preferLooseListItem });
    instances.push(muya);
    muya.init();
    return muya;
}

function expectLoose(muya: Muya, loose: boolean) {
    expect((muya.getState()[0] as TList).meta.loose).toBe(loose);
    expect(muya.domNode.querySelector('ul, ol')!.classList.contains('mu-tight-list')).toBe(!loose);
    const reopened = new MarkdownToState().generate(muya.getMarkdown());
    expect((reopened[0] as TList).meta.loose).toBe(loose);
}

function parentAt(muya: Muya, path: (string | number)[]): Parent {
    const block = muya.editor.scrollPage!.queryBlock(path);
    if (!block?.isParent())
        throw new Error('Expected a parent block');
    return block;
}

describe('list looseness across editing and history', () => {
    it('does not export or reparse a nested task list when a checkbox is toggled', () => {
        const muya = boot('- [ ] a\n  - nested\n- [ ] b\n');
        const parse = vi.spyOn(MarkdownToState.prototype, 'generate');
        const serialize = vi.spyOn(ExportMarkdown.prototype, 'generate');
        const checkbox = parentAt(muya, [0, 'children', 1]).attachments.head as TaskListCheckbox;
        checkbox.update(true, ChangeSource.User);
        muya.flush();
        expect((muya.getState()[0] as ITaskListState).children[1].meta.checked).toBe(true);
        expect(parse).not.toHaveBeenCalled();
        expect(serialize).not.toHaveBeenCalled();
        expectLoose(muya, false);
        muya.undo();
        expect((muya.getState()[0] as ITaskListState).children[1].meta.checked).toBe(false);
        expect(parentAt(muya, [0, 'children', 1]).getState()).toEqual((muya.getState()[0] as ITaskListState).children[1]);
        expect((checkbox.domNode as HTMLInputElement).checked).toBe(false);
        muya.redo();
        expect((checkbox.domNode as HTMLInputElement).checked).toBe(true);
    });

    it.each([
        '- a\n- c\n',
        '1. a\n2. c\n',
        '- [ ] a\n- [x] c\n',
        '1. [ ] a\n2. [x] c\n',
    ])('inserts a paragraph and restores tightness with one undo: %s', (markdown) => {
        const muya = boot(markdown);
        const before = muya.getState();
        muya.editor.scrollPage!.firstContentInDescendant()!.setCursor(1, 1, true);
        muya.insertParagraph('after', 'b');
        muya.flush();

        expectLoose(muya, true);
        const after = muya.getState();
        muya.undo();
        expect(muya.getState()).toEqual(before);
        expectLoose(muya, false);
        muya.redo();
        expect(muya.getState()).toEqual(after);
        expectLoose(muya, true);
    });

    it('normal Enter stays tight, while joining items into two paragraphs becomes loose', () => {
        const muya = boot('- a\n- c\n');
        const first = muya.editor.scrollPage!.firstContentInDescendant()!;
        first.setCursor(1, 1, true);
        first.enterHandler(new KeyboardEvent('keydown', { key: 'Enter' }));
        muya.flush();
        expectLoose(muya, false);
        muya.editor.history.cutoff();

        const empty = muya.editor.selection.anchorBlock!;
        empty.backspaceHandler(new KeyboardEvent('keydown', { key: 'Backspace' }));
        const second = muya.editor.selection.anchorBlock!;
        second.text = 'b';
        muya.flush();
        expectLoose(muya, true);
        muya.undo();
        expectLoose(muya, false);
        muya.redo();
        expectLoose(muya, true);
    });

    it('rechecks a new paragraph when typing starts in a later transaction', () => {
        const muya = boot('- a\n- c\n');
        parentAt(muya, [0, 'children', 1]).firstContentInDescendant()!.setCursor(1, 1, true);
        muya.insertParagraph('after');
        muya.flush();
        expectLoose(muya, false);
        const beforeTyping = muya.getState();
        muya.editor.history.cutoff();
        const second = parentAt(muya, [0, 'children', 1, 'children', 1]).firstContentInDescendant()!;
        second.text = 'b';
        muya.flush();
        expectLoose(muya, true);
        muya.undo();
        expect(muya.getState()).toEqual(beforeTyping);
        expectLoose(muya, false);
        muya.redo();
        expectLoose(muya, true);
    });

    it('normalizes an API operation and includes its metadata in the same history entry', () => {
        const muya = boot('- a\n- c\n');
        const before = muya.getState();
        muya.editor.updateContents(
            json1.insertOp([0, 'children', 0, 'children', 1], asDoc({ name: 'paragraph', text: 'b' })),
            null,
            ChangeSource.User,
        );
        expectLoose(muya, true);
        muya.undo();
        expect(muya.getState()).toEqual(before);
        expectLoose(muya, false);
        muya.redo();
        expectLoose(muya, true);
    });

    it('keeps a fenced code insertion tight', () => {
        const muya = boot('- a\n- c\n');
        muya.editor.updateContents(
            json1.insertOp([0, 'children', 0, 'children', 1], asDoc({
                name: 'code-block',
                meta: { type: 'fenced', lang: '' },
                text: 'x',
            })),
            null,
            ChangeSource.User,
        );
        expectLoose(muya, false);
    });

    it.each([
        '- a\n- [ ] task\n- end\n',
        '1. a\n2. [ ] task\n3. end\n',
    ])('promotes every run of a mixed plain and task list: %s', (markdown) => {
        const muya = boot(markdown);
        const before = muya.getState();
        muya.editor.scrollPage!.firstContentInDescendant()!.setCursor(1, 1, true);
        muya.insertParagraph('after', 'b');
        muya.flush();
        expect(muya.getState().map(state => (state as TList).meta.loose)).toEqual([true, true, true]);
        expect(muya.domNode.querySelectorAll('.mu-tight-list')).toHaveLength(0);
        muya.undo();
        expect(muya.getState()).toEqual(before);
        expect(muya.domNode.querySelectorAll('.mu-tight-list')).toHaveLength(3);
        muya.redo();
        expect(muya.getState().map(state => (state as TList).meta.loose)).toEqual([true, true, true]);
    });

    it('updates newly adjacent logical lists when their separating paragraph is removed', () => {
        const muya = boot('- a\n\n- b\n\nseparator\n\n- c\n- d\n');
        const before = muya.getState();
        muya.editor.updateContents(json1.removeOp([1]), null, ChangeSource.User);
        expect(muya.getState().map(state => (state as TList).meta.loose)).toEqual([true, true]);
        muya.undo();
        expect(muya.getState()).toEqual(before);
        expect(muya.domNode.querySelectorAll('.mu-tight-list')).toHaveLength(1);
    });

    it('reconciles surrounding lists when typing converts a paragraph to a loose list (#831)', () => {
        const muya = boot('- a\n- b\n\n-zar\n\n- c\n- d\n', true);
        const before = muya.getState();
        const content = parentAt(muya, [1]).firstContentInDescendant()! as Format;
        content.setCursor(1, 1, true);
        content.text = '- zar';
        content.checkInlineUpdate();
        muya.flush();
        expect(muya.getState().every(state => (state as TList).meta.loose)).toBe(true);
        expect(muya.domNode.querySelectorAll('.mu-tight-list')).toHaveLength(0);
        expect((new MarkdownToState().generate(muya.getMarkdown())[0] as TList).meta.loose).toBe(true);
        muya.undo();
        expect(muya.getState()).toEqual(before);
    });

    it.each([
        ['- a\n- b\n- c\n', false],
        ['- a\n\n- b\n\n- c\n', true],
        ['1. a\n2. b\n3. c\n', false],
        ['1. a\n\n2. b\n\n3. c\n', true],
    ] as const)('inherits existing spacing when converting an item to a task: %s', (markdown, loose) => {
        const muya = boot(markdown, !loose);
        const before = muya.getState();
        const content = parentAt(muya, [0, 'children', 1]).firstContentInDescendant()! as Format;
        content.setCursor(1, 1, true);
        content.text = '[ ] b';
        content.checkInlineUpdate();
        muya.flush();
        const states = muya.getState();
        expect(states.map(state => (state as TList).meta.loose)).toEqual([loose, loose, loose]);
        const reopened = new MarkdownToState().generate(muya.getMarkdown());
        const spacing = (list: TList) => ({ name: list.name, loose: list.meta.loose });
        expect((reopened as TList[]).map(spacing)).toEqual((states as TList[]).map(spacing));
        expect(muya.domNode.querySelectorAll('.mu-tight-list')).toHaveLength(loose ? 0 : 3);
        muya.undo();
        expect(muya.getState()).toEqual(before);
    });

    it('keeps lists with different markers independent', () => {
        const muya = boot('- a\n- c\n\n* other\n* end\n');
        muya.editor.scrollPage!.firstContentInDescendant()!.setCursor(1, 1, true);
        muya.insertParagraph('after', 'b');
        muya.flush();
        expect(muya.getState().map(state => (state as TList).meta.loose)).toEqual([true, false]);
        expect(new MarkdownToState().generate(muya.getMarkdown())).toEqual(muya.getState());
    });

    it('does not promote an outer list when only its nested list needs loose spacing', () => {
        const muya = boot('- outer\n  - a\n  - c\n- end\n');
        const nested = parentAt(muya, [0, 'children', 0, 'children', 1]);
        nested.firstContentInDescendant()!.setCursor(1, 1, true);
        muya.insertParagraph('after', 'b');
        muya.flush();
        const outer = muya.getState()[0] as TList;
        const inner = outer.children[0].children[1] as TList;
        expect(outer.meta.loose).toBe(false);
        expect(inner.meta.loose).toBe(true);
        expect(new MarkdownToState().generate(muya.getMarkdown())).toEqual(muya.getState());
    });

    it.each([
        ['- a\n\n- c\n', true],
        ['- a\n  ```\n  x\n  ```\n- c\n', false],
    ] as const)('preserves spacing without parsing ordinary text edits: %s', (markdown, loose) => {
        const muya = boot(markdown);
        const parse = vi.spyOn(MarkdownToState.prototype, 'generate');
        muya.editor.scrollPage!.firstContentInDescendant()!.text = 'changed';
        muya.flush();
        expect(parse).not.toHaveBeenCalled();
        expectLoose(muya, loose);
    });

    it('does not let the menu force an unrepresentable tight list', () => {
        const muya = boot('- a\n\n  b\n\n- c\n');
        muya.editor.scrollPage!.firstContentInDescendant()!.setCursor(1, 1, true);
        muya.updateParagraph('loose-list-item');
        muya.flush();
        expectLoose(muya, true);
    });

    it('applies normalization only after a complete batch of moves', () => {
        const muya = boot('- a\n- c\n');
        const first = parentAt(muya, [0, 'children', 0]);
        const block = parentAt(muya, [0, 'children', 1, 'children', 0]).clone();
        first.append(block, ChangeSource.User);
        block.remove();
        muya.flush();
        expectLoose(muya, false);
    });

    it('toggles every run of a mixed logical list through the menu', () => {
        const muya = boot('- a\n\n- [ ] task\n\n- end\n');
        const before = muya.getState();
        muya.editor.scrollPage!.firstContentInDescendant()!.setCursor(1, 1, true);
        muya.updateParagraph('loose-list-item');
        muya.flush();
        expect(muya.getState().map(state => (state as TList).meta.loose)).toEqual([false, false, false]);
        expect(muya.getMarkdown()).toBe('- a\n- [ ] task\n- end\n');
        muya.undo();
        expect(muya.getState()).toEqual(before);
        expect(muya.domNode.querySelectorAll('.mu-tight-list')).toHaveLength(0);
        muya.redo();
        expect(muya.domNode.querySelectorAll('.mu-tight-list')).toHaveLength(3);
    });

    it('reconciles looseness after pasting a loose list into a tight list', async () => {
        const muya = boot('- a\n- b\n- c\n');
        const before = muya.getState();
        const block = parentAt(muya, [0, 'children', 1]).firstContentInDescendant()!;
        block.setCursor(1, 1, true);
        const path = block.path;
        const selection = vi.spyOn(muya.editor.selection, 'getSelection').mockImplementation(() => ({
            anchor: { offset: 1, block, path },
            focus: { offset: 1, block, path },
            isCollapsed: true,
            isSelectionInSameBlock: true,
            direction: SelectionDirection.FORWARD,
            type: SelectionCaretType.RANGE,
        }));
        const event = {
            preventDefault() {},
            stopPropagation() {},
            clipboardData: { getData: () => '', files: [], items: [] },
        } as unknown as ClipboardEvent;
        await muya.editor.clipboard.pasteHandler(event, '- d\n\n- e\n', '');
        selection.mockRestore();
        muya.flush();
        const states = muya.getState();
        expect(muya.getMarkdown()).toContain('bd');
        expect(muya.getMarkdown()).toContain('e');
        const reopened = new MarkdownToState().generate(muya.getMarkdown());
        expect(reopened).toEqual(states);
        const loose = (states[0] as TList).meta.loose;
        for (const list of states as TList[])
            expect(list.meta.loose).toBe(loose);
        expect(muya.domNode.querySelectorAll('.mu-tight-list')).toHaveLength(loose ? 0 : states.length);
        muya.undo();
        expect(muya.getState()).toEqual(before);
    });

    it('rechecks boundaries when editing HTML changes its termination rule', () => {
        const muya = boot('- a\n  <!-- x -->\n  body\n- c\n');
        const before = muya.getState();
        const html = muya.editor.scrollPage!.queryBlock([0, 'children', 0, 'children', 1, 'text'])!;
        if (!html.isContent())
            throw new Error('Expected HTML content');
        html.text = '<div>x</div>';
        muya.flush();
        expectLoose(muya, true);
        muya.undo();
        expect(muya.getState()).toEqual(before);
        expectLoose(muya, false);
    });
});
