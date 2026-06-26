// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import HtmlToMarkdown from '../../state/htmlToMarkdown';
import { MarkdownToState } from '../../state/markdownToState';
import { normalizePastedHTML } from '../paste';

interface IStateLike {
    name: string;
    text?: string;
    children?: IStateLike[];
}

async function pasteHtmlToState(html: string) {
    const normalized = await normalizePastedHTML(html);
    const markdown = new HtmlToMarkdown({ bulletListMarker: '-' }).generate(normalized);
    const states = new MarkdownToState({
        footnote: false,
        math: false,
        isGitlabCompatibilityEnabled: false,
        trimUnnecessaryCodeBlockEmptyLines: false,
        frontMatter: false,
    }).generate(markdown) as unknown as IStateLike[];

    return { markdown, states };
}

function rowTexts(row: IStateLike) {
    return row.children?.map(cell => cell.text ?? '') ?? [];
}

describe('normalizePastedHTML - table colspan paste', () => {
    it('keeps a first-row colspan table parseable as a Markdown table', async () => {
        const { markdown, states } = await pasteHtmlToState(
            '<table><tr><td colspan="2">A</td></tr><tr><td>B</td><td>C</td></tr></table>',
        );

        expect(markdown).toMatch(/\|\s*A\s*\|\s*\|/);
        expect(markdown).toMatch(/\|\s*B\s*\|\s*C\s*\|/);

        expect(states[0].name).toBe('table');
        expect(rowTexts(states[0].children![0])).toEqual(['A', '']);
        expect(rowTexts(states[0].children![1])).toEqual(['B', 'C']);
    });
});
