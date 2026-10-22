// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya } from '../../../muya';
import { BACKGROUND_COLOR_SWATCHES, TEXT_COLOR_SWATCHES } from '../config';
import { InlineFormatToolbar } from '../index';

const bootedHosts: HTMLElement[] = [];

beforeEach(() => {
    window.MUYA_VERSION = 'test';
    if (typeof globalThis.ResizeObserver === 'undefined') {
        globalThis.ResizeObserver = class {
            observe() {}
            unobserve() {}
            disconnect() {}
        } as never;
    }
});

afterEach(() => {
    while (bootedHosts.length) bootedHosts.pop()!.remove();
});

function bootMuya(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

function emitSelectionChange(
    muya: Muya,
    formats: Array<Record<string, unknown>>,
): void {
    muya.eventCenter.emit('selection-change', {
        formats,
        isCollapsed: false,
        isSelectionInSameBlock: true,
    });
}

describe('inlineFormatToolbar colour picker', () => {
    it('renders a colour button with both swatch rows and a reset', () => {
        const toolbar = new InlineFormatToolbar(bootMuya('hello\n'));
        toolbar.status = true;
        emitSelectionChange(toolbar.muya, []);

        expect(toolbar.container!.querySelector('li.item.color')).toBeTruthy();
        expect(toolbar.container!.querySelectorAll('.mu-color-section').length).toBe(2);
        expect(
            toolbar.container!.querySelectorAll('.mu-color-swatch.text').length,
        ).toBe(TEXT_COLOR_SWATCHES.length);
        expect(
            toolbar.container!.querySelectorAll('.mu-color-swatch.bg').length,
        ).toBe(BACKGROUND_COLOR_SWATCHES.length);
        expect(toolbar.container!.querySelector('.mu-color-reset')).toBeTruthy();
    });

    it('marks both default swatches active when the selection has no colour', () => {
        const toolbar = new InlineFormatToolbar(bootMuya('hello\n'));
        toolbar.status = true;

        emitSelectionChange(toolbar.muya, [{ type: 'strong' }]);

        const activeText = toolbar.container!.querySelector(
            '.mu-color-swatch.text.active',
        )!;
        const activeBg = toolbar.container!.querySelector('.mu-color-swatch.bg.active')!;
        expect(activeText.getAttribute('data-color')).toBe('');
        expect(activeBg.getAttribute('data-color')).toBe('');
    });

    it('lights the swatches matching the selection colour', () => {
        const toolbar = new InlineFormatToolbar(bootMuya('hello\n'));
        toolbar.status = true;

        emitSelectionChange(toolbar.muya, [
            { type: 'html_tag', tag: 'span', attrs: { style: 'color:#e64340' } },
            {
                type: 'html_tag',
                tag: 'span',
                attrs: { style: 'background-color:#fde2e2' },
            },
        ]);

        const activeText = toolbar.container!.querySelector(
            '.mu-color-swatch.text.active',
        )!;
        const activeBg = toolbar.container!.querySelector('.mu-color-swatch.bg.active')!;
        expect(activeText.getAttribute('data-color')).toBe('#e64340');
        expect(activeBg.getAttribute('data-color')).toBe('#fde2e2');
    });

    it('clears the button colour when a later selection has none', () => {
        // Regression: snabbdom only clears an inline style when the key is
        // absent, so passing `undefined` left the previous colour stuck on.
        const toolbar = new InlineFormatToolbar(bootMuya('hello\n'));
        toolbar.status = true;

        emitSelectionChange(toolbar.muya, [
            {
                type: 'html_tag',
                tag: 'span',
                attrs: { style: 'color:#e64340;background-color:#fde2e2' },
            },
        ]);

        // happy-dom drops dashed inline style props, so only the tint is
        // assertable here (the background preview is covered in the e2e spec).
        const icon = () => toolbar.container!.querySelector('li.item.color i.icon')!;
        expect(icon().getAttribute('style')).toMatch(/color/);

        emitSelectionChange(toolbar.muya, [{ type: 'strong' }]);

        expect(icon().getAttribute('style') ?? '').not.toMatch(/color/);
    });
});
