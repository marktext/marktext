// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { getClipBoardHtml } from '../../utils/marked/getClipboardHtml';

// Copy-as-HTML / copy-as-rich writes inline math back as TeX source, and every
// span came out as `$...$`. The authored marker must survive whether the
// formula renders as display or inline math.
describe('getClipBoardHtml — inline math markers', () => {
    it('keeps `$$` around same-line display math', () => {
        expect(getClipBoardHtml('$$ E=MC^2 $$')).toContain('$$E=MC^2$$');
        expect(getClipBoardHtml('Energy is $$E=mc^2$$ in physics.')).toContain('Energy is $$E=mc^2$$ in physics.');
    });

    it('keeps `$` around inline math', () => {
        const html = getClipBoardHtml('Energy is $E=mc^2$ in physics.');

        expect(html).toContain('Energy is $E=mc^2$ in physics.');
        expect(html).not.toContain('$$');
    });
});
