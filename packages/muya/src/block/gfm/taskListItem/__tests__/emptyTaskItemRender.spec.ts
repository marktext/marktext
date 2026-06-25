// @vitest-environment happy-dom

import type Content from '../../../base/content';
import type Parent from '../../../base/parent';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya } from '../../../../muya';

const bootedHosts: HTMLElement[] = [];
let originalVersion: string | undefined;
let hadVersion = false;

beforeEach(() => {
    hadVersion = 'MUYA_VERSION' in window;
    originalVersion = window.MUYA_VERSION;
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedHosts.length)
        bootedHosts.pop()!.remove();

    document.getSelection()?.removeAllRanges();
    if (hadVersion)
        window.MUYA_VERSION = originalVersion as string;
    else
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

function taskListItems(muya: Muya): Parent[] {
    const result: Parent[] = [];

    const visit = (block: Parent) => {
        if (block.blockName === 'task-list-item')
            result.push(block);

        block.children?.forEach((child) => {
            if (child.isParent())
                visit(child as Parent);
        });
    };

    visit(muya.editor.scrollPage as unknown as Parent);

    return result;
}

describe('task-list-item rendering', () => {
    it('renders empty task items with editable content blocks', () => {
        const muya = bootMuya('- [ ] a\n\n- [ ] \n- [ ] \n- [ ] \ntext\n');

        const items = taskListItems(muya);
        expect(items).toHaveLength(4);
        expect(muya.domNode.querySelectorAll('li.mu-task-list-item')).toHaveLength(4);
        expect(muya.domNode.querySelectorAll('.mu-task-list-checkbox')).toHaveLength(4);

        const contentTexts = items.map(item =>
            (item.firstContentInDescendant() as Content | null)?.text,
        );
        expect(contentTexts).toEqual(['a', '', '', 'text']);
    });
});
