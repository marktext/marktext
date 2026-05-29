// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { getLinkInfo } from '../getLinkInfo';

// Regression tests for marktext commit cb25b3d4 (#1415):
// "Feat: link tool support html tag:a and reference link".
// The renderer side of the port is already in place — `link.ts`,
// `referenceLink.ts`, and `htmlTag.ts` all emit dataset.{start,end,raw}
// on the rendered link wrapper. PR-11b builds the *missing emitter*:
// a `mouseover` handler that extracts link info from the hovered
// element and dispatches `muya-link-tools`.
//
// `getLinkInfo` is the pure extraction step — given a DOM element, it
// produces the `linkInfo` payload that LinkTools.selectItem will later
// hand back to `contentState.unlink` or `options.jumpClick`.

function makeEl(tag: 'a' | 'span', dataset: Record<string, string>, attrs: Record<string, string> = {}, props: Record<string, string> = {}): HTMLElement {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(dataset))
        el.dataset[k] = v;
    for (const [k, v] of Object.entries(attrs))
        el.setAttribute(k, v);
    // Set ad-hoc DOM properties (e.g. `href` on a <span>) that aren't on
    // the static HTMLElement type. The structural cast captures that
    // intent without spreading `any` through the helper.
    for (const [k, v] of Object.entries(props))
        (el as unknown as Record<string, string>)[k] = v;
    return el;
}

describe('getLinkInfo — markdown `[text](href)` (rendered as span.mu-link)', () => {
    it('extracts href from the snabbdom-set DOM property', () => {
        const el = makeEl(
            'span',
            { start: '0', end: '23', raw: '[hello](https://x.com)' },
            {},
            { href: 'https://x.com' },
        );
        const info = getLinkInfo(el);
        expect(info).not.toBeNull();
        expect(info!.href).toBe('https://x.com');
        expect(info!.raw).toBe('[hello](https://x.com)');
        expect(info!.range).toEqual({ start: 0, end: 23 });
    });
});

describe('getLinkInfo — reference link (rendered as a.mu-reference-link)', () => {
    it('extracts href from the rendered <a> attribute', () => {
        const el = makeEl(
            'a',
            { start: '5', end: '17', raw: '[foo][bar]' },
            { href: 'https://example.com' },
        );
        const info = getLinkInfo(el);
        expect(info).not.toBeNull();
        expect(info!.href).toBe('https://example.com');
        expect(info!.raw).toBe('[foo][bar]');
        expect(info!.range).toEqual({ start: 5, end: 17 });
    });

    it('returns null href for a shortcut ref link with no resolved label', () => {
        // referenceLink renderer drops props.href when the label isn't defined,
        // and renders as <span.mu-reference-link> with no href attribute.
        const el = makeEl(
            'span',
            { start: '0', end: '10', raw: '[foo][bar]' },
        );
        const info = getLinkInfo(el);
        // We still extract raw/range — but href is empty.
        expect(info).not.toBeNull();
        expect(info!.href).toBeNull();
        expect(info!.raw).toBe('[foo][bar]');
    });
});

describe('getLinkInfo — html_tag <a href=…>', () => {
    it('extracts href from the rendered <a> attribute', () => {
        const el = makeEl(
            'a',
            { start: '0', end: '32', raw: '<a href="https://x.com">x</a>' },
            { href: 'https://x.com' },
        );
        const info = getLinkInfo(el);
        expect(info).not.toBeNull();
        expect(info!.href).toBe('https://x.com');
        expect(info!.raw).toBe('<a href="https://x.com">x</a>');
    });
});

describe('getLinkInfo — guards', () => {
    it('returns null when the element has no data-raw (not a recognized link rendering)', () => {
        const el = document.createElement('span');
        expect(getLinkInfo(el)).toBeNull();
    });

    it('returns null for the no-text-link variant (intentionally not a popover target)', () => {
        // link.ts renders `[](url)` as <a class="mu-no-text-link"> with NO data-raw,
        // because the URL is the visible text and clicking opens it natively. We
        // exclude it from popover detection so we keep that behaviour.
        const el = makeEl('a', {}, { href: 'https://x.com' });
        expect(getLinkInfo(el)).toBeNull();
    });

    it('handles missing start/end gracefully (range becomes null)', () => {
        const el = makeEl(
            'a',
            { raw: '<a href="https://x.com">x</a>' },
            { href: 'https://x.com' },
        );
        const info = getLinkInfo(el);
        expect(info).not.toBeNull();
        expect(info!.range).toBeNull();
    });

    // Copilot review #4 on PR #226: `Number(startStr)` produces NaN when
    // `data-start`/`data-end` are present but non-numeric (e.g. empty string,
    // garbage). Consumers should never see `{ start: NaN, end: NaN }` —
    // fall back to a null range instead.
    it.each([
        ['empty string', '', '10'],
        ['non-numeric data-start', 'abc', '10'],
        ['non-numeric data-end', '0', 'xyz'],
        ['both non-numeric', 'a', 'b'],
    ])('returns range=null when data-start/data-end is %s', (_label, start, end) => {
        const el = makeEl(
            'a',
            { raw: '<a href="https://x.com">x</a>', start, end },
            { href: 'https://x.com' },
        );
        const info = getLinkInfo(el);
        expect(info).not.toBeNull();
        expect(info!.range).toBeNull();
    });
});
