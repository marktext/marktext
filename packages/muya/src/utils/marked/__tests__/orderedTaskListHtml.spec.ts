import { describe, expect, it } from 'vitest';
import { getHighlightHtml } from '../getHighlightHtml';

// The export renders through marked, which recognises GFM task-list-items on
// ordered lists too (#1691).
describe('getHighlightHtml — ordered task list (#1691)', () => {
    it('renders `1. [x] …` as an ordered list with checkboxes', () => {
        const html = getHighlightHtml('1. [x] a\n2. [ ] b\n');

        expect(html).toContain('<ol');
        expect(html).toContain('type="checkbox"');
        expect(html.match(/type="checkbox"/g)).toHaveLength(2);
        expect(html).toContain('checked=""');
        expect(html).not.toContain('[x]');
        expect(html).not.toContain('[ ]');
    });

    it('still renders the unordered form as a `<ul>`', () => {
        const html = getHighlightHtml('- [x] a\n- [ ] b\n');

        expect(html).toContain('<ul');
        expect(html.match(/type="checkbox"/g)).toHaveLength(2);
    });
});
