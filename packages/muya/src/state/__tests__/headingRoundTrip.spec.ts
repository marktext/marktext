import type Format from '../../block/base/format';
// @vitest-environment happy-dom
import type Parent from '../../block/base/parent';
import type { TState } from '../types';
import * as json1 from 'ot-json1';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../muya';
import { ChangeSource } from '../../types';
import { splitAtxHeading } from '../headings';
import { asDoc, asState } from '../index';
import { MarkdownToState } from '../markdownToState';
import ExportMarkdown from '../stateToMarkdown';

vi.mock('../../utils/prism/index', () => ({
    default: {},
    walkTokens: () => null,
    loadedLanguages: new Set(),
    transformAliasToOrigin: (languages: string[]) => languages,
    loadLanguage: () => Promise.resolve([]),
    search: () => [],
}));

const parser = new MarkdownToState({ frontMatter: false });
const printer = new ExportMarkdown();
const editors: Muya[] = [];

afterEach(() => {
    editors.splice(0).forEach(editor => editor.destroy());
    document.getSelection()?.removeAllRanges();
    delete (window as Partial<Window>).MUYA_VERSION;
});

function boot(markdown: string): Muya {
    window.MUYA_VERSION = 'test';
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown, frontMatter: false });
    muya.init();
    editors.push(muya);
    return muya;
}

function assertTree(muya: Muya) {
    const states: TState[] = [];
    muya.editor.scrollPage!.forEach(block => states.push((block as Parent).getState()));
    expect(states).toEqual(muya.getState());
}

describe('heading source round trips', () => {
    it.each([
        '#\n',
        '# \t\n',
        '## #\n',
        '##   title  ###  \n',
        '  ###\ttitle\t##\t\n',
        '# body#\n',
        '# body \\#\n',
        '# title # #\n',
        '#\u00A0title\n',
        '  Title  \n  ========  \n',
        'first  \nsecond\n---  \n',
        '  first\n second\n  =====\n',
    ])('keeps the complete heading body: %j', (source) => {
        const state = parser.generate(source);
        expect(state).toHaveLength(1);
        expect(state[0].name).toMatch(/heading$/);
        expect(printer.generate(state)).toBe(source);
    });

    it('owns the entire ATX line in text without a second source form', () => {
        expect(parser.generate('  ##   title  ###  \n')).toEqual([{
            name: 'atx-heading',
            meta: { level: 2 },
            text: '  ##   title  ###  ',
        }]);
    });

    it('owns Setext body prefixes in text and only the underline in syntax', () => {
        expect(parser.generate('  first  \n second\n  ========  \n')).toEqual([{
            name: 'setext-heading',
            meta: { level: 1 },
            text: '  first  \n second',
            syntax: { underline: '  ========  ' },
        }]);
    });

    it.each([
        ['  ##\t title rest  ####  ', 11, { head: '  ##\t title', tail: ' rest', suffix: '  ####  ' }],
        ['# title # #', 7, { head: '# title', tail: ' #', suffix: ' #' }],
        ['# title \\#', 7, { head: '# title', tail: ' \\#', suffix: '' }],
    ])('separates only actual closing syntax during a structural edit: %j', (text, offset, expected) => {
        expect(splitAtxHeading(text, offset, offset)).toEqual(expected);
    });

    it.each([
        ['##   title  ###  \n', '##   changed  ###  \n'],
        ['  title  \n  ========  \n', '  changed  \n  ========  \n'],
    ])('edits only the body and restores the original form through history: %j', (source, expected) => {
        const muya = boot(source);
        muya.transact(() => {
            const content = muya.editor.scrollPage!.firstContentInDescendant()!;
            content.text = content.text.replace('title', 'changed');
            content.update();
        });
        expect(muya.getMarkdown()).toBe(expected);
        expect(parser.generate(expected)[0]).toEqual(muya.getState()[0]);
        assertTree(muya);
        muya.undo();
        expect(muya.getMarkdown()).toBe(source);
        assertTree(muya);
        muya.redo();
        expect(muya.getMarkdown()).toBe(expected);
        assertTree(muya);
    });

    it('changes only opening hashes when changing the ATX level', () => {
        const muya = boot('  ##\t title  #### \n');
        muya.editor.scrollPage!.firstContentInDescendant()!.setCursor(7, 7, true);
        muya.updateParagraph('upgrade heading');
        expect(muya.getMarkdown()).toBe('  #\t title  #### \n');
        expect(muya.getState()[0]).toMatchObject({ meta: { level: 1 } });
        assertTree(muya);
        muya.undo();
        expect(muya.getMarkdown()).toBe('  ##\t title  #### \n');
        assertTree(muya);
    });

    it('removes both opening and closing syntax when converting ATX to a paragraph', () => {
        const muya = boot('  ##   **title**  ###  \n');
        muya.editor.scrollPage!.firstContentInDescendant()!.setCursor(10, 10, true);
        muya.updateParagraph('paragraph');
        expect(muya.getMarkdown()).toBe('**title**\n');
        assertTree(muya);
        muya.undo();
        expect(muya.getMarkdown()).toBe('  ##   **title**  ###  \n');
    });

    it.each([
        ['# title ###\n', 4, 4, 2, 2],
        ['# title  ###  \n', 4, 6, 2, 4],
        ['# title  ###  \n', 1, 12, 0, 5],
        ['# title  ###  \n', 6, 4, 4, 2],
    ])('maps conversion selection through the body rather than the removed suffix: %j', (source, start, end, expectedStart, expectedEnd) => {
        const muya = boot(source);
        muya.editor.scrollPage!.firstContentInDescendant()!.setCursor(start, end, true);
        muya.updateParagraph('paragraph');
        expect(muya.editor.selection.anchor?.offset).toBe(expectedStart);
        expect(muya.editor.selection.focus?.offset).toBe(expectedEnd);
        expect(muya.getMarkdown()).toBe('title\n');
        assertTree(muya);
    });

    it('preserves body selection when toggling off a closed heading', () => {
        const muya = boot('  ##   title  ###  \n');
        muya.editor.scrollPage!.firstContentInDescendant()!.setCursor(9, 11, true);
        muya.updateParagraph('heading 2');
        expect(muya.editor.selection.anchor?.offset).toBe(2);
        expect(muya.editor.selection.focus?.offset).toBe(4);
        expect(muya.editor.activeContentBlock?.text).toBe('title');
        assertTree(muya);
    });

    it('maps body selection across an ATX level change with retained closing syntax', () => {
        const muya = boot('  ##   title  ###  \n');
        muya.editor.scrollPage!.firstContentInDescendant()!.setCursor(9, 11, true);
        muya.updateParagraph('heading 1');
        expect(muya.editor.selection.anchor?.offset).toBe(8);
        expect(muya.editor.selection.focus?.offset).toBe(10);
        expect(muya.getMarkdown()).toBe('  #   title  ###  \n');
        assertTree(muya);
    });

    it('keeps syntax endpoints when a list conversion leaves the heading text unchanged', () => {
        const muya = boot('- ## title ###\n');
        muya.editor.scrollPage!.firstContentInDescendant()!.setCursor(1, 12, true);
        muya.updateParagraph('ul-task');
        expect(muya.editor.activeContentBlock?.text).toBe('## title ###');
        expect(muya.editor.selection.anchor?.offset).toBe(1);
        expect(muya.editor.selection.focus?.offset).toBe(12);
        assertTree(muya);
    });

    it.each([[6, 6], [6, 8]])('keeps raw selection endpoints during interactive ATX conversion: %j', (start, end) => {
        const muya = boot('seed\n');
        const content = muya.editor.scrollPage!.firstContentInDescendant()! as Format;
        muya.transact(() => {
            content.text = '#   hello ###';
            content.update();
            content.setCursor(start, end, true);
            content.checkInlineUpdate();
        });
        expect(muya.getState()[0]).toEqual({ name: 'atx-heading', meta: { level: 1 }, text: '#   hello ###' });
        expect(muya.editor.selection.anchor?.offset).toBe(start);
        expect(muya.editor.selection.focus?.offset).toBe(end);
        expect(muya.getCursorOffset()).toEqual({ anchor: { line: 0, ch: start }, focus: { line: 0, ch: end } });
        assertTree(muya);
    });

    it('keeps the typed Setext underline including indentation and trailing spaces', () => {
        const muya = boot('seed\n');
        const content = muya.editor.scrollPage!.firstContentInDescendant()! as Format;
        muya.transact(() => {
            content.text = '  title\n  =====  ';
            content.update();
            content.setCursor(content.text.length, content.text.length, true);
            content.checkInlineUpdate();
        });
        expect(muya.getMarkdown()).toBe('  title\n  =====  \n');
        assertTree(muya);
    });

    it('clones Setext syntax without sharing mutable state', () => {
        const source = '  title\n ===== \n';
        const muya = boot(source);
        const block = muya.editor.scrollPage!.firstChild as Parent;
        block.replaceWith(block.clone());
        muya.flush();
        const state = (muya.editor.scrollPage!.firstChild as Parent).getState();
        if (state.name !== 'setext-heading')
            throw new Error('Expected Setext');
        state.syntax.underline = '---';
        expect(muya.getMarkdown()).toBe(source);
        assertTree(muya);
    });

    it('projects syntax-only operations and restores them through undo', () => {
        const muya = boot('title\n===\n');
        const changed = vi.fn();
        muya.on('json-change', changed);
        muya.editor.updateContents(json1.replaceOp([0, 'syntax', 'underline'], '===', ' ========  '), null, ChangeSource.User);
        expect(muya.getMarkdown()).toBe('title\n ========  \n');
        expect(changed).toHaveBeenCalledTimes(1);
        assertTree(muya);
        muya.undo();
        expect(muya.getMarkdown()).toBe('title\n===\n');
        assertTree(muya);
    });

    it('transforms independent Setext body and underline operations', () => {
        const state = asDoc(parser.generate('title\n===\n'));
        const body = json1.editOp([0, 'text'], 'text-unicode', [5, '!']);
        const underline = json1.replaceOp([0, 'syntax', 'underline'], '===', ' ========  ');
        const left = json1.type.apply(json1.type.apply(state, body), json1.type.transform(underline, body, 'right') ?? null);
        const right = json1.type.apply(json1.type.apply(state, underline), json1.type.transform(body, underline, 'left') ?? null);
        expect(left).toEqual(right);
        expect(printer.generate(asState(left))).toBe('title!\n ========  \n');
    });

    it.each([
        ['  ##   **title**  ###  \n', 'title'],
        ['# title # #\n', 'title #'],
        ['## ###\n', ''],
        ['title #\n====\n', 'title #'],
    ])('keeps syntax out of the outline: %j', (source, expected) => {
        const muya = boot(source);
        expect(muya.getTOC()[0].content).toBe(expected);
    });
});
