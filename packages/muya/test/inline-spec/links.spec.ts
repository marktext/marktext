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
