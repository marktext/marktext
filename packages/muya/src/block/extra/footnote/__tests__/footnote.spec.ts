// @vitest-environment happy-dom
import type { Muya } from '../../../../muya';
import type { IFootnoteBlockState } from '../../../../state/types';
import { describe, expect, it } from 'vitest';
import Footnote from '..';
import { MarkdownToState } from '../../../../state/markdownToState';
import ExportMarkdown from '../../../../state/stateToMarkdown';
import { isFootnoteBlockState } from '../../../../state/types';
import { registerBlocks } from '../../../index';
import { ScrollPage } from '../../../scrollPage';

// Register the block tree once for the suite. registerBlocks() is idempotent:
// `ScrollPage.registeredBlocks` is a Map keyed by stable `blockName` strings,
// so subsequent imports of this file or its sibling specs reuse the same map.
registerBlocks();

// Footnote.create() walks down through `ScrollPage.loadBlock(child.name)`
// into ParagraphContent, whose constructor calls `update()` and reads
// `muya.editor.inlineRenderer.patch / getLabelInfo` plus `muya.i18n.t`.
// The stub below is the minimum surface we need to exercise create() +
// getState() without booting a real editor.
function makeFakeMuya(): Muya {
    return {
        i18n: { t: (s: string) => s },
        options: {
            autoPairBracket: false,
            autoPairMarkdownSyntax: false,
            autoPairQuote: false,
        },
        editor: {
            inlineRenderer: {
                patch: () => {},
                getLabelInfo: () => ({ label: '' }),
            },
            // scrollPage is only used to refresh ref-link/image labels — null
            // short-circuits ParagraphContent.update.
            scrollPage: null,
        },
    } as unknown as Muya;
}

const baseState: IFootnoteBlockState = {
    name: 'footnote',
    meta: { identifier: 'foo' },
    children: [{ name: 'paragraph', text: 'hello world' }],
};

describe('footnote block — registration', () => {
    it('scrollPage.loadBlock("footnote") returns the Footnote class after registerBlocks()', () => {
        const Block = ScrollPage.loadBlock('footnote');
        expect(Block).toBeDefined();
        expect(Block).toBe(Footnote);
    });
});

describe('footnote block — class API', () => {
    it('create() returns a Footnote whose getState() round-trips the input state', () => {
        const muya = makeFakeMuya();
        const block = Footnote.create(muya, baseState);
        expect(block).toBeInstanceOf(Footnote);
        expect(block.getState()).toEqual(baseState);
    });

    it('mutating meta.identifier is reflected in subsequent getState()', () => {
        const muya = makeFakeMuya();
        const block = Footnote.create(muya, baseState);
        block.meta.identifier = 'renamed';
        const next = block.getState();
        expect(next.meta.identifier).toBe('renamed');
        // children stay intact when only meta changes.
        expect(next.children).toEqual(baseState.children);
    });

    it('remove("api") detaches the block DOM and clears its parent link', () => {
        const muya = makeFakeMuya();
        const block = Footnote.create(muya, baseState);
        const parentDom = document.createElement('div');
        parentDom.appendChild(block.domNode!);
        // Plug into a minimal fake Parent so remove('api') walks the tree
        // without dispatching ot-json1 operations against a real editor.
        block.parent = {
            children: { remove: () => {} },
            domNode: parentDom,
        } as never;

        block.remove('api');

        expect(parentDom.contains(block.domNode!)).toBe(false);
        expect(block.parent).toBeNull();
    });
});

describe('footnote block — markdown round-trip via state', () => {
    function roundTrip(md: string): string {
        const states = new MarkdownToState({
            footnote: true,
            math: false,
            isGitlabCompatibilityEnabled: false,
            trimUnnecessaryCodeBlockEmptyLines: false,
            frontMatter: false,
        }).generate(md);
        return new ExportMarkdown({ listIndentation: 1 }).generate(states);
    }

    it('round-trips a simple footnote reference + definition', () => {
        const md = `foo[^1]

[^1]: bar
`;
        expect(roundTrip(md)).toBe(md);
    });

    it('parses a footnote whose definition contains a nested bullet list (markdownToState recursion trick)', () => {
        // Defensive regression for the `tokens.unshift({type:'block-end',
        // tokenType:'footnote'})` recursion trick in markdownToState.ts:316-331.
        // The block-end sentinel must pop the parent stack at the right time
        // when the footnote body contains nested block-level tokens (here a
        // bullet list) — otherwise the list ends up as a sibling of the
        // footnote rather than as its child.
        const md = `text[^n]

[^n]: - item a
    - item b
`;
        const states = new MarkdownToState({
            footnote: true,
            math: false,
            isGitlabCompatibilityEnabled: false,
            trimUnnecessaryCodeBlockEmptyLines: false,
            frontMatter: false,
        }).generate(md);

        const footnote = states.find(isFootnoteBlockState);

        expect(footnote, 'footnote state should be present').toBeDefined();
        expect(footnote!.meta.identifier).toBe('n');
        expect(footnote!.children.length).toBeGreaterThan(0);
        // The first child of the footnote must be a list, not the next paragraph.
        expect(footnote!.children[0].name).toBe('bullet-list');
    });
});
