// @vitest-environment happy-dom

import type { ITaskListState } from '../../../../state/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import blockSyntaxCss from '../../../../assets/styles/blockSyntax.css?inline';
import { Muya } from '../../../../muya';

const bootedHosts: HTMLElement[] = [];

beforeEach(() => {
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedHosts.length)
        bootedHosts.pop()!.remove();
    delete (window as Partial<Window>).MUYA_VERSION;
});

function bootMuya(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, {} as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    muya.setContent(markdown);
    bootedHosts.push(muya.domNode);
    return muya;
}

describe('ordered task list rendering (#1691)', () => {
    it('renders an `<ol>` with the start number and one checkbox per item', () => {
        const muya = bootMuya('5. [x] a\n6. [ ] b\n');

        const ol = muya.domNode.querySelector('ol.mu-task-list');
        expect(ol).not.toBeNull();
        expect(ol!.getAttribute('start')).toBe('5');
        expect(muya.domNode.querySelector('ul.mu-task-list')).toBeNull();
        expect(muya.domNode.querySelectorAll('li.mu-task-list-item')).toHaveLength(2);
        expect(muya.domNode.querySelectorAll('.mu-task-list-checkbox')).toHaveLength(2);
    });

    it('round-trips the ordered meta through `getState`', () => {
        const muya = bootMuya('1. [x] a\n2. [ ] b\n');

        const state = muya.getState()[0] as ITaskListState;
        expect(state.name).toBe('task-list');
        expect(state.meta).toMatchObject({ ordered: true, start: 1, delimiter: '.' });
    });

    // A split list renders as two `<ol>`s; the plain one continues the
    // numbering rather than restarting at the marker it was written with.
    it('continues the numbering of the plain run after a task item', () => {
        const muya = bootMuya('1. [x] a\n1. b\n');

        const lists = muya.domNode.querySelectorAll('ol');
        expect(lists).toHaveLength(2);
        expect(lists[0].getAttribute('start')).toBe('1');
        expect(lists[1].getAttribute('start')).toBe('2');
    });

    it('still renders the unordered form as a `<ul>`', () => {
        const muya = bootMuya('- [x] a\n- [ ] b\n');

        expect(muya.domNode.querySelector('ul.mu-task-list')).not.toBeNull();
        expect(muya.domNode.querySelector('ol.mu-task-list')).toBeNull();
    });

    // GitHub hides a task item's marker, numbered or not.
    it('draws no list marker for an ordered task item', () => {
        expect(blockSyntaxCss).toMatch(
            /ul\.mu-task-list,\s*ol\.mu-task-list\s*\{\s*padding-inline-start:\s*30px/,
        );
        expect(blockSyntaxCss).not.toContain('counter(list-item)');
    });
});
