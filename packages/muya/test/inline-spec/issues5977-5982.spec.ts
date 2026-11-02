import { describe, expect, it } from 'vitest';
import { audit } from './audit';
import { examples } from './fixtures';

const cases = {
    5982: [12, 14, 17, 23],
    5980: [616, 619, 620, 621, 622, 623, 627, 628, 629, 632],
    5977: [25, 26, 27, 32, 33, 37, 39, 40],
};

for (const [issue, numbers] of Object.entries(cases)) {
    describe(`CommonMark regressions for #${issue}`, () => {
        it.each(numbers)('conforms to example %i with intact source ranges', (number) => {
            const example = examples.find(example => example.suite === 'commonmark' && example.number === number)!;
            const result = audit(example);
            expect(result.status, JSON.stringify({ expected: result.expected, actual: result.actual })).toBe('conforming');
            expect(result.invariants).toEqual([]);
            expect(result.htmlFields).toEqual([]);
        });
    });
}

it('uses the tab from official spec.json in example 40', () => {
    expect(examples.find(example => example.id === 'commonmark:40')!.html).toBe('<p>\tfoo</p>\n');
    expect(examples.find(example => example.id === 'gfm:336')!.html).toBe('<p>\tfoo</p>\n');
});
