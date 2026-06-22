// @vitest-environment jsdom

import type { Config } from '../dompurify';
import { describe, expect, it } from 'vitest';
import { EXPORT_DOMPURIFY_CONFIG, PREVIEW_DOMPURIFY_CONFIG } from '../../config';
import sanitize, { isValidAttribute } from '../dompurify';

// Lock the DOMPurify config to the typed contract so a regression in shape
// (e.g. ADD_ATTR being dropped or renamed) breaks at compile time, not just
// at runtime.
const EXPORT_CONFIG: Config = EXPORT_DOMPURIFY_CONFIG;

// Regression for marktext 0baf2e9e / 7de33f11 — "Fix #1390 prevent XSS attack".
//
// marktext's old inline html renderer used the raw tag name as the
// snabbdom selector, so `<embed src="javascript:…">` typed inline produced
// a real `<embed>` node in the DOM. The fix added a downgrade gate:
//
//   selector = BLOCK_TYPE6.includes(tag) || !sanitize(`<${tag}>`) ? 'span' : tag
//
// The new repo keeps this gate at
// `inlineRenderer/renderer/htmlTag.ts:80-82` and per-attribute filtering
// at `:110` via `isValidAttribute`. Both depend on DOMPurify's defaults:
// these tests lock the contracts the renderer relies on so a future
// DOMPurify upgrade or config change can't silently re-open the gap.
//
// The same commit added `data-align` to the whitelisted attributes —
// the new repo expresses that as `ADD_ATTR: ['data-align']` in
// `EXPORT_DOMPURIFY_CONFIG` (used by HTML export so pasted/saved markdown
// preserves image alignment metadata). `PREVIEW_DOMPURIFY_CONFIG` keeps
// `ALLOW_DATA_ATTR: false` because the live-editor preview re-derives
// `data-align` from block state, not from DOM attributes.

describe('marktext 0baf2e9e/7de33f11 — inline html tag XSS defenses', () => {
    describe('sanitize() downgrades dangerous tags to empty (drives the htmlTag span fallback)', () => {
        // These tables intentionally use BARE opening tags (no attrs / no close
        // tag) — that's the exact call shape `htmlTag.ts` uses:
        //   `!sanitize('<' + tag + '>')`. Adding attribute-bearing variants
        // here would assert against DOMPurify behaviour the renderer never
        // exercises and could create false failures.
        it.each([
            ['<embed>'],
            ['<object>'],
            ['<iframe>'],
        ])('strips %s', (tag) => {
            // The htmlTag renderer treats an empty result from
            // `sanitize('<' + tag + '>')` as the trigger to downgrade to `<span>`.
            expect(sanitize(tag)).toBe('');
        });

        it('preserves safe inline tags so they render with their real tag', () => {
            // `<span>` and similar safe tags must NOT trigger the downgrade
            // path; sanitize must return a non-empty string for them.
            expect(sanitize('<span>')).not.toBe('');
            expect(sanitize('<code>')).not.toBe('');
            expect(sanitize('<mark>')).not.toBe('');
        });
    });

    describe('isValidAttribute() blocks attribute-level XSS vectors (htmlTag attr loop)', () => {
        it.each([
            ['a', 'onclick', 'alert(1)'],
            ['a', 'onmouseover', 'alert(1)'],
            ['img', 'onerror', 'alert(1)'],
            ['a', 'href', 'javascript:alert(1)'],
            ['a', 'href', 'vbscript:alert(1)'],
        ])('rejects <%s %s="%s">', (tag, attr, val) => {
            expect(isValidAttribute(tag, attr, val)).toBe(false);
        });

        it.each([
            ['a', 'href', 'https://example.com'],
            ['a', 'href', '/relative/path'],
            ['a', 'title', 'tooltip text'],
            ['img', 'src', 'https://example.com/a.png'],
            ['img', 'alt', 'alt text'],
        ])('keeps <%s %s="%s">', (tag, attr, val) => {
            expect(isValidAttribute(tag, attr, val)).toBe(true);
        });
    });

    describe('data-align attribute whitelist (config side of the fix)', () => {
        it('exposes data-align via ADD_ATTR on EXPORT_DOMPURIFY_CONFIG', () => {
            // marktext added `data-align` to WHITELIST_ATTRIBUTES in the
            // same commit pair; the new repo carries that intent via
            // ADD_ATTR on EXPORT_DOMPURIFY_CONFIG so saved/exported markdown
            // image alignment metadata survives sanitization.
            expect(EXPORT_CONFIG.ADD_ATTR).toContain('data-align');
        });

        it('export sanitisation preserves data-align on <img>', () => {
            const html = '<img src="x.png" data-align="center" alt="x" />';
            const cleaned = sanitize(html, EXPORT_CONFIG) as unknown as string;
            expect(cleaned).toContain('data-align="center"');
        });
    });
});

// marktext #3594 / #3697: the editor's live HTML-block preview forbade the
// `style` attribute while export allowed it, so inline-styled HTML rendered
// unstyled in the editor. The preview config now matches export — `style`
// survives, but DOMPurify still strips dangerous attributes.
describe('preview config — inline style in html blocks (#3594 #3697)', () => {
    const PREVIEW_CONFIG: Config = PREVIEW_DOMPURIFY_CONFIG;

    it('keeps the style attribute on a styled element', () => {
        const out = sanitize(
            '<div style="color: SteelBlue; text-align: center;">centered</div>',
            PREVIEW_CONFIG,
        ) as string;
        expect(out).toContain('style=');
        expect(out).toContain('text-align');
    });

    it('still strips event-handler attributes from a styled element', () => {
        const out = sanitize(
            '<div style="color: red" onclick="alert(1)">x</div>',
            PREVIEW_CONFIG,
        ) as string;
        expect(out).not.toContain('onclick');
    });
});
