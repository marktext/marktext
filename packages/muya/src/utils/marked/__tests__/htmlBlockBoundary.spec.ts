import { describe, expect, it } from 'vitest';
import { getHtmlBlockBoundary } from '../htmlBlockBoundary';

describe('html block boundaries', () => {
    it.each([
        '<script>\nx\n</script>',
        '<pre>\nx\n</pre>',
        '<style>\nx\n</style>',
        '<textarea>\nx\n</textarea>',
        '<!-- x -->',
        '<?pi x?>',
        '<!DOCTYPE html>',
        '<![CDATA[x]]>',
    ])('recognizes self-terminating HTML: %s', (html) => {
        expect(getHtmlBlockBoundary(html)).toEqual({
            interruptsParagraph: true,
            endsWithoutBlankLine: true,
        });
    });

    it.each(['<div>\nx\n</div>', '</div>', '<table>\n<tr></tr>\n</table>'])(
        'keeps the blank-line termination of type 6 HTML: %s',
        (html) => {
            expect(getHtmlBlockBoundary(html)).toEqual({
                interruptsParagraph: true,
                endsWithoutBlankLine: false,
            });
        },
    );

    it('does not let type 7 HTML interrupt a paragraph', () => {
        expect(getHtmlBlockBoundary('<x-widget>\nx\n</x-widget>')).toEqual({
            interruptsParagraph: false,
            endsWithoutBlankLine: false,
        });
    });

    it('recognizes the closing delimiter of uppercase raw-text HTML', () => {
        expect(getHtmlBlockBoundary('<STYLE>\nx\n</STYLE>').endsWithoutBlankLine).toBe(true);
    });

    it.each(['<script>\nx', '<!-- unfinished', '<?unfinished', '<![CDATA[x'])(
        'does not treat an unfinished HTML block as closed: %s',
        (html) => {
            expect(getHtmlBlockBoundary(html)).toEqual({
                interruptsParagraph: true,
                endsWithoutBlankLine: false,
            });
        },
    );
});
