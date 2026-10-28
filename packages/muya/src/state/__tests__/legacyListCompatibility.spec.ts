import type { TState } from '../types';
import { describe, expect, it } from 'vitest';
import { MarkdownToState } from '../markdownToState';
import ExportMarkdown from '../stateToMarkdown';

const INDENTATIONS = [1, 2, 3, 4, 'tab', 'dfm'];
const MARKERS = ['-', '*', '+', '1.', '3)', '007.', '0.', '999999999.'];
const BODIES = [
    'plain',
    '[ ] task',
    '[x] **done**',
    '[ ]',
    '',
    'soft\nline',
    'hard  \nbreak',
    'first\n\nsecond',
    '> quote\n> next',
    '```js\nconst x = 1\n```',
    '[label][ref]',
    '![](x.png)',
    '| a | b |\n| - | - |\n| c | d |',
    '$math$',
    'text `a. literal`',
    '<div>\nraw\n</div>',
];

function legacyDocuments(marker: string): string[] {
    const indent = ' '.repeat(marker.length + 1);
    return BODIES.flatMap(body => ['\n', '\n\n'].flatMap((gap) => {
        const item = `${marker} ${body.replace(/\n/g, `\n${indent}`)}`;
        return [
            `${item}${gap}${marker} last\n`,
            `${marker} parent\n${indent}${item.replace(/\n/g, `\n${indent}`)}\n${marker} last\n`,
        ];
    }));
}

function parse(markdown: string, fancyLists: boolean): TState[] {
    return new MarkdownToState({ fancyLists, texMathDollars: false, frontMatter: false }).generate(markdown);
}

describe('legacy lists with the fancy-list extension', () => {
    it.each(MARKERS)('preserves parsing, save output and repeated saves for %s', (marker) => {
        for (const markdown of legacyDocuments(marker)) {
            const original = parse(markdown, false);
            expect(parse(markdown, true), markdown).toEqual(original);
            for (const listIndentation of INDENTATIONS) {
                const disabled = new ExportMarkdown({ listIndentation, fancyLists: false });
                const enabled = new ExportMarkdown({ listIndentation, fancyLists: true });
                const saved = enabled.generate(original);
                expect(saved, markdown).toBe(disabled.generate(original));
                expect(enabled.generate(parse(saved, true)), markdown).toBe(saved);
            }
        }
    });

    it.each([
        '- one\n- two\n',
        '* [ ] todo\n* [x] done\n',
        '007. one\n010. two\n003. three\n',
        '3) first\n9) second\n',
        '1. plain\n2. [ ] todo\n3. [x] done\n4. plain\n',
    ])('retains original markers and task runs verbatim for %j', (markdown) => {
        for (const fancyLists of [false, true]) {
            const serializer = new ExportMarkdown({ fancyLists });
            const saved = serializer.generate(parse(markdown, fancyLists));
            expect(saved).toBe(markdown);
            expect(serializer.generate(parse(saved, fancyLists))).toBe(markdown);
        }
    });

    it('keeps existing CRLF parsing behavior when the extension changes', () => {
        const markdown = '1) first\r\n2) [x] second\r\n   - nested\r\n';
        expect(parse(markdown, true)).toEqual(parse(markdown, false));
    });
});
