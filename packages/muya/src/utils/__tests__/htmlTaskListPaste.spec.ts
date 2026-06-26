// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import HtmlToMarkdown from '../../state/htmlToMarkdown';
import { MarkdownToState } from '../../state/markdownToState';

interface IStateLike {
    name: string;
    text?: string;
    meta?: { checked?: boolean };
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

function firstTask(states: IStateLike[]) {
    const item = states[0].children?.[0];
    return {
        checked: item?.meta?.checked,
        text: item?.children?.find(child => child.name === 'paragraph')?.text,
    };
}

describe('htmlToMarkdown - task-list HTML paste', () => {
    it('normalizes a direct unchecked checkbox inside a list item', () => {
        const { markdown, states } = htmlToState(
            '<ul class="contains-task-list"><li class="task-list-item"><input type="checkbox" disabled=""><span>&nbsp;</span>task</li></ul>',
        );

        expect(markdown).toContain('- [ ] task');
        expect(markdown).not.toContain('\u00A0');
        expect(states[0].name).toBe('task-list');
        expect(firstTask(states)).toEqual({ checked: false, text: 'task' });
    });

    it('normalizes a direct checked checkbox inside a list item', () => {
        const { markdown, states } = htmlToState(
            '<ul class="contains-task-list"><li class="task-list-item"><input type="checkbox" checked="" disabled=""><span>&nbsp;</span>done</li></ul>',
        );

        expect(markdown).toContain('- [x] done');
        expect(markdown).not.toContain('\u00A0');
        expect(states[0].name).toBe('task-list');
        expect(firstTask(states)).toEqual({ checked: true, text: 'done' });
    });

    it('keeps paragraph-wrapped task-list checkboxes normalized', () => {
        const { markdown, states } = htmlToState(
            '<ul><li><p><input type="checkbox" checked=""><span>&nbsp;</span>done</p></li></ul>',
        );

        expect(markdown).toContain('- [x] done');
        expect(markdown).not.toContain('\u00A0');
        expect(states[0].name).toBe('task-list');
        expect(firstTask(states)).toEqual({ checked: true, text: 'done' });
    });

    it('does not normalize a parent list item only because a nested child item has a checkbox', () => {
        const { markdown, states } = htmlToState(
            '<ul><li>[x]&nbsp;parent<ul><li><input type="checkbox" disabled=""><span>&nbsp;</span>child</li></ul></li></ul>',
        );

        expect(markdown).toContain('- [x]\u00A0parent');
        expect(markdown).toContain('  - [ ] child');
        expect(states[0].name).toBe('bullet-list');
    });
});
