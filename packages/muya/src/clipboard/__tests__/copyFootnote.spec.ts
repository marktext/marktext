// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { getClipBoardHtml } from '../../utils/marked/getClipboardHtml';

// Copy-as-HTML / copy-as-rich must render footnote definitions in the clipboard
// HTML the same way the static / export render path does. muyajs passed the
// `footnote` option into marked; muya's `getClipBoardHtml` dropped it.
const MD = 'See the note[^1].\n\n[^1]: The footnote body.';

describe('getClipBoardHtml — footnote rendering', () => {
    it('renders footnote definitions when footnote is enabled', () => {
        const html = getClipBoardHtml(MD, { footnote: true });
        expect(html).toContain('footnote-block');
    });

    it('leaves footnote definitions unrendered when footnote is disabled', () => {
        const html = getClipBoardHtml(MD, { footnote: false });
        expect(html).not.toContain('footnote-block');
    });
});
