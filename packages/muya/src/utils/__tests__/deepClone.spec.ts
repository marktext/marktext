import type { TState } from '../../state/types';
import { describe, expect, it } from 'vitest';
import { deepClone } from '../index';

// A bullet list nested `depth` levels deep, in the shape `markdownToState`
// emits: every level adds a `bullet-list`, its `children` array, a
// `list-item` and its `children` array, so 600 list levels are ~2400 nested
// containers. `structuredClone` overflows the engine stack on this input
// (#4747), and so would a recursive equality check, hence the iterative
// walk below.
function nestedBulletList(depth: number): TState[] {
    let state: TState = { name: 'paragraph', text: 'leaf' };
    for (let level = depth - 1; level >= 0; level--) {
        state = {
            name: 'bullet-list',
            meta: { loose: false, marker: '-' },
            children: [{ name: 'list-item', children: [{ name: 'paragraph', text: `item ${level}` }, state] }],
        };
    }
    return [state];
}

// Descend through the nested lists and return the innermost paragraph plus
// the number of list levels passed on the way.
function innermostLeaf(state: TState[]): { leaf: TState; levels: number } {
    let levels = 0;
    let current = state[0];
    while (current.name === 'bullet-list') {
        levels++;
        const item = current.children[0];
        current = item.children[item.children.length - 1];
    }
    return { leaf: current, levels };
}

describe('deepClone', () => {
    it('copies a 600-level nested list without exhausting the stack (#4747)', () => {
        const state = nestedBulletList(600);

        const copy = deepClone(state);

        expect(copy).not.toBe(state);
        expect(copy[0]).not.toBe(state[0]);
        const source = innermostLeaf(state);
        const cloned = innermostLeaf(copy);
        expect(cloned.levels).toBe(600);
        expect(cloned.levels).toBe(source.levels);
        expect(cloned.leaf).toEqual({ name: 'paragraph', text: 'leaf' });
        expect(cloned.leaf).not.toBe(source.leaf);
    });

    it('returns a structurally equal copy whose containers are all fresh', () => {
        const state = nestedBulletList(3);

        const copy = deepClone(state);

        expect(copy).toEqual(state);
        expect(copy[0]).not.toBe(state[0]);
        const sourceList = state[0];
        const copiedList = copy[0];
        if (sourceList.name !== 'bullet-list' || copiedList.name !== 'bullet-list')
            throw new Error('fixture root must be a bullet list');
        expect(copiedList.meta).not.toBe(sourceList.meta);
        expect(copiedList.children).not.toBe(sourceList.children);
        copiedList.meta.loose = true;
        expect(sourceList.meta.loose).toBe(false);
    });

    it('keeps references that are shared inside the source shared in the copy', () => {
        const shared = { text: 'shared' };
        const source = { a: shared, b: shared, list: [shared] };

        const copy = deepClone(source);

        expect(copy.a).not.toBe(shared);
        expect(copy.a).toBe(copy.b);
        expect(copy.list[0]).toBe(copy.a);
    });

    it('passes primitives through and still uses structuredClone for other object types', () => {
        expect(deepClone(42)).toBe(42);
        expect(deepClone('text')).toBe('text');
        expect(deepClone(null)).toBeNull();
        expect(deepClone(undefined)).toBeUndefined();

        const date = new Date(0);
        const copy = deepClone({ date, values: [1, 'two', null] });
        expect(copy.date).toBeInstanceOf(Date);
        expect(copy.date).not.toBe(date);
        expect(copy.date.getTime()).toBe(0);
        expect(copy.values).toEqual([1, 'two', null]);
    });
});
