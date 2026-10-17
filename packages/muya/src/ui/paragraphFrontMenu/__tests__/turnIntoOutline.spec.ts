// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import outlineListIcon from '../../../assets/icons/outline_list/2.png';
import { Muya } from '../../../muya';
import { canTurnIntoMenu } from '../config';
import { ParagraphFrontMenu } from '../index';

const bootedHosts: HTMLElement[] = [];

beforeEach(() => {
    window.MUYA_VERSION = 'test';
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
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

function outlineEntry(fancyLists: boolean) {
    const muya = bootMuya('Introduction\n', fancyLists);
    return canTurnIntoMenu(muya.editor.scrollPage!.firstContentInDescendant()!.parent!).find(item => item.label === 'outline-list');
}

describe('paragraph front menu: Turn Into > Outline', () => {
    it('is offered on a paragraph only while fancy lists are on', () => {
        expect(outlineEntry(false)).toBeUndefined();
        expect(outlineEntry(true)).toMatchObject({ title: 'Outline', icon: outlineListIcon });
    });

    it('turns the paragraph into a list starting at I.', () => {
        const muya = bootMuya('Introduction\n', true);
        const menu = new ParagraphFrontMenu(muya);
        muya.eventCenter.emit('muya-front-menu', { reference: muya.domNode, block: muya.editor.scrollPage!.firstChild });
        menu.selectItem(new Event('click'), { label: 'outline-list' });
        muya.editor.jsonState.flush();

        expect(muya.getMarkdown()).toBe('I.  Introduction\n');
    });
});
