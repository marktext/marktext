import { describe, expect, it } from 'vitest';
import { getHtmlBlockBoundary } from '../htmlBlockBoundary';

describe('html block boundaries', () => {
    it.each<[string, boolean, boolean]>([
        ['<script>\nx\n</script>', true, true],
        ['<pre>\nx\n</pre>', true, true],
        ['<style>\nx\n</style>', true, true],
        ['<textarea>\nx\n</textarea>', true, true],
        ['<!-- x -->', true, true],
        ['<?pi x?>', true, true],
        ['<!DOCTYPE html>', true, true],
        ['<![CDATA[x]]>', true, true],
        ['<div>\nx\n</div>', true, false],
        ['</div>', true, false],
        ['<table>\n<tr></tr>\n</table>', true, false],
        ['<x-widget>\nx\n</x-widget>', false, false],
        ['<script>\nx', true, false],
        ['<!-- unfinished', true, false],
        ['<?unfinished', true, false],
        ['<![CDATA[x', true, false],
    ])('%s: interrupts paragraph=%s, ends without blank line=%s', (html, interruptsParagraph, endsWithoutBlankLine) => {
        expect(getHtmlBlockBoundary(html)).toEqual({ interruptsParagraph, endsWithoutBlankLine });
    });

    it('recognizes the closing delimiter of uppercase raw-text HTML', () => {
        expect(getHtmlBlockBoundary('<STYLE>\nx\n</STYLE>').endsWithoutBlankLine).toBe(true);
    });
});
