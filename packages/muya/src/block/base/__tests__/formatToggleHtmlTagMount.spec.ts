// @vitest-environment jsdom

import type Format from '../format';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CLASS_NAMES } from '../../../config';
import { Muya } from '../../../muya';

// Split out from formatToggle.spec.ts: these assert that applying an html_tag
// format mounts a LIVE element into the editor DOM, which routes through
// DOMPurify. DOMPurify 3.4.8+ strips every element under happy-dom (its
// namespace hardening isn't satisfied there), so these run under jsdom — which
// matches production DOM behavior. The rest of formatToggle.spec.ts stays on
// happy-dom because its selection/picker assertions depend on happy-dom.

const bootedHosts: HTMLElement[] = [];
let originalVersion: string | undefined;
let hadVersion = false;

beforeEach(() => {
    hadVersion = 'MUYA_VERSION' in window;
    originalVersion = window.MUYA_VERSION;
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedHosts.length) {
        const host = bootedHosts.pop()!;
        host.remove();
    }
    document.getSelection()?.removeAllRanges();
    if (hadVersion)
        window.MUYA_VERSION = originalVersion as string;
    else
        delete (window as Partial<Window>).MUYA_VERSION;
});

function bootMuya(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

function selectInFirstBlock(muya: Muya, start: number, end: number): Format {
    const content = muya.editor.scrollPage!.firstContentInDescendant() as unknown as Format;
    muya.editor.activeContentBlock = content as never;
    content.setCursor(start, start, true);
    (content as unknown as { getCursor: () => unknown }).getCursor = () => ({
        start: { offset: start },
        end: { offset: end },
        anchor: { offset: start },
        focus: { offset: end },
        isCollapsed: start === end,
        isSelectionInSameBlock: true,
        direction: 'forward',
        type: start === end ? 'Caret' : 'Range',
    });
    return content;
}

describe('format.format() mounts the html_tag into the live editor DOM', () => {
    it('u: applying renders a live `<u>` element wrapping `abc`', async () => {
        const muya = bootMuya('abc\n');
        const content = selectInFirstBlock(muya, 0, 3);
        content.format('u');
        await new Promise(r => requestAnimationFrame(r));
        const u = content.domNode!.querySelector<HTMLElement>(
            `u.${CLASS_NAMES.MU_INLINE_RULE}`,
        );
        expect(u).toBeTruthy();
        expect(u!.textContent).toBe('abc');
    });

    it('mark: applying renders a live `<mark>` element wrapping `abc`', async () => {
        const muya = bootMuya('abc\n');
        const content = selectInFirstBlock(muya, 0, 3);
        content.format('mark');
        await new Promise(r => requestAnimationFrame(r));
        const mark = content.domNode!.querySelector<HTMLElement>(
            `mark.${CLASS_NAMES.MU_INLINE_RULE}`,
        );
        expect(mark).toBeTruthy();
        expect(mark!.textContent).toBe('abc');
    });
});
