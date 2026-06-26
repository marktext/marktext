// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import HtmlToMarkdown from '../../state/htmlToMarkdown';
import { MarkdownToState } from '../../state/markdownToState';

interface IStateLike {
    name: string;
    text?: string;
    children?: IStateLike[];
}

function htmlToState(html: string) {
    const markdown = new HtmlToMarkdown({ bulletListMarker: '-' }).generate(html);
    const states = new MarkdownToState({
        footnote: false,
        math: false,
        isGitlabCompatibilityEnabled: false,
        trimUnnecessaryCodeBlockEmptyLines: false,
        frontMatter: false,
    }).generate(markdown) as unknown as IStateLike[];

    return { markdown, states };
}

function firstItemChildren(states: IStateLike[]) {
    return states[0].children?.[0].children?.map(child => child.name) ?? [];
}

describe('htmlToMarkdown - nested HTML lists under ordered parents', () => {
    it('keeps a bullet child list nested under an ordered parent item', () => {
        const { markdown, states } = htmlToState(
            '<ol><li>one<ul><li>two</li></ul></li><li>three</li></ol>',
        );

        expect(markdown).toContain('1. one\n   - two');
        expect(states.map(state => state.name)).toEqual(['order-list']);
        expect(firstItemChildren(states)).toEqual(['paragraph', 'bullet-list']);
    });

    it('keeps an ordered child list nested under an ordered parent item', () => {
        const { markdown, states } = htmlToState(
            '<ol><li>one<ol><li>two</li></ol></li><li>three</li></ol>',
        );

        expect(markdown).toContain('1. one\n   1. two');
        expect(states.map(state => state.name)).toEqual(['order-list']);
        expect(firstItemChildren(states)).toEqual(['paragraph', 'order-list']);
    });

    it('uses the ordered marker width when the parent starts at a two-digit number', () => {
        const { markdown, states } = htmlToState(
            '<ol start="10"><li>ten<ul><li>child</li></ul></li><li>eleven</li></ol>',
        );

        expect(markdown).toContain('10. ten\n    - child');
        expect(states.map(state => state.name)).toEqual(['order-list']);
        expect(firstItemChildren(states)).toEqual(['paragraph', 'bullet-list']);
    });
});
