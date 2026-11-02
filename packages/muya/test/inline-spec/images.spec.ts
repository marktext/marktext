import { describe, expect, it } from 'vitest';
import { audit } from './audit';
import { examples } from './fixtures';

describe('image descriptions (#5981)', () => {
    it.each(examples.filter(example => example.section === 'Images'))('$id matches the official image semantics', (example) => {
        const result = audit(example);
        expect(result.invariants).toEqual([]);
        expect(result.actual, example.markdown).toEqual(result.expected);
        expect(result.status).toBe('conforming');
    });
});
