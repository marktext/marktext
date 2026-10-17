// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../../muya';
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

function turnFirstBlockInto(markdown: string, label: string): string {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown, fancyLists: true } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);

    const menu = new ParagraphFrontMenu(muya);
    const block = muya.editor.scrollPage!.firstChild;
    muya.eventCenter.emit('muya-front-menu', { reference: muya.domNode, block });
    const event = new Event('click');
    menu.selectItem(event, { label });
    muya.editor.jsonState.flush();

    return muya.getMarkdown();
}

describe('paragraph front menu: turning an ordered list into another list', () => {
    it('keeps the fancy-list style and delimiter', () => {
        expect(turnFirstBlockInto('(a) [ ] x\n(b) [x] y\n', 'order-list')).toBe('(a) x\n(b) y\n');
    });
});
