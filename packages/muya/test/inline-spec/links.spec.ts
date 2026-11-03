import { describe, expect, it } from 'vitest';
import { audit } from './audit';
import { examples } from './fixtures';

describe('link structure and reference resolution (#5979)', () => {
    it.each(examples.filter(example => example.section === 'Links'))('$id matches the official link semantics', (example) => {
        const result = audit(example);
        expect(result.invariants).toEqual([]);
        expect(result.actual, example.markdown).toEqual(result.expected);
        expect(result.status).toBe('conforming');
    });
});

describe('tab-separated reference definitions (#5968)', () => {
    for (const suite of ['commonmark', 'gfm'] as const) {
        for (const separator of [' ', '    ', '\t', ' \t']) {
            it(`${suite}: resolves links and images with ${JSON.stringify(separator)}`, () => {
                const result = audit({
                    suite,
                    id: `${suite}:regression-5968`,
                    number: 5968,
                    section: 'Links',
                    markdown: `[link][ref] ![image][ref]\n\n[ref]: https://example.com/image.png${separator}'title'\n`,
                    html: '<p><a href="https://example.com/image.png" title="title">link</a> <img src="https://example.com/image.png" alt="image" title="title" /></p>\n',
                });
                expect(result.invariants).toEqual([]);
                expect(result.actual).toEqual(result.expected);
                expect(result.status).toBe('conforming');
            });
        }
    }
});
