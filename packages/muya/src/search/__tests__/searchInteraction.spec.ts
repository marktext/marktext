// @vitest-environment happy-dom

import type Content from '../../block/base/content';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../muya';
import { createTextSelectionState } from '../../selection/state';

let muya: Muya;

beforeEach(() => {
    window.MUYA_VERSION = 'test';
    const host = document.createElement('div');
    document.body.appendChild(host);
    muya = new Muya(host, { markdown: 'apple apricot apple\n\nbanana apple\n\nlast apple\n' });
    muya.init();
});

afterEach(() => {
    muya.destroy();
    muya.domNode.remove();
    document.getSelection()?.removeAllRanges();
});

function blocks(): Content[] {
    const result: Content[] = [];
    muya.editor.scrollPage!.depthFirstTraverse((node) => {
        if (node.isContent())
            result.push(node);
    });
    return result;
}

function activeMatch() {
    const search = muya.editor.searchModule;
    const match = search.matches[search.index];
    return { text: match.block.text, start: match.start, end: match.end };
}

describe('find interaction', () => {
    it('keeps the original search start while the query and options change', () => {
        blocks()[0].setCursor(6, 6);
        muya.search('ap', { selectHighlight: true });
        expect(activeMatch().start).toBe(6);

        muya.search('apple', { selectHighlight: true });
        expect(activeMatch().start).toBe(14);
        muya.search('ap', { selectHighlight: true, isCaseSensitive: true });
        expect(activeMatch().start).toBe(6);
    });

    it('updates the search start after an explicit editor selection change', () => {
        const [first, second] = blocks();
        first.setCursor(0, 0);
        muya.search('apple', { selectHighlight: true });
        second.setCursor(0, 0);
        muya.search('ap', { selectHighlight: true });
        expect(activeMatch()).toEqual({ text: 'banana apple', start: 7, end: 9 });
    });

    it('navigates from a manually moved caret and wraps in both directions', () => {
        const [first, second] = blocks();
        muya.search('apple', { selectHighlight: true });
        second.setCursor(0, 0);
        muya.find('next');
        expect(activeMatch().text).toBe('banana apple');
        first.setCursor(0, 0);
        muya.find('previous');
        expect(activeMatch().text).toBe('last apple');
        muya.find('next');
        expect(activeMatch()).toEqual({ text: 'apple apricot apple', start: 0, end: 5 });
    });

    it('uses document-order edges for a backward selection spanning blocks', () => {
        const [first, second] = blocks();
        muya.search('apple', { selectHighlight: true });
        const selection = createTextSelectionState(
            { block: second, path: second.path, offset: 12 },
            { block: first, path: first.path, offset: 6 },
        );
        muya.editor.selection.setSelection(selection);
        muya.find('next');
        expect(activeMatch().text).toBe('last apple');
        muya.editor.selection.setSelection(selection);
        muya.find('previous');
        expect(activeMatch()).toEqual({ text: 'apple apricot apple', start: 0, end: 5 });
    });

    it('opening or hiding highlights leaves the editor selection unchanged', () => {
        const second = blocks()[1];
        second.setCursor(2, 2);
        const selection = muya.editor.selection.getSelectionState();
        muya.search('apple');
        expect(muya.editor.selection.getSelectionState()).toEqual(selection);
        muya.setSearchVisible(false);
        expect(muya.editor.selection.getSelectionState()).toEqual(selection);
        expect(muya.editor.searchModule.value).toBe('apple');
        expect(muya.domNode.querySelectorAll('.mu-highlight, .mu-selection')).toHaveLength(0);
        muya.setSearchVisible(true);
        expect(muya.editor.selection.getSelectionState()).toEqual(selection);
    });

    it('continues the retained query while the find bar is hidden', () => {
        muya.search('apple', { selectHighlight: true });
        muya.setSearchVisible(false);
        blocks()[1].setCursor(0, 0);
        muya.find('next');
        expect(activeMatch().text).toBe('banana apple');
        expect(muya.editor.selection.getTextSelection()?.anchor.offset).toBe(7);
        expect(muya.domNode.querySelectorAll('.mu-highlight, .mu-selection')).toHaveLength(0);
    });

    it('retains the find input focus when selecting a result', () => {
        const input = document.createElement('input');
        document.body.appendChild(input);
        input.focus();
        muya.search('apple', { selectHighlight: true });
        expect(document.activeElement).toBe(input);
        muya.find('next');
        expect(document.activeElement).toBe(input);
        input.remove();
    });

    it('returns the document selection to the find input when selecting a result while reading', () => {
        muya.setReadOnly(true);
        const input = document.createElement('input');
        document.body.appendChild(input);
        input.value = 'apple';
        input.focus();
        input.setSelectionRange(2, 3);
        // Selecting a match in a non-editable view leaves focus in place, so focus() alone cannot move the caret back.
        const setSelectionRange = vi.spyOn(input, 'setSelectionRange');
        muya.search('apple', { selectHighlight: true });
        expect(document.activeElement).toBe(input);
        expect(setSelectionRange).toHaveBeenLastCalledWith(2, 3, expect.anything());
        setSelectionRange.mockClear();
        muya.find('next');
        expect(setSelectionRange).toHaveBeenLastCalledWith(2, 3, expect.anything());
        input.remove();
    });

    it('keeps the logical match when moving between external inputs collapses the DOM range', () => {
        muya.search('apple', { selectHighlight: true });
        const selected = muya.getSelectionState();
        const input = document.createElement('input');
        document.body.appendChild(input);
        input.focus();
        const paragraph = blocks()[0].domNode;
        if (!paragraph)
            throw new Error('Expected a rendered paragraph');
        document.getSelection()?.collapse(paragraph, 0);
        expect(muya.getSelectionState()).toEqual(selected);
        muya.replace('pear', { isSingle: true, isRegexp: false, fromSelection: true });
        expect(blocks()[0].text).toBe('pear apricot apple');
        input.remove();
    });

    it('keeps external focus while refreshing retained highlights', () => {
        blocks()[0].setCursor(0, 0);
        const input = document.createElement('input');
        document.body.appendChild(input);
        input.focus();
        muya.search('apple');
        expect(document.activeElement).toBe(input);
        muya.editor.searchModule.refresh();
        expect(document.activeElement).toBe(input);
        input.remove();
    });

    it('a selection-aware replacement first selects a result from the moved caret', () => {
        muya.search('apple', { selectHighlight: true });
        blocks()[1].setCursor(0, 0);
        muya.replace('pear', { isSingle: true, isRegexp: false, fromSelection: true });
        expect(blocks()[1].text).toBe('banana apple');
        expect(activeMatch().text).toBe('banana apple');
        muya.replace('pear', { isSingle: true, isRegexp: false, fromSelection: true });
        expect(blocks()[1].text).toBe('banana pear');
        expect(activeMatch().text).toBe('last apple');
    });

    it('a selection-aware replacement uses a manually selected match and wraps after the last', () => {
        muya.search('apple', { selectHighlight: true });
        blocks()[2].setCursor(5, 10);
        muya.replace('pear', { isSingle: true, isRegexp: false, fromSelection: true });
        expect(blocks()[2].text).toBe('last pear');
        expect(activeMatch()).toEqual({ text: 'apple apricot apple', start: 0, end: 5 });
    });

    it('continues after the inserted replacement instead of finding its own new matches', () => {
        muya.search('apple', { selectHighlight: true });
        muya.replace('apple apple', { isSingle: true, isRegexp: false, fromSelection: true });
        expect(activeMatch()).toEqual({ text: 'apple apple apricot apple', start: 20, end: 25 });
    });

    it('leaves a collapsed caret after replacing the only match', () => {
        muya.setContent('apple');
        muya.search('apple', { selectHighlight: true });
        muya.replace('pear', { isSingle: true, isRegexp: false, fromSelection: true });
        expect(muya.editor.searchModule.matches).toHaveLength(0);
        expect(muya.getSelectionState()).toMatchObject({ anchor: { offset: 4 }, focus: { offset: 4 } });
    });

    it('refreshes matches after editing without moving the caret', async () => {
        muya.search('apple', { selectHighlight: true });
        blocks()[1].text = 'banana pear';
        await vi.waitFor(() => expect(muya.editor.searchModule.matches).toHaveLength(3));
    });
});

describe('reading text and source ranges', () => {
    it.each([
        ['hello **world**', 'hello world', 'hello **world'],
        ['[example](https://needle.test)', 'needle', null],
        ['a$x$b', 'ab', null],
        ['a![alt](diagram.png)b', 'ab', null],
        ['A :missing: B', ':missing:', ':missing:'],
        ['a<br>b', 'ab', null],
        ['a<br>b', 'a\nb', 'a<br>b'],
        ['R&amp;D', 'RD', null],
        ['R&#38;D', 'R&D', 'R&#38;D'],
        ['A&#x1F600;B', '😀', '&#x1F600;'],
        ['A :smile: B', '😄', ':smile:'],
        ['Ruby <ruby>**字**<rt>zi</rt></ruby>', '**字**', '**字**'],
        ['Ruby <ruby>字<rt>zi</rt></ruby>', 'zi', 'zi'],
        ['Ruby <ruby>字<rt>zi</ruby>', 'zi', 'zi'],
        ['Ruby <ruby>a<!--hidden-->b<rt>c</ruby>', 'hidden', null],
        ['Ruby <ruby>R&amp;D<rt>r</ruby>', 'R&D', 'R&amp;D'],
        ['Above\n\n---\n\nBelow', '---', null],
        ['```js title=needle\nneedle\n```', 'needle', 'needle'],
    ])('maps %j looking for %j to %j', (source, query, expected) => {
        muya.setContent(source!);
        muya.setReadOnly(true);
        const { matches } = muya.search(query!, { selectHighlight: false });
        expect(matches.map(({ block, start, end }) => block.text.slice(start, end))).toEqual(expected === null ? [] : [expected]);
        if (expected !== null) {
            const [{ block, start, end }] = matches;
            block.setCursor(start, end);
            expect(muya.getSearchSelection()).toBe(query);
        }
    });

    it('matches a heading from its first authored character', () => {
        muya.setContent('# Needle');
        muya.setReadOnly(true);
        expect(muya.search('^Needle', { isRegexp: true }).matches).toHaveLength(1);
    });

    it.each(['$x$', '![alt](diagram.png)'])('keeps %s from creating regex anchors within a paragraph', (object) => {
        muya.setContent(`A${object}beta\n\nbeta control\n\ncontrol A\n\n${object}beta${object}`);
        muya.setReadOnly(true);
        const matches = (query: string) => {
            const result = muya.search(query, { isRegexp: true, isCaseSensitive: true });
            return result.matches.map(hit => hit.block.text.slice(hit.start, hit.end));
        };
        expect.soft(matches('^beta')).toEqual(['beta']);
        expect.soft(matches('A$')).toEqual(['A']);
        expect.soft(matches('^beta$')).toEqual([]);
        expect.soft(matches('^A|beta$')).toEqual(['A', 'beta']);
        expect.soft(matches('^beta|ta')).toEqual(['ta', 'beta', 'ta']);
        expect.soft(matches('A.*beta')).toEqual([]);
    });

    it('preserves escaped anchors and character classes next to a formula', () => {
        muya.setContent('A$x$`^$z`$y$B');
        muya.setReadOnly(true);
        for (const pattern of [String.raw`\^\$`, '[$^]{2}', '[^z]{2}'])
            expect(muya.search(pattern, { isRegexp: true }).matches.map(hit => hit.match)).toEqual(['^$']);
    });

    it('evaluates regular expressions on the same text that is highlighted', () => {
        muya.setContent('Hello **world**.\n\nHello world!');
        muya.setReadOnly(true);
        const { matches } = muya.search('^Hello .*world\\.$', { isRegexp: true });
        expect(matches.map(hit => hit.match)).toEqual(['Hello world.']);
        expect(muya.domNode.querySelector('strong .mu-highlight')?.textContent).toBe('world');
    });
});
