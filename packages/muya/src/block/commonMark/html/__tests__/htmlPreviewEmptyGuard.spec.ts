import { describe, expect, it } from 'vitest';
import { isEmptyHtmlBlock } from '../htmlPreview';

// Regression for marktext #3821. The html-block "empty block" guard replaced
// any single element with an empty body by the "<Empty HTML Block>"
// placeholder. Media elements (`<video>`/`<audio>`) carry their content in
// attributes, so an empty body is not an empty block and they must render.
describe('isEmptyHtmlBlock (#3821)', () => {
    it('treats a single element with an empty body as empty', () => {
        expect(isEmptyHtmlBlock('<div></div>')).toBe(true);
        expect(isEmptyHtmlBlock('<span></span>')).toBe(true);
        // whitespace / newline between tags still counts as empty
        expect(isEmptyHtmlBlock('<p>\n</p>')).toBe(true);
    });

    it('does not treat self-contained media (video/audio) as empty', () => {
        expect(isEmptyHtmlBlock('<video controls src="https://e.com/v.mp4"></video>')).toBe(false);
        expect(isEmptyHtmlBlock('<video src="https://e.com/v.mp4">\n</video>')).toBe(false);
        expect(isEmptyHtmlBlock('<audio src="https://e.com/a.mp3"></audio>')).toBe(false);
    });

    it('returns false for an element that has body content', () => {
        expect(isEmptyHtmlBlock('<div>hello</div>')).toBe(false);
    });
});
