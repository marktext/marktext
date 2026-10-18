// @vitest-environment happy-dom

import type Format from '../format';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../../muya';

const bootedHosts: HTMLElement[] = [];

beforeEach(() => {
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedHosts.length) bootedHosts.pop()!.remove();
    document.getSelection()?.removeAllRanges();
});

function bootMuya(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

// happy-dom's `Selection` does not track range offsets, so stub `getCursor` to
// run the real text surgery against the intended range.
function selectInFirstBlock(muya: Muya, start: number, end: number): Format {
    const content = muya.editor.scrollPage!.firstContentInDescendant() as unknown as Format;
    muya.editor.activeContentBlock = content as never;
    content.setCursor(start, start, true);
    stubCursor(content, start, end);
    return content;
}

function stubCursor(content: Format, start: number, end: number): void {
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
}

const RED_OPEN = '<span style="color:#e64340">';
const BLUE_OPEN = '<span style="color:#3370ff">';
const BG_OPEN = '<span style="background-color:#fde2e2">';

describe('format.formatColor()', () => {
    it('wraps a plain run in a colour span', () => {
        const content = selectInFirstBlock(bootMuya('hello\n'), 0, 5);
        content.formatColor('color', '#e64340');
        expect(content.text).toBe(`${RED_OPEN}hello</span>`);
    });

    it('wraps a plain run in a background-colour span', () => {
        const content = selectInFirstBlock(bootMuya('hello\n'), 0, 5);
        content.formatColor('bg_color', '#fde2e2');
        expect(content.text).toBe(`${BG_OPEN}hello</span>`);
    });

    it('toggles the same colour back to the default on a second pick', () => {
        const source = `${RED_OPEN}hello</span>\n`;
        const content = selectInFirstBlock(bootMuya(source), RED_OPEN.length, RED_OPEN.length + 5);
        content.formatColor('color', '#e64340');
        expect(content.text).toBe('hello');
    });

    it('replaces a different colour without a toggle-off round trip', () => {
        const source = `${RED_OPEN}hello</span>\n`;
        const content = selectInFirstBlock(bootMuya(source), RED_OPEN.length, RED_OPEN.length + 5);
        content.formatColor('color', '#3370ff');
        expect(content.text).toBe(`${BLUE_OPEN}hello</span>`);
    });

    it('merges text and background colour into one span', () => {
        const source = `${BG_OPEN}hello</span>\n`;
        const content = selectInFirstBlock(bootMuya(source), BG_OPEN.length, BG_OPEN.length + 5);
        content.formatColor('color', '#e64340');
        expect(content.text).toBe(
            '<span style="color:#e64340;background-color:#fde2e2">hello</span>',
        );
    });

    it('keeps the outside pieces when recolouring a sub-range', () => {
        const source = `${RED_OPEN}hello</span>\n`;
        const content = selectInFirstBlock(bootMuya(source), RED_OPEN.length, RED_OPEN.length + 3);
        content.formatColor('color', '#3370ff');
        expect(content.text).toBe(`${BLUE_OPEN}hel</span>${RED_OPEN}lo</span>`);
    });

    it('clears the property with a null value', () => {
        const source = `${RED_OPEN}hello</span>\n`;
        const content = selectInFirstBlock(bootMuya(source), RED_OPEN.length, RED_OPEN.length + 5);
        content.formatColor('color', null);
        expect(content.text).toBe('hello');
    });

    it('leaves a foreign styled span untracked rather than rewriting it', () => {
        const source = '<span style="font-weight:700">hello</span>\n';
        const content = selectInFirstBlock(bootMuya(source), 0, source.trimEnd().length);
        content.formatColor('color', '#e64340');
        expect(content.text).toBe(
            `<span style="color:#e64340">${source.trimEnd()}</span>`,
        );
    });

    it('is removed by the Eliminate path (`format("clear")`)', () => {
        // Regression: clearFormat sizes markers via getOffset, which previously
        // threw on a colour span (tag 'span' missing from FORMAT_TAG_MAP).
        const source = `${RED_OPEN}hello</span>\n`;
        const content = selectInFirstBlock(bootMuya(source), RED_OPEN.length, RED_OPEN.length + 5);
        content.format('clear');
        expect(content.text).toBe('hello');
    });

    it('keeps the run selected when an edge lands on a span boundary', () => {
        // Regression: the selection end sat exactly on the span's contentStart,
        // so no emitted chunk started/ended there and the pre-edit end offset
        // was reused — pointing inside the regenerated `<span …>` markup.
        const source = `ab${RED_OPEN}cd</span>e`;
        const content = selectInFirstBlock(bootMuya(source), 0, 2 + RED_OPEN.length);
        const setCursor = vi.spyOn(content, 'setCursor');

        content.formatColor('bg_color', '#fde2e2');

        const bgOpen = '<span style="background-color:#fde2e2">';
        expect(content.text).toBe(`${bgOpen}ab</span>${RED_OPEN}cd</span>e`);
        expect(setCursor).toHaveBeenLastCalledWith(
            bgOpen.length,
            bgOpen.length + 2,
            true,
        );
    });

    it('still recolours the run on the click after an edge-boundary pick', () => {
        const source = `ab${RED_OPEN}cd</span>e`;
        const content = selectInFirstBlock(bootMuya(source), 0, 2 + RED_OPEN.length);
        const setCursor = vi.spyOn(content, 'setCursor');

        content.formatColor('bg_color', '#fde2e2');
        const [start, end] = setCursor.mock.calls.at(-1)! as [number, number];
        stubCursor(content, start, end);
        content.formatColor('color', '#3370ff');

        expect(content.text).toContain('color:#3370ff');
    });
});
