// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { MarkdownToHtml } from '../markdownToHtml';

// `generate({ dir })` controls the text direction of the exported document.
// RTL documents must export with `dir="rtl"` on the root <html> so the PDF /
// HTML / print output flows right-to-left (issue #4553). LTR is the HTML
// default, so it is left implicit to keep existing exports byte-identical.

const SAMPLE = '# سلام\n\nمتن نمونه.\n';

describe('markdownToHtml.generate — text direction', () => {
    it('emits dir="rtl" on <html> when dir is "rtl"', async () => {
        const out = await new MarkdownToHtml(SAMPLE).generate({ dir: 'rtl' });
        expect(out).toMatch(/<html lang="en" dir="rtl">/);
    });

    it('emits dir="auto" on <html> when dir is "auto"', async () => {
        const out = await new MarkdownToHtml(SAMPLE).generate({ dir: 'auto' });
        expect(out).toMatch(/<html lang="en" dir="auto">/);
    });

    it('omits the dir attribute for the default LTR direction', async () => {
        const ltr = await new MarkdownToHtml(SAMPLE).generate({ dir: 'ltr' });
        const none = await new MarkdownToHtml(SAMPLE).generate({});
        expect(ltr).toContain('<html lang="en">');
        expect(ltr).not.toMatch(/<html[^>]+dir=/);
        expect(none).toContain('<html lang="en">');
        expect(none).not.toMatch(/<html[^>]+dir=/);
    });
});
