// @vitest-environment happy-dom

import type Content from '../../block/base/content';
import { afterEach, describe, expect, it } from 'vitest';
import { Muya } from '../../muya';

let muya: Muya;

function setup(markdown: string) {
    window.MUYA_VERSION = 'test';
    const host = document.createElement('div');
    document.body.appendChild(host);
    muya = new Muya(host, { markdown });
    muya.init();
}

afterEach(() => {
    muya.destroy();
    muya.domNode.remove();
    document.getSelection()?.removeAllRanges();
});

function block(prefix: string): Content {
    let found: Content | undefined;
    muya.editor.scrollPage!.depthFirstTraverse((node) => {
        if (!found && node.isContent() && node.text.startsWith(prefix))
            found = node;
    });
    if (!found)
        throw new Error(`No block starts with ${prefix}`);
    return found;
}

function shown(selector: string): string[] {
    return [...muya.domNode.querySelectorAll(selector)].map(node => node.classList.contains('mu-gray') ? 'source' : 'hidden');
}

const highlights = () => muya.domNode.querySelectorAll('.mu-highlight, .mu-selection').length;

describe('editing-mode Find reveals the syntax that contains a match', () => {
    it('shows the source of every matched entity, not only the active match', () => {
        setup('Intro.\n\nR&amp;D one, R&amp;D two, and &copy;.\n');
        muya.search('&', { selectHighlight: true });
        expect(shown('.mu-rendered-character')).toEqual(['source', 'source', 'source']);
        expect(highlights()).toBe(3);
        muya.search('amp', { selectHighlight: true });
        expect(shown('.mu-rendered-character')).toEqual(['source', 'source', 'hidden']);
        expect(highlights()).toBe(2);
    });

    it('shows markers only around formatting that overlaps a match', () => {
        setup('Hello **world** and **other**\n');
        muya.search('world');
        expect(shown('.mu-remove')).toEqual(['source', 'source', 'hidden', 'hidden']);
        muya.search('Hello ');
        expect(shown('.mu-remove')).toEqual(['hidden', 'hidden', 'hidden', 'hidden']);
    });

    it('shows a link destination that contains a match', () => {
        setup('See [link](https://needle.test) here\n');
        muya.search('needle');
        const destination = muya.domNode.querySelector('.mu-link-in-bracket');
        expect(destination?.classList.contains('mu-hide')).toBe(false);
        expect(destination?.querySelector('.mu-highlight')?.textContent).toBe('needle');
    });

    it('hides the syntax again when the find bar closes', () => {
        setup('Hello **world**\n');
        muya.search('world');
        muya.setSearchVisible(false);
        expect(shown('.mu-remove')).toEqual(['hidden', 'hidden']);
    });

    it('keeps Reading Mode syntax hidden', () => {
        setup('Hello **world**\n');
        muya.setReadOnly(true);
        muya.search('world');
        expect(muya.domNode.querySelectorAll('.mu-gray')).toHaveLength(0);
        expect(highlights()).toBe(1);
    });
});

describe('renders outside Find keep its highlights', () => {
    it('keeps every highlight when the caret re-renders a block', () => {
        setup('R&amp;D one, R&amp;D two\n');
        muya.search('&');
        const paragraph = block('R&amp;D');
        // The editor re-renders without highlights when the caret enters syntax.
        paragraph.update({ start: { offset: 1 }, end: { offset: 1 }, block: paragraph });
        expect(highlights()).toBe(2);
        expect(shown('.mu-rendered-character')).toEqual(['source', 'source']);
    });

    it('drops highlights whose offsets no longer fit the edited text', () => {
        setup('needle one\n');
        muya.search('needle');
        const paragraph = block('needle');
        paragraph.text = 'changed one';
        paragraph.update();
        expect(highlights()).toBe(0);
    });
});
