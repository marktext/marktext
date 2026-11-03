import { expect, it } from 'vitest';
import { audit } from './audit';
import { examples } from './fixtures';

it.each(['commonmark:354', 'commonmark:645', 'gfm:623', 'gfm:628', 'gfm:631', 'gfm:665'])('%s conforms after the inline follow-ups (#5994, #5995, #5996)', (id) => {
    const result = audit(examples.find(example => example.id === id)!);
    expect(result.status).toBe('conforming');
    expect(result.actual).toEqual(result.expected);
    expect(result.invariants).toEqual([]);
    expect(result.htmlFields).toEqual([]);
});
