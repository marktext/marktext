// @vitest-environment happy-dom

import type { Muya as MuyaType } from '../../../../muya';
import type Content from '../../../base/content';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../../../muya';

// Typing `>>>` alone on a line and pressing Enter opens a GitLab fenced
// blockquote, but only while the `multilineBlockquote` option is on.

const bootedHosts: HTMLElement[] = [];

beforeEach(() => {
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedHosts.length)
        bootedHosts.pop()!.remove();
    document.getSelection()?.removeAllRanges();
});

function bootMuya(markdown: string, multilineBlockquote: boolean): MuyaType {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown, multilineBlockquote } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

function firstContent(muya: MuyaType): Content {
    return muya.editor.scrollPage!.firstContentInDescendant() as Content;
}

function typeAndEnter(muya: MuyaType, content: Content, text: string): void {
    muya.editor.activeContentBlock = content;
    content.text = text;
    content.update();
    content.setCursor(text.length, text.length, true);
    content.enterHandler({
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        shiftKey: false,
        key: 'Enter',
    } as unknown as KeyboardEvent);
}

function flush(): Promise<void> {
    return new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
}

describe('enter on `>>>` — opens a fenced blockquote', () => {
    it('converts the paragraph when multilineBlockquote is on', async () => {
        const muya = bootMuya('', true);
        typeAndEnter(muya, firstContent(muya), '>>>');
        await flush();

        const states = muya.getState();
        expect(states[0].name).toBe('block-quote');
        expect(states[0]).toMatchObject({ meta: { style: 'fenced' } });
        expect(muya.getMarkdown()).toBe('>>>\n\n>>>\n');
    });

    it('leaves `>>>` as a plain paragraph when the option is off', async () => {
        const muya = bootMuya('', false);
        typeAndEnter(muya, firstContent(muya), '>>>');
        await flush();

        expect(muya.getState()[0].name).toBe('paragraph');
    });
});
