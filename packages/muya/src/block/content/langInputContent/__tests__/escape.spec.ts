import { describe, expect, it } from 'vitest';
import { escapeLangInputInnerHtml } from '../escape';

// Regression for marktext commit 0dd09cc6 (#2548 / #2601 — "fix XSS on
// language input and hyperlinks"). The previous implementation of
// `LangInputContent.update()` assigned `getHighlightHtml(this.text, highlights)`
// directly to `domNode.innerHTML`, allowing a code-block language
// identifier such as `<img/src=x/onerror=alert(1)>` (no whitespace, so
// `inputHandler`'s `split(/\s+/)[0]` keeps it intact) to inject HTML.
describe('escapeLangInputInnerHtml — code-block language identifier XSS', () => {
    it('escapes raw HTML so `<img/src=x/onerror=alert(1)>` cannot be injected', () => {
        const malicious = '<img/src=x/onerror=alert(1)>';

        const out = escapeLangInputInnerHtml(malicious, []);

        // Angle brackets must be entities — without a real `<img` token,
        // setting innerHTML to `out` cannot construct an IMG element and
        // the `onerror` handler is never wired up.
        expect(out).not.toContain('<img');
        expect(out).toContain('&lt;img');
        expect(out).toContain('&gt;');
    });

    it('escapes ambient ampersands as well (post-dc54c7b6 escape semantics)', () => {
        const out = escapeLangInputInnerHtml('a & b', []);
        expect(out).toContain('&amp;');
        expect(out).not.toMatch(/[^&]&[^a]/); // a stray `&` not part of an entity is a regression
    });

    it('keeps highlight spans intact when highlights are present', () => {
        // highlights uses character offsets relative to the lang text
        const out = escapeLangInputInnerHtml('<bad>', [
            { start: 0, end: 5, active: false },
        ]);

        // Highlight span must be a real element (class survives), bad tag must not.
        expect(out).toContain('class="mu-selection"');
        expect(out).not.toContain('<bad');
        expect(out).toContain('&lt;bad&gt;');
    });
});
