// @vitest-environment happy-dom

import type { TState } from '../types';
import { describe, expect, it } from 'vitest';
import { MarkdownToState } from '../markdownToState';
import StateToMarkdown from '../stateToMarkdown';

// Regression coverage ported from marktext#4341 (legacy desktop spec
// `test/unit/specs/markdown-nested-mixed-lists.spec.ts`). A list whose type
// differs from its enclosing list item (a `ul` inside an `ol`, or an `ol`
// inside a `ul`) was being rewritten into a paragraph by the legacy muyajs
// lexer, losing the nested-list structure.
//
// The new @muyajs/core engine parses through marked + the state tree rather
// than the legacy ContentState/ExportMarkdown pair, so the equivalent checks
// are:
//   - structural: the state tree from `MarkdownToState` carries a nested
//     `bullet-list` / `order-list` under the correct outer `list-item`
//     (mirrors the legacy `blocks[...].children.find(type === 'ul')` probe).
//   - round-trip: `MarkdownToState` → `StateToMarkdown` reproduces the source
//     markdown verbatim (mirrors the legacy importMarkdown → ExportMarkdown
//     identity assertion). The legacy spec used a 3-space indent for the
//     nested `ul` and 2-space for the nested `ol`; the @muyajs/core serializer
//     uses a content-aligned indent (marker width + 1) so the expected output
//     is regenerated rather than hard-coded against the legacy indentation.

function toState(markdown: string): TState[] {
    return new MarkdownToState({
        footnote: false,
        math: true,
        isGitlabCompatibilityEnabled: true,
        trimUnnecessaryCodeBlockEmptyLines: false,
        frontMatter: true,
    }).generate(markdown);
}

function roundTrip(markdown: string): string {
    return new StateToMarkdown({ listIndentation: 1 }).generate(toState(markdown));
}

// `children` is only present on container states; leaf states (paragraph,
// table.cell, …) have no `children`. Narrow on the property so we stay
// `any`-free while still tolerating a leaf/undefined input.
function children(state: TState | undefined): TState[] {
    return state && 'children' in state ? state.children : [];
}

// First-child text of a list item (its leading paragraph). Leaf states carry a
// `text` field; container states do not.
function firstText(state: TState | undefined): string | undefined {
    const first = children(state)[0];
    return first && 'text' in first ? first.text : undefined;
}

describe('nested mixed lists (#4341)', () => {
    it('preserves a bullet list nested inside an ordered list item (round trip)', () => {
        const markdown = `1. Eat a carrot.
2. Find an application:
   - New
   - Open
   - Save
`;
        // First pass is the identity, and a second pass is stable.
        const once = roundTrip(markdown);
        expect(once).toBe(markdown);
        expect(roundTrip(once)).toBe(once);
    });

    it('preserves an ordered list nested inside a bullet list item (round trip)', () => {
        const markdown = `- Outer bullet
- Container item:
  1. First step
  2. Second step
  3. Third step
`;
        const once = roundTrip(markdown);
        expect(once).toBe(markdown);
        expect(roundTrip(once)).toBe(once);
    });

    it('produces a bullet-list state nested inside the second order-list item (not a paragraph)', () => {
        const states = toState(`1. Eat a carrot.
2. Find an application:
   - New
   - Open
   - Save
`);
        const ol = states.find(s => s.name === 'order-list');
        expect(ol, 'expected a top-level order-list state').toBeDefined();

        const secondItem = children(ol)[1];
        expect(secondItem.name).toBe('list-item');

        const nestedList = children(secondItem).find(c => c.name === 'bullet-list');
        expect(nestedList, 'expected a bullet-list nested inside the second order-list item').toBeDefined();
        // The item is exactly [leading paragraph, nested bullet-list] — the
        // nested list did NOT collapse into a paragraph (the #4341 failure mode).
        expect(children(secondItem).map(c => c.name)).toEqual(['paragraph', 'bullet-list']);
        expect(children(nestedList)).toHaveLength(3);
        expect(children(nestedList).map(firstText)).toEqual(['New', 'Open', 'Save']);
    });

    it('produces an order-list state nested inside a bullet-list item (not a paragraph)', () => {
        const states = toState(`- Outer bullet
- Container item:
  1. First step
  2. Second step
  3. Third step
`);
        const ul = states.find(s => s.name === 'bullet-list');
        expect(ul, 'expected a top-level bullet-list state').toBeDefined();

        const secondItem = children(ul)[1];
        expect(secondItem.name).toBe('list-item');

        const nestedList = children(secondItem).find(c => c.name === 'order-list');
        expect(nestedList, 'expected an order-list nested inside the second bullet-list item').toBeDefined();
        expect(children(secondItem).map(c => c.name)).toEqual(['paragraph', 'order-list']);
        expect(children(nestedList)).toHaveLength(3);
        expect(children(nestedList).map(firstText)).toEqual(['First step', 'Second step', 'Third step']);
    });
});
