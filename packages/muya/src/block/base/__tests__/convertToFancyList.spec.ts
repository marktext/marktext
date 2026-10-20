// @vitest-environment happy-dom

import type { TState } from '../../../state/types';
import type Format from '../format';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../../muya';

vi.mock('../../../utils/prism/index', () => ({
    default: {},
    walkTokens: () => null,
    loadedLanguages: new Set(),
    transformAliasToOrigin: (s: string) => s,
    loadLanguage: () => Promise.resolve([]),
    search: () => [],
}));

const bootedHosts: HTMLElement[] = [];

beforeEach(() => {
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedHosts.length)
        bootedHosts.pop()!.remove();
});

function bootMuya(markdown: string, fancyLists: boolean): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown, fancyLists } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

// The block names along the last branch of the document, then its markdown,
// after typing `text` into the last paragraph of `markdown`.
function type(text: string, { fancyLists = true, markdown = 'seed\n' } = {}): [string, string] {
    const muya = bootMuya(markdown, fancyLists);
    const content = muya.editor.scrollPage!.lastContentInDescendant() as Format;
    content.text = text;
    content.checkInlineUpdate();
    muya.editor.jsonState.flush();

    const names: string[] = [];
    let states: TState[] = muya.getState();
    while (states.length) {
        const last = states[states.length - 1];
        names.push(last.name);
        states = 'children' in last && Array.isArray(last.children) ? last.children as TState[] : [];
    }

    return [names.join(' > '), muya.getMarkdown()];
}

describe('typing a fancy-list marker', () => {
    it.each([
        ['I.  x', 'I.  x\n'],
        ['A.  x', 'A.  x\n'],
        ['a. x', 'a. x\n'],
        ['i. x', 'i. x\n'],
        ['III. x', 'III. x\n'],
        ['(1) x', '(1) x\n'],
        ['(a) x', '(a) x\n'],
        ['c) x', 'c) x\n'],
        ['1) x', '1) x\n'],
        ['#. x', '#. x\n'],
        ['#) x', '#) x\n'],
        ['(#) x', '(#) x\n'],
    ])('turns `%s` into a list', (text, markdown) => {
        expect(type(text)).toEqual(['order-list > list-item > paragraph', markdown]);
    });

    it.each(['B. Russell won', 'C. elegans worms', 'V. Five', 'I. x', 'para\n(a) x', '#.x'])('keeps `%s` as text', (text) => {
        expect(type(text)).toEqual(['paragraph', `${text}\n`]);
    });

    it('opens the list once the second space after `I.` is typed', () => {
        expect(type('I. ')[0]).toBe('paragraph');
        expect(type('I.  ')[0]).toBe('order-list > list-item > paragraph');
    });

    it('keeps the style for a task item', () => {
        expect(type('(b) [ ] foo')).toEqual(['task-list > task-list-item > paragraph', '(b) [ ] foo\n']);
    });

    it('nests only a list that starts at one inside a list item', () => {
        const markdown = '- one\n\n  two\n';
        expect(type('a. y', { markdown })).toEqual([
            'bullet-list > list-item > order-list > list-item > paragraph',
            '- one\n\n  a. y\n',
        ]);
        expect(type('b. y', { markdown })).toEqual(['bullet-list > list-item > paragraph', '- one\n\n  b. y\n']);
    });

    it('keeps fancy markers as text with the option off', () => {
        expect(type('I.  x', { fancyLists: false })).toEqual(['paragraph', 'I.  x\n']);
        expect(type('(a) x', { fancyLists: false })).toEqual(['paragraph', '(a) x\n']);
        expect(type('a. x', { fancyLists: false })).toEqual(['paragraph', 'a. x\n']);
        expect(type('#. x', { fancyLists: false })).toEqual(['paragraph', '#. x\n']);
        expect(type('1) x', { fancyLists: false })).toEqual(['order-list > list-item > paragraph', '1) x\n']);
    });
});
